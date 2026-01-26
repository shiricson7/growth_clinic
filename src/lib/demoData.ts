import { addMonths, addWeeks, format } from "date-fns";
import type { Measurement, TherapyCourse } from "@/lib/types";

const toIso = (date: Date) => format(date, "yyyy-MM-dd");

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export const buildDemoMeasurements = (): Measurement[] => {
  const start = addMonths(new Date(), -6);
  const points = Array.from({ length: 8 }, (_, idx) => addWeeks(start, idx * 3));
  const baseHeight = 110;
  const baseWeight = 20;

  return points.map((date, idx) => ({
    id: createId(),
    date: toIso(date),
    heightCm: Number((baseHeight + idx * 1.6).toFixed(1)),
    weightKg: Number((baseWeight + idx * 0.6).toFixed(1)),
  }));
};

export const buildDemoTherapies = (measurements: Measurement[]): TherapyCourse[] => {
  if (measurements.length === 0) return [];
  const first = measurements[0].date;
  const firstDate = new Date(first);
  const ghStart = addMonths(firstDate, 2);
  const gnrhStart = addMonths(firstDate, 3);
  const gnrhEnd = addMonths(firstDate, 5);

  return [
    {
      id: createId(),
      drug: "GH",
      startDate: toIso(ghStart),
      endDate: null,
      productName: "Genotropin",
      doseNote: "0.3mg/kg",
      note: "성장호르몬 치료 시작",
    },
    {
      id: createId(),
      drug: "GNRH",
      startDate: toIso(gnrhStart),
      endDate: toIso(gnrhEnd),
      productName: "Lupron Depot",
      doseNote: "3.75mg",
      note: "사춘기 억제 치료",
    },
  ];
};
