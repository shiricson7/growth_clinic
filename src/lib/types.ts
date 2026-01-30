import { NormalizedTestKey, ParsedResult } from "./labs/types";
export type { NormalizedTestKey, ParsedResult };

export type Measurement = {
  id: string;
  date: string; // ISO yyyy-MM-dd
  heightCm?: number;
  weightKg?: number;
  // Computed fields (optional)
  zHeight?: number | null;
  zWeight?: number | null;
  zBmi?: number | null;
  percentileHeight?: number | null;
  percentileWeight?: number | null;
  percentileBmi?: number | null;
};

export type TherapyCourse = {
  id: string;
  drug: "GH" | "GNRH";
  startDate: string; // ISO yyyy-MM-dd
  endDate?: string | null; // null/undefined = ongoing
  productName?: string;
  doseNote?: string;
  note?: string;
};

export type HormoneLevels = {
  LH?: string;
  FSH?: string;
  E2?: string;
  Testosterone?: string;
  TSH?: string;
  fT4?: string;
  DHEA?: string;
  IGF_BP3?: string;
  IGF_1?: string;
  HbA1c?: string;
};

export type PatientInfo = {
  name: string;
  chartNumber: string;
  rrn: string;
  sex: "male" | "female" | "";
  birthDate: string;
  boneAge?: string;
  boneAgeDate?: string;
  hormoneLevels?: HormoneLevels | string;
  hormoneTestDate?: string;
};

export type ChartSuggestion = {
  chartNumber: string;
  name: string;
  birthDate: string;
  sex: PatientInfo["sex"];
};

export type BoneAgeRecord = {
  id: string;
  measuredAt: string;
  boneAge: string;
};

export type LabPanelSummary = {
  id: string;
  collectedAt: string;
  results: Record<NormalizedTestKey, ParsedResult>;
};
