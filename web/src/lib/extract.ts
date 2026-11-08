import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { aiProviders, anthropic, EXTRACT_MODEL, pauseProvider } from "./ai";
import { GEMINI_EXTRACT_MODEL, GeminiError, generate, thinking } from "./gemini";
import { GROQ, GROQ_VISION_MODEL, GroqError, chat, type ChatEndpoint } from "./groq";
import { DEEPSEEK, DEEPSEEK_VISION_MODEL } from "./deepseek";
import { ExtractedDocSchema, type DocType, type ExtractedDoc } from "./kyc-types";

/**
 * Reads a KYC document image into structured fields.
 * Primary: Gemini (or Groq, or Claude) vision with a strict output schema (handles rotation, blur
 * detection and odd layouts). Fallback: on-device Tesseract OCR + label parsing.
 * Images are processed in memory and never written to disk.
 */

export type ExtractEngine = "deepseek-vision" | "groq-vision" | "gemini-vision" | "claude-vision" | "tesseract";

export interface ExtractionResult {
  doc: ExtractedDoc;
  engine: ExtractEngine;
  ms: number;
}

const PROMPT = `You are the document reader for an Indian telecom's business KYC.
Read the attached image and return the fields you can see, exactly as printed.

- docType: gst_certificate (GST registration certificate), udyam_certificate, address_proof (utility bill), signatory_id (person ID card), or unknown.
- legible: false if the image is too blurred, cropped or dark to read the key identifiers with confidence. Do not guess characters you cannot see; set them to null.
- qualityIssues: short words such as "rotated", "blurred", "low light", "cropped" — only what you actually observe.
- confidence: 0-1, how sure you are the identifiers are read correctly.
- Dates as YYYY-MM-DD. GSTIN as 15 uppercase characters with no spaces. Udyam as UDYAM-XX-00-0000000.
- Address: join wrapped lines into one string.
- If a labelled field is present but empty (e.g. no number printed), return null for it.
The document may carry "specimen" watermarks — ignore them.`;

async function extractWithClaude(image: Buffer, mediaType: "image/png" | "image/jpeg" | "image/webp"): Promise<ExtractedDoc | undefined> {
  const response = await anthropic().messages.parse({
    model: EXTRACT_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(ExtractedDocSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image.toString("base64") } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") return undefined;
  return response.parsed_output ?? undefined;
}

// Gemini takes plain JSON Schema; drop the draft marker.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { $schema, ...EXTRACT_JSON_SCHEMA } = z.toJSONSchema(ExtractedDocSchema);

async function extractWithGemini(image: Buffer, mediaType: string): Promise<ExtractedDoc | undefined> {
  const res = await generate(GEMINI_EXTRACT_MODEL, {
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: mediaType, data: image.toString("base64") } }, { text: PROMPT }] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: EXTRACT_JSON_SCHEMA, thinkingConfig: thinking(GEMINI_EXTRACT_MODEL), temperature: 0 },
  });
  const text = res.candidates?.[0]?.content?.parts?.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  if (!text) return undefined;
  const parsed = ExtractedDocSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : undefined;
}

