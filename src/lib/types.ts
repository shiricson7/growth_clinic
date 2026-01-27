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

export type PatientInfo = {
  name: string;
  chartNumber: string;
  rrn: string;
  sex: "male" | "female" | "";
  birthDate: string;
  boneAge?: string;
  hormoneLevels?: string;
};
