export type Measurement = {
  id: string;
  date: string; // ISO yyyy-MM-dd
  heightCm?: number;
  weightKg?: number;
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
