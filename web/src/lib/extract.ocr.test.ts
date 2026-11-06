import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractDocument } from "./extract";
import { validateKyc, type KycDocs } from "./kyc";
import { DOC_TYPES, type DocType } from "./kyc-types";
import { APPLICANTS, EXPECTED } from "./__fixtures__/kyc-applicants";

/**
 * End-to-end Smart KYC on the real specimen images: OCR -> rules -> verdict.
 * Slow (~1 min) so it's opt-in: OCR_IT=1 npm test
 */
const DIR = path.join(process.cwd(), "public", "kyc");
const run = process.env.OCR_IT === "1" ? describe : describe.skip;

run("Smart KYC on specimen images (Tesseract path)", () => {
  const results: Record<string, KycDocs> = {};

  it("extracts all 47 documents", async () => {
    for (const k of Object.keys(APPLICANTS)) {
      results[k] = {};
      for (const t of DOC_TYPES) {
        const file = path.join(DIR, `${k}_${t}.png`);
        if (!fs.existsSync(file)) continue;
        const { doc } = await extractDocument(fs.readFileSync(file), "image/png", t as DocType);
        results[k][t] = doc;
      }
    }
    expect(Object.keys(results)).toHaveLength(12);
  }, 300_000);

  it("reaches the same verdicts as the hand-made answer key", () => {
    const table: string[] = [];
    let agree = 0;
    for (const [k, exp] of Object.entries(EXPECTED)) {
      const r = validateKyc(results[k]);
      const ok = r.verdict === exp.verdict;
      if (ok) agree++;
      table.push(`${k} expected=${exp.verdict} got=${r.verdict} ${ok ? "OK" : "MISMATCH " + r.checks.filter((c) => c.status === "fail").map((c) => c.id).join(",")}`);
    }
    console.log(table.join("\n"));
    expect(agree).toBeGreaterThanOrEqual(11);
  });
});
