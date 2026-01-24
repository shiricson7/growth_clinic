type Sex = "male" | "female";

const WEIGHTS = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5] as const;

export function normalizeRrn(input: string): string {
  return input.replace(/\D/g, "");
}

function getCenturyAndSex(code: number): { century: number; sex: Sex } | null {
  if (code === 1 || code === 2) return { century: 1900, sex: code === 1 ? "male" : "female" };
  if (code === 3 || code === 4) return { century: 2000, sex: code === 3 ? "male" : "female" };
  if (code === 5 || code === 6) return { century: 1900, sex: code === 5 ? "male" : "female" };
  if (code === 7 || code === 8) return { century: 2000, sex: code === 7 ? "male" : "female" };
  return null;
}

function isValidDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function isValidRrn(rrnDigits: string): boolean {
  if (!/^\d{13}$/.test(rrnDigits)) return false;
  const code = Number(rrnDigits[6]);
  const info = getCenturyAndSex(code);
  if (!info) return false;

  const yy = Number(rrnDigits.slice(0, 2));
  const mm = Number(rrnDigits.slice(2, 4));
  const dd = Number(rrnDigits.slice(4, 6));
  const year = info.century + yy;

  if (!isValidDate(year, mm, dd)) return false;

  const digits = rrnDigits.split("").map((d) => Number(d));
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += digits[i] * WEIGHTS[i];
  }
  const check = (11 - (sum % 11)) % 10;
  return check === digits[12];
}

export function parseRrn(rrnDigits: string): { birthDate: string; sex: Sex } {
  if (!isValidRrn(rrnDigits)) {
    throw new Error("Invalid RRN");
  }
  const code = Number(rrnDigits[6]);
  const info = getCenturyAndSex(code);
  if (!info) {
    throw new Error("Invalid RRN");
  }
  const yy = Number(rrnDigits.slice(0, 2));
  const mm = Number(rrnDigits.slice(2, 4));
  const dd = Number(rrnDigits.slice(4, 6));
  const year = info.century + yy;

  const birthDate = `${year.toString().padStart(4, "0")}-${mm
    .toString()
    .padStart(2, "0")}-${dd.toString().padStart(2, "0")}`;

  return { birthDate, sex: info.sex };
}
