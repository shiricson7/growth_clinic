type Sex = "male" | "female";

export function normalizeRrn(input: string): string {
  return input.replace(/\D/g, "").slice(0, 13);
}

function inferCenturyBase(code: number): number | null {
  if (code === 1 || code === 2) return 1900;
  if (code === 3 || code === 4) return 2000;
  if (code === 9 || code === 0) return 1800;
  return null;
}

function inferSex(code: number): Sex | null {
  if (code === 1 || code === 3 || code === 9) return "male";
  if (code === 2 || code === 4 || code === 0) return "female";
  return null;
}

function toValidDateParts(year: number, month: number, day: number) {
  const safeMonth = Number.isFinite(month) ? Math.min(12, Math.max(1, month)) : 1;
  const lastDay = new Date(year, safeMonth, 0).getDate();
  const safeDay = Number.isFinite(day) ? Math.min(lastDay, Math.max(1, day)) : 1;
  return { year, month: safeMonth, day: safeDay };
}

export function isValidRrn(rrnDigits: string): boolean {
  return /^\d{13}$/.test(rrnDigits);
}

export function deriveRrnInfo(
  rrnDigits: string
): { birthDate: string | null; sex: Sex | null } {
  if (!/^\d{6,}$/.test(rrnDigits)) {
    return { birthDate: null, sex: null };
  }
  const yy = Number(rrnDigits.slice(0, 2));
  const mm = Number(rrnDigits.slice(2, 4));
  const dd = Number(rrnDigits.slice(4, 6));
  const code = rrnDigits.length >= 7 ? Number(rrnDigits[6]) : Number.NaN;
  const centuryBase = Number.isNaN(code) ? null : inferCenturyBase(code);
  const fallbackCentury = (() => {
    const currentYear = new Date().getFullYear() % 100;
    return yy <= currentYear ? 2000 : 1900;
  })();
  const year = (centuryBase ?? fallbackCentury) + yy;
  const safeDate = toValidDateParts(year, mm, dd);
  const birthDate = `${safeDate.year.toString().padStart(4, "0")}-${safeDate.month
    .toString()
    .padStart(2, "0")}-${safeDate.day.toString().padStart(2, "0")}`;

  return {
    birthDate,
    sex: rrnDigits.length >= 7 ? inferSex(code) : null,
  };
}

export function parseRrn(rrnDigits: string): { birthDate: string; sex: Sex } {
  if (!isValidRrn(rrnDigits)) {
    throw new Error("Invalid RRN");
  }
  const code = Number(rrnDigits[6]);
  const centuryBase = inferCenturyBase(code);
  if (!centuryBase) {
    throw new Error("Invalid RRN");
  }
  const yy = Number(rrnDigits.slice(0, 2));
  const mm = Number(rrnDigits.slice(2, 4));
  const dd = Number(rrnDigits.slice(4, 6));
  const year = centuryBase + yy;
  const safeDate = toValidDateParts(year, mm, dd);

  const birthDate = `${safeDate.year.toString().padStart(4, "0")}-${safeDate.month
    .toString()
    .padStart(2, "0")}-${safeDate.day.toString().padStart(2, "0")}`;

  const sex = inferSex(code);
  if (!sex) {
    throw new Error("Invalid RRN");
  }
  return { birthDate, sex };
}
