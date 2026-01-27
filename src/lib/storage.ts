import type { Measurement, TherapyCourse, PatientInfo } from "@/lib/types";

const MEASUREMENTS_KEY = "growth_measurements_v1";
const THERAPY_KEY = "growth_therapy_courses_v1";
const PATIENT_KEY = "growth_patient_v1";
const PATIENT_DIRECTORY_KEY = "growth_patient_directory_v1";
const PATIENT_DATA_PREFIX = "growth_patient_data_v1_";

export type PatientDirectoryEntry = {
  id: string;
  name: string;
  chartNumber: string;
  birthDate: string;
  sex: PatientInfo["sex"];
  updatedAt: string;
  measurementCount: number;
  therapyCount: number;
  lastMeasurementDate?: string;
};

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    return fallback;
  }
};

const hasWindow = () => typeof window !== "undefined";

export const loadMeasurements = (): Measurement[] => {
  if (!hasWindow()) return [];
  return safeParse<Measurement[]>(window.localStorage.getItem(MEASUREMENTS_KEY), []);
};

export const saveMeasurements = (measurements: Measurement[]) => {
  if (!hasWindow()) return;
  window.localStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(measurements));
};

export const loadTherapyCourses = (): TherapyCourse[] => {
  if (!hasWindow()) return [];
  return safeParse<TherapyCourse[]>(window.localStorage.getItem(THERAPY_KEY), []);
};

export const saveTherapyCourses = (courses: TherapyCourse[]) => {
  if (!hasWindow()) return;
  window.localStorage.setItem(THERAPY_KEY, JSON.stringify(courses));
};

export const clearGrowthStorage = () => {
  if (!hasWindow()) return;
  window.localStorage.removeItem(MEASUREMENTS_KEY);
  window.localStorage.removeItem(THERAPY_KEY);
  window.localStorage.removeItem(PATIENT_KEY);
  window.localStorage.removeItem(PATIENT_DIRECTORY_KEY);
  Object.keys(window.localStorage).forEach((key) => {
    if (key.startsWith(PATIENT_DATA_PREFIX)) {
      window.localStorage.removeItem(key);
    }
  });
};

export const loadPatientInfo = (): PatientInfo | null => {
  if (!hasWindow()) return null;
  return safeParse<PatientInfo | null>(
    window.localStorage.getItem(PATIENT_KEY),
    null
  );
};

export const savePatientInfo = (info: PatientInfo) => {
  if (!hasWindow()) return;
  window.localStorage.setItem(PATIENT_KEY, JSON.stringify(info));
};

export const loadPatientDirectory = (): PatientDirectoryEntry[] => {
  if (!hasWindow()) return [];
  return safeParse<PatientDirectoryEntry[]>(
    window.localStorage.getItem(PATIENT_DIRECTORY_KEY),
    []
  );
};

export const savePatientDirectory = (entries: PatientDirectoryEntry[]) => {
  if (!hasWindow()) return;
  window.localStorage.setItem(PATIENT_DIRECTORY_KEY, JSON.stringify(entries));
};

export const upsertPatientDirectory = (entry: PatientDirectoryEntry) => {
  const current = loadPatientDirectory();
  const filtered = current.filter((item) => item.id !== entry.id);
  savePatientDirectory([entry, ...filtered]);
};

export type PatientDataBundle = {
  patientInfo: PatientInfo;
  measurements: Measurement[];
  therapyCourses: TherapyCourse[];
};

const buildPatientDataKey = (key: string) => `${PATIENT_DATA_PREFIX}${key}`;

export const savePatientData = (key: string, payload: PatientDataBundle) => {
  if (!hasWindow()) return;
  if (!key) return;
  window.localStorage.setItem(buildPatientDataKey(key), JSON.stringify(payload));
};

export const loadPatientData = (key: string): PatientDataBundle | null => {
  if (!hasWindow()) return null;
  if (!key) return null;
  return safeParse<PatientDataBundle | null>(
    window.localStorage.getItem(buildPatientDataKey(key)),
    null
  );
};
