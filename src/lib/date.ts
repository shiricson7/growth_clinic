import { format, isValid, parseISO } from "date-fns";

export const parseDate = (value: string) => parseISO(value);

export const isValidDate = (value: string) => {
  const parsed = parseISO(value);
  return isValid(parsed);
};

export const toTimestamp = (value: string) => {
  if (!value) return 0;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed.getTime() : 0;
};

export const formatDisplayDate = (value: string) => {
  if (!value) return "-";
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  return format(parsed, "yyyy.MM.dd");
};

export const formatInputDate = (date: Date) => format(date, "yyyy-MM-dd");

export const todayIso = () => format(new Date(), "yyyy-MM-dd");
