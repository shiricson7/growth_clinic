type Sex = "male" | "female";

export function normalizeRrn(input: string): string {
  return input.replace(/\D/g, "").slice(0, 13);
}

function inferCentury(code: number, yy: number): number {
  if (code === 1 || code === 2 || code === 5 || code === 6) return 1900;
  if (code === 3 || code === 4 || code === 7 || code === 8) return 2000;
  const currentYear = new Date().getFullYear() % 100;
  return yy <= currentYear ? 2000 : 1900;
}

function inferSex(code: number): Sex {
  return code % 2 === 1 ? "male" : "female";
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

export function parseRrn(rrnDigits: string): { birthDate: string; sex: Sex } {
  if (!isValidRrn(rrnDigits)) {
    throw new Error("Invalid RRN");
  }
  const code = Number(rrnDigits[6]);
  const yy = Number(rrnDigits.slice(0, 2));
  const mm = Number(rrnDigits.slice(2, 4));
  const dd = Number(rrnDigits.slice(4, 6));
  const year = inferCentury(code, yy);
  const safeDate = toValidDateParts(year, mm, dd);

  const birthDate = `${safeDate.year.toString().padStart(4, "0")}-${safeDate.month
    .toString()
    .padStart(2, "0")}-${safeDate.day.toString().padStart(2, "0")}`;

  return { birthDate, sex: inferSex(code) };
}
