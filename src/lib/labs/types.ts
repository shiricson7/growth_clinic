export type NormalizedTestKey =
  | "hba1c"
  | "ft4"
  | "tsh"
  | "lh"
  | "fsh"
  | "testosterone"
  | "estradiol"
  | "igfbp3"
  | "igf1"
  | "dhea";

export type ParsedResult = {
  testKey: NormalizedTestKey;
  valueRaw: string;
  valueNumeric: number | null;
  unit: string | null;
  sourceLine: string;
  matchedBy: string;
};

export type ParseOutput = {
  collectedAt?: string;
  results: Record<NormalizedTestKey, ParsedResult>;
};

export type TextExtractionResult = {
  pages: string[];
  fullText: string;
  method: "pdf-text" | "ocr";
};
