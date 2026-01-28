import { differenceInMonths, parseISO } from "date-fns";

export type Igf1ReferencePoint = {
  age: number; // years
  p2_5: number;
  p50: number;
  p97_5: number;
};

export type Igf1Reference = {
  p2_5: number;
  p50: number;
  p97_5: number;
};

const IGF1_ROCHE_REFERENCE: Record<"male" | "female", Igf1ReferencePoint[]> = {
  male: [
    { age: 0.25, p2_5: 26.3, p50: 77.1, p97_5: 237 },
    { age: 0.5, p2_5: 27.1, p50: 82.5, p97_5: 252 },
    { age: 1, p2_5: 29.0, p50: 94.5, p97_5: 309 },
    { age: 2, p2_5: 33.0, p50: 105, p97_5: 338 },
    { age: 3, p2_5: 38.8, p50: 118, p97_5: 365 },
    { age: 4, p2_5: 45.8, p50: 133, p97_5: 393 },
    { age: 5, p2_5: 53.8, p50: 150, p97_5: 424 },
    { age: 6, p2_5: 61.8, p50: 166, p97_5: 459 },
    { age: 7, p2_5: 68.1, p50: 185, p97_5: 501 },
    { age: 8, p2_5: 74.9, p50: 202, p97_5: 546 },
    { age: 9, p2_5: 80.6, p50: 219, p97_5: 594 },
    { age: 10, p2_5: 84.8, p50: 236, p97_5: 643 },
    { age: 11, p2_5: 89.4, p50: 253, p97_5: 694 },
    { age: 12, p2_5: 100, p50: 287, p97_5: 823 },
    { age: 13, p2_5: 119, p50: 344, p97_5: 996 },
    { age: 14, p2_5: 146, p50: 422, p97_5: 1220 },
    { age: 15, p2_5: 182, p50: 520, p97_5: 1480 },
    { age: 16, p2_5: 220, p50: 616, p97_5: 1720 },
    { age: 17, p2_5: 251, p50: 694, p97_5: 1920 },
  ],
  female: [
    { age: 0.25, p2_5: 26.2, p50: 69.9, p97_5: 186 },
    { age: 0.5, p2_5: 27.1, p50: 74.6, p97_5: 201 },
    { age: 1, p2_5: 29.1, p50: 84.0, p97_5: 238 },
    { age: 2, p2_5: 32.8, p50: 93.8, p97_5: 264 },
    { age: 3, p2_5: 39.2, p50: 105, p97_5: 287 },
    { age: 4, p2_5: 46.6, p50: 119, p97_5: 312 },
    { age: 5, p2_5: 55.0, p50: 134, p97_5: 339 },
    { age: 6, p2_5: 62.6, p50: 150, p97_5: 371 },
    { age: 7, p2_5: 69.3, p50: 167, p97_5: 408 },
    { age: 8, p2_5: 76.6, p50: 185, p97_5: 449 },
    { age: 9, p2_5: 84.1, p50: 202, p97_5: 491 },
    { age: 10, p2_5: 90.9, p50: 219, p97_5: 533 },
    { age: 11, p2_5: 97.5, p50: 237, p97_5: 579 },
    { age: 12, p2_5: 106, p50: 266, p97_5: 678 },
    { age: 13, p2_5: 124, p50: 324, p97_5: 812 },
    { age: 14, p2_5: 150, p50: 404, p97_5: 992 },
    { age: 15, p2_5: 181, p50: 504, p97_5: 1200 },
    { age: 16, p2_5: 210, p50: 591, p97_5: 1390 },
    { age: 17, p2_5: 233, p50: 668, p97_5: 1570 },
  ],
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const interpolate = (a: number, b: number, t: number) => a + (b - a) * t;

export const getAgeYears = (birthDate: string, sampleDate: string) => {
  if (!birthDate || !sampleDate) return null;
  const birth = parseISO(birthDate);
  const sample = parseISO(sampleDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(sample.getTime())) return null;
  const months = differenceInMonths(sample, birth);
  return clamp(months / 12, 0, 120);
};

export const getIgf1Reference = (
  sex: "male" | "female",
  ageYears: number
): Igf1Reference | null => {
  const table = IGF1_ROCHE_REFERENCE[sex];
  if (!table.length) return null;
  const clampedAge = clamp(ageYears, table[0].age, table[table.length - 1].age);
  const upperIndex = table.findIndex((point) => point.age >= clampedAge);
  if (upperIndex <= 0) {
    const point = table[0];
    return { p2_5: point.p2_5, p50: point.p50, p97_5: point.p97_5 };
  }
  const upper = table[upperIndex];
  const lower = table[upperIndex - 1] ?? upper;
  if (!upper || !lower) return null;
  if (upper.age === lower.age) {
    return { p2_5: upper.p2_5, p50: upper.p50, p97_5: upper.p97_5 };
  }
  const t = (clampedAge - lower.age) / (upper.age - lower.age);
  return {
    p2_5: interpolate(lower.p2_5, upper.p2_5, t),
    p50: interpolate(lower.p50, upper.p50, t),
    p97_5: interpolate(lower.p97_5, upper.p97_5, t),
  };
};

export const estimateIgf1Percentile = (value: number, ref: Igf1Reference) => {
  const v = clamp(value, 0, ref.p97_5 * 1.6);
  if (v <= ref.p2_5) {
    return clamp((v / ref.p2_5) * 2.5, 0.1, 2.5);
  }
  if (v <= ref.p50) {
    const t = (v - ref.p2_5) / (ref.p50 - ref.p2_5);
    return 2.5 + t * 47.5;
  }
  if (v <= ref.p97_5) {
    const t = (v - ref.p50) / (ref.p97_5 - ref.p50);
    return 50 + t * 47.5;
  }
  const t = (v - ref.p97_5) / Math.max(ref.p97_5, 1);
  return clamp(97.5 + t * 2.5, 97.5, 99.9);
};

export const formatIgf1Range = (ref: Igf1Reference) =>
  `${ref.p2_5.toFixed(0)}–${ref.p97_5.toFixed(0)}`;
