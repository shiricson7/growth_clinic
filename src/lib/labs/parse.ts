import type { NormalizedTestKey, ParsedResult, ParseOutput } from "./types";

const LABEL_MAP: Array<{
  key: NormalizedTestKey;
  label: string;
  patterns: RegExp[];
}> = [
  {
    key: "hba1c",
    label: "HbA1c",
    patterns: [/\bHbA1c\b/i, /HbA1C/i],
  },
  {
    key: "ft4",
    label: "Free T4",
    patterns: [/free\s*t4/i, /\bf\s*t4\b/i, /\bft4\b/i],
  },
  {
    key: "tsh",
    label: "TSH",
    patterns: [/\bTSH\b/i],
  },
  {
    key: "lh",
    label: "LH",
    patterns: [/\bLH\b/i],
  },
  {
    key: "fsh",
    label: "FSH",
    patterns: [/\bFSH\b/i],
  },
  {
    key: "testosterone",
    label: "Testosterone",
    patterns: [/testosterone/i],
  },
  {
    key: "estradiol",
    label: "Estradiol",
    patterns: [/\bE2\b/i, /estradiol/i],
  },
  {
    key: "igfbp3",
    label: "IGF-BP3",
    patterns: [/igf[-\s]?bp3/i, /igfbp-?3/i, /igf\s*bp3/i],
  },
  {
    key: "igf1",
    label: "IGF-1",
    patterns: [
      /\bigf[-\s]?1\b/i,
      /somatomedin[-\s]?c/i,
      /somatostatin[-\s]?c/i,
      /\(\s*igf-?1\s*\)/i,
    ],
  },
  {
    key: "dhea",
    label: "DHEA",
    patterns: [/dhea[-\s]?s/i, /dhea[-\s]?so4/i, /\bdhea\b/i],
  },
];

export const TEST_LABELS: Record<NormalizedTestKey, string> = LABEL_MAP.reduce(
  (acc, item) => ({ ...acc, [item.key]: item.label }),
  {} as Record<NormalizedTestKey, string>
);

const UNIT_REGEX =
  /(ng\/dL|ng\/mL|ug\/dL|µg\/dL|㎍\/dL|uIU\/mL|mIU\/mL|IU\/L|pg\/mL|%)/i;

const VALUE_REGEX = /([<>≤≥＜＞]?\s*\d+(?:\.\d+)?)/;

const normalizeDate = (raw: string) => {
  const normalized = raw.replace(/[./]/g, "-");
  const match = normalized.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
};

const extractCollectedAt = (line: string) => {
  const match = line.match(/(검체접수일|채혈일|검사일|접수일)\s*[:：]?\s*(\d{4}[./-]\d{2}[./-]\d{2})/);
  if (!match) return null;
  return normalizeDate(match[2]);
};

const extractValueFromLine = (line: string, pattern: RegExp) => {
  const regex = new RegExp(`${pattern.source}\\s*[:：]?\\s*([<>≤≥＜＞]?\\s*\\d+(?:\\.\\d+)?)`, "i");
  const match = line.match(regex);
  if (!match) return null;
  const rawValue = match[1].replace(/\s+/g, "");
  const unitMatch = line.match(UNIT_REGEX);
  const unit = unitMatch ? unitMatch[0] : null;
  const numeric = Number(rawValue.replace(/[<>≤≥＜＞]/g, ""));
  return {
    valueRaw: rawValue,
    valueNumeric: Number.isFinite(numeric) ? numeric : null,
    unit,
    matchedBy: match[0].trim(),
  };
};

export function parseResultsFromText(fullText: string): ParseOutput {
  const results: Record<NormalizedTestKey, ParsedResult> = {} as Record<
    NormalizedTestKey,
    ParsedResult
  >;
  const lines = fullText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let collectedAt: string | undefined;

  lines.forEach((line, index) => {
    if (!collectedAt) {
      const extracted = extractCollectedAt(line);
      if (extracted) {
        collectedAt = extracted;
      }
    }

    LABEL_MAP.forEach((label) => {
      label.patterns.forEach((pattern) => {
        if (!pattern.test(line)) return;
        const valueMatch = extractValueFromLine(line, pattern);
        if (!valueMatch) return;
        results[label.key] = {
          testKey: label.key,
          valueRaw: valueMatch.valueRaw,
          valueNumeric: valueMatch.valueNumeric,
          unit: valueMatch.unit,
          sourceLine: line,
          matchedBy: valueMatch.matchedBy || label.label,
        };
      });
    });

    if (!collectedAt && index < 5) {
      const dateMatch = line.match(/\d{4}[./-]\d{2}[./-]\d{2}/);
      if (dateMatch) {
        const normalized = normalizeDate(dateMatch[0]);
        if (normalized) collectedAt = normalized;
      }
    }
  });

  return { collectedAt, results };
}
