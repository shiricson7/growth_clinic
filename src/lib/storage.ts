import type { Measurement, TherapyCourse } from "@/lib/types";

const MEASUREMENTS_KEY = "growth_measurements_v1";
const THERAPY_KEY = "growth_therapy_courses_v1";

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
};
