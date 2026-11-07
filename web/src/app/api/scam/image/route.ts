import { ocrPlainText } from "@/lib/extract";
import { analyzeScam } from "@/lib/scam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024;

/** Scam Shield for screenshots: read the text on-device (Tesseract), analyse it, store nothing. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const lang = form?.get("lang") === "hi" ? "hi" : "en";
  if (!(file instanceof File)) return Response.json({ error: "Upload a screenshot (PNG or JPG)." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That image is too large (max 6 MB)." }, { status: 413 });
  let text = "";
  try {
    text = await ocrPlainText(Buffer.from(await file.arrayBuffer()));
  } catch {
    return Response.json({ error: "Could not read that image. Please upload a clear PNG or JPG screenshot, or paste the text." }, { status: 400 });
  }
  if (!text.trim()) return Response.json({ error: "I couldn't find any text in that picture. Try a clearer screenshot, or paste the message." }, { status: 422 });
  return Response.json({ ...analyzeScam(text, lang, true), ocrText: text.slice(0, 1200) });
}