/** Groq has JSON mode but no schema enforcement, so the schema goes in the prompt and zod checks the result. */
async function extractWithGroq(image: Buffer, mediaType: string, ep: ChatEndpoint = GROQ): Promise<ExtractedDoc | undefined> {
  const res = await chat({
    model: ep === DEEPSEEK ? DEEPSEEK_VISION_MODEL : GROQ_VISION_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `${PROMPT}\n\nReply with one JSON object matching this JSON Schema:\n${JSON.stringify(EXTRACT_JSON_SCHEMA)}` },
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${image.toString("base64")}` } },
        ],
      },
    ],
  }, ep);
  if (!res.content) return undefined;
  const parsed = ExtractedDocSchema.safeParse(JSON.parse(res.content));
  return parsed.success ? parsed.data : undefined;
}

const ENGINES = { deepseek: [(image: Buffer, mediaType: string) => extractWithGroq(image, mediaType, DEEPSEEK), "deepseek-vision"], groq: [extractWithGroq, "groq-vision"], gemini: [extractWithGemini, "gemini-vision"], anthropic: [extractWithClaude, "claude-vision"] } as const;

// ---------------------------------------------------------------------------
// Tesseract fallback
// ---------------------------------------------------------------------------

const LABELS: Record<string, keyof ExtractedDoc["fields"]> = {
  "gstin": "gstin",
  "legal name": "legalName",
  "trade name": "tradeName",
  "constitution": "constitution",
  "address of principal": "address",
  "place of business": "address",
  "date of liability": "dateOfLiability",
  "udyam reg. number": "udyamNumber",
  "udyam reg number": "udyamNumber",
  "enterprise name": "enterpriseName",
  "major activity": "majorActivity",
  "city": "city",
  "state": "state",
  "date of registration": "dateOfRegistration",
  "consumer no.": "consumerNumber",
  "billed to": "billedTo",
  "supply address": "address",
  "bill date": "billDate",
  "designation": "designation",
  "for business": "forBusiness",
  "id no.": "idNumber",
  "valid till": "validTill",
  "name": "signatoryName",
};

const NOISE = /specimen|not a valid|accel ytl|format for hackathon|fictional|ocr testing|units consumed|amount due|type of registration/i;

export function parseOcrText(text: string): ExtractedDoc["fields"] & { _docType: ExtractedDoc["docType"] } {
  const docType: ExtractedDoc["docType"] = /gst registration/i.test(text)
    ? "gst_certificate"
    : /udyam registration/i.test(text)
      ? "udyam_certificate"
      : /bill|consumer no/i.test(text)
        ? "address_proof"
        : /designation|valid till/i.test(text)
          ? "signatory_id"
          : "unknown";
  const fields: Record<string, string | null> = {};
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !NOISE.test(l));
  const labelKeys = Object.keys(LABELS).sort((a, b) => b.length - a.length);
  let lastKey: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const label = labelKeys.find((k) => line.toLowerCase().startsWith(k));
    if (label) {
      const key = LABELS[label];
      const rest = line.slice(label.length).replace(/^[\s:|]+/, "").trim();
      // Card layout puts the value on the next line.
      const value = rest || (lines[i + 1] && !labelKeys.some((k) => lines[i + 1].toLowerCase().startsWith(k)) ? lines[++i] : "");
      fields[key] = fields[key] && key === "address" ? `${fields[key]}${value}` : value || null;
      lastKey = key;
    } else if (lastKey === "address" && /^[a-z]{0,12}\s*-?\s*\d{3,6}$|^-?\s*\d{6}$/i.test(line)) {
      fields.address = `${fields.address ?? ""}${line}`; // wrapped "ashtra - 137452"
    }
  }
  if (fields.address) fields.address = fields.address.replace(/\s*-\s*(\d{2,6})\s*(\d{0,4})$/, (_, a, b) => ` - ${a}${b}`);
  if (fields.gstin) fields.gstin = fields.gstin.replace(/\s+/g, "").toUpperCase();
  if (fields.udyamNumber) fields.udyamNumber = fields.udyamNumber.replace(/\s+/g, "").toUpperCase();
  if (docType !== "signatory_id") delete fields.signatoryName;
  return { ...fields, _docType: docType } as ExtractedDoc["fields"] & { _docType: ExtractedDoc["docType"] };
}

type TesseractWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
const g = globalThis as unknown as { __ocrWorker?: Promise<TesseractWorker> };

async function ocrWorker(): Promise<TesseractWorker> {
  if (!g.__ocrWorker) {
    g.__ocrWorker = import("tesseract.js").then(({ createWorker }) => createWorker("eng"));
  }
  return g.__ocrWorker;
}

/** Plain on-device OCR (no document parsing). Used by Scam Shield to read a forwarded screenshot; nothing is stored. */
export async function ocrPlainText(image: Buffer): Promise<string> {
  const worker = await ocrWorker();
  const { data } = await worker.recognize(image, { rotateAuto: true });
  return data.text ?? "";
}

async function extractWithTesseract(image: Buffer): Promise<ExtractedDoc> {
  const worker = await ocrWorker();
  const { data } = await worker.recognize(image, { rotateAuto: true });
  const { _docType, ...fields } = parseOcrText(data.text);
  const confidence = Math.max(0, Math.min(1, (data.confidence ?? 0) / 100));
  const qualityIssues: string[] = [];
  if (Math.abs(data.rotateRadians ?? 0) > 0.02) qualityIssues.push("rotated");
  const keyField = { gst_certificate: fields.gstin, udyam_certificate: fields.enterpriseName, address_proof: fields.billDate, signatory_id: fields.signatoryName, unknown: undefined }[_docType];
  const legible = confidence >= 0.55 && _docType !== "unknown" && !!keyField;
  if (!legible) qualityIssues.push(confidence < 0.55 ? "blurred" : "key details unreadable");
  return { docType: _docType, legible, qualityIssues, confidence, fields };
}

export async function extractDocument(image: Buffer, mediaType: "image/png" | "image/jpeg" | "image/webp", hint?: DocType): Promise<ExtractionResult> {
  const t0 = Date.now();
  for (const provider of aiProviders()) {
    try {
      const [extract, engine] = ENGINES[provider];
      const doc = await extract(image, mediaType);
      if (doc) return { doc: withHint(doc, hint), engine, ms: Date.now() - t0 };
    } catch (err) {
      // Fall through to the next provider, then on-device OCR, so KYC never blocks on a model.
      const status = err instanceof GeminiError || err instanceof GroqError || err instanceof Anthropic.APIError ? err.status : undefined;
      // A 429 here is the vision model's own rate limit; don't pause the advisor for it.
      if (status && [401, 402, 403].includes(status)) pauseProvider(provider, status);
      console.warn(`[extract] ${provider} vision failed (${status ?? (err as Error).message}); trying next engine`);
    }
  }
  const doc = await extractWithTesseract(image);
  return { doc: withHint(doc, hint), engine: "tesseract", ms: Date.now() - t0 };
}

function withHint(doc: ExtractedDoc, hint?: DocType): ExtractedDoc {
  return doc.docType === "unknown" && hint ? { ...doc, docType: hint } : doc;
}
