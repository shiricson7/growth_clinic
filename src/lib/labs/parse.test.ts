import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseResultsFromText } from "./parse";
import { extractTextFromPdf } from "./extract";

const sampleText = `
검체접수일 2025-04-18
HbA1C 5.5
Free T4 1.32 / TSH 1.29
LH 0.48 / FSH 2.90
Testosterone <0.03
IGF-BP3 3626 / Somatomedin-C (IGF-1) 108.0
DHEA-S 120
`;

describe("parseResultsFromText", () => {
  it("parses collectedAt and lab values", () => {
    const result = parseResultsFromText(sampleText);
    expect(result.collectedAt).toBe("2025-04-18");
    expect(result.results.hba1c?.valueRaw).toBe("5.5");
    expect(result.results.ft4?.valueRaw).toBe("1.32");
    expect(result.results.tsh?.valueRaw).toBe("1.29");
    expect(result.results.lh?.valueRaw).toBe("0.48");
    expect(result.results.fsh?.valueRaw).toBe("2.90");
    expect(result.results.testosterone?.valueRaw).toBe("<0.03");
    expect(result.results.igfbp3?.valueRaw).toBe("3626");
    expect(result.results.igf1?.valueRaw).toBe("108.0");
    expect(result.results.dhea?.valueRaw).toBe("120");
  });
});

describe("extractTextFromPdf", () => {
  it("extracts sample PDF and parses key results", async () => {
    const filePath = path.resolve(process.cwd(), "mnt/data/sample.pdf");
    const buffer = fs.readFileSync(filePath);
    const extracted = await extractTextFromPdf(buffer);
    expect(extracted.fullText.length).toBeGreaterThan(20);
    const parsed = parseResultsFromText(extracted.fullText);
    expect(parsed.collectedAt).toBeDefined();
    expect(parsed.results.hba1c).toBeDefined();
    expect(parsed.results.ft4).toBeDefined();
    expect(parsed.results.tsh).toBeDefined();
    expect(parsed.results.lh).toBeDefined();
    expect(parsed.results.fsh).toBeDefined();
    expect(parsed.results.testosterone).toBeDefined();
    expect(parsed.results.igfbp3).toBeDefined();
    expect(parsed.results.igf1).toBeDefined();
  });
});
