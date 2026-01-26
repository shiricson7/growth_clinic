import { GROWTH_STANDARDS, GrowthStandard } from "@/lib/data/standards";

export type Metric = "height" | "weight";
export type SexCode = 1 | 2;
export type SexInput = SexCode | "male" | "female" | "" | null | undefined;

export type GrowthPoint = {
  ageMonths: number;
  p3: number;
  p50: number;
  p97: number;
};

export type ChartPoint = {
  ageMonths: number;
  p3: number;
  p50: number;
  p97: number;
  patient?: number;
  predicted?: number;
};

export type PatientPoint = {
  ageMonths: number;
  value: number;
};

export const toSexCode = (sex: SexInput): SexCode => {
  if (sex === 2 || sex === "female") return 2;
  return 1;
};

const buildStandardsIndex = (metric: Metric) => {
  const index: Record<SexCode, GrowthStandard[]> = { 1: [], 2: [] };
  GROWTH_STANDARDS[metric].forEach((std) => {
    index[std.sex][std.age_month] = std;
  });
  return index;
};

const STANDARDS_BY_METRIC = {
  height: buildStandardsIndex("height"),
  weight: buildStandardsIndex("weight"),
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const interpolateStandard = (
  a: GrowthStandard,
  b: GrowthStandard,
  ageMonths: number
): GrowthStandard => {
  const span = b.age_month - a.age_month;
  if (span === 0) return { ...a, age_month: ageMonths };
  const t = (ageMonths - a.age_month) / span;
  return {
    sex: a.sex,
    age_month: ageMonths,
    L: lerp(a.L, b.L, t),
    M: lerp(a.M, b.M, t),
    S: lerp(a.S, b.S, t),
    p3: lerp(a.p3, b.p3, t),
    p50: lerp(a.p50, b.p50, t),
    p97: lerp(a.p97, b.p97, t),
  };
};

const getMaxAge = (metric: Metric, sex: SexCode) => {
  const table = STANDARDS_BY_METRIC[metric][sex];
  return table.length ? table.length - 1 : 0;
};

const getStandardAtAge = (
  metric: Metric,
  sexInput: SexInput,
  ageMonths: number
): GrowthStandard | null => {
  const sex = toSexCode(sexInput);
  const table = STANDARDS_BY_METRIC[metric][sex];
  if (!table.length) return null;
  const maxAge = getMaxAge(metric, sex);
  const clampedAge = Math.max(0, Math.min(ageMonths, maxAge));
  const lower = Math.floor(clampedAge);
  const upper = Math.ceil(clampedAge);
  const lowerStd = table[lower];
  const upperStd = table[upper] ?? lowerStd;
  if (!lowerStd) return null;
  if (!upperStd || lower === upper) {
    return { ...lowerStd, age_month: clampedAge };
  }
  return interpolateStandard(lowerStd, upperStd, clampedAge);
};

export function getReference(metric: Metric, sexInput: SexInput): GrowthPoint[] {
  const sex = toSexCode(sexInput);
  return STANDARDS_BY_METRIC[metric][sex]
    .filter(Boolean)
    .map((std) => ({
      ageMonths: std.age_month,
      p3: std.p3,
      p50: std.p50,
      p97: std.p97,
    }));
}

export function getReferenceAtAge(
  metric: Metric,
  sexInput: SexInput,
  ageMonths: number
): GrowthPoint {
  const std = getStandardAtAge(metric, sexInput, ageMonths);
  if (!std) {
    return { ageMonths, p3: 0, p50: 0, p97: 0 };
  }
  return {
    ageMonths,
    p3: std.p3,
    p50: std.p50,
    p97: std.p97,
  };
}

const lmsZScoreFromValue = (value: number, std: GrowthStandard) => {
  if (value <= 0) return -6;
  if (std.L === 0) {
    return Math.log(value / std.M) / std.S;
  }
  return (Math.pow(value / std.M, std.L) - 1) / (std.L * std.S);
};

const lmsValueFromZScore = (z: number, std: GrowthStandard) => {
  if (std.L === 0) {
    return std.M * Math.exp(std.S * z);
  }
  const inner = 1 + std.L * std.S * z;
  if (inner <= 0) return 0;
  return std.M * Math.pow(inner, 1 / std.L);
};

const erf = (x: number) => {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-absX * absX);
  return sign * y;
};

const normalCdf = (z: number) => 0.5 * (1 + erf(z / Math.sqrt(2)));

const inverseNormalCdf = (p: number) => {
  const clamped = Math.min(0.999999, Math.max(0.000001, p));
  const a1 = -3.969683028665376e+01;
  const a2 = 2.209460984245205e+02;
  const a3 = -2.759285104469687e+02;
  const a4 = 1.38357751867269e+02;
  const a5 = -3.066479806614716e+01;
  const a6 = 2.506628277459239e+00;

  const b1 = -5.447609879822406e+01;
  const b2 = 1.615858368580409e+02;
  const b3 = -1.556989798598866e+02;
  const b4 = 6.680131188771972e+01;
  const b5 = -1.328068155288572e+01;

  const c1 = -7.784894002430293e-03;
  const c2 = -3.223964580411365e-01;
  const c3 = -2.400758277161838e+00;
  const c4 = -2.549732539343734e+00;
  const c5 = 4.374664141464968e+00;
  const c6 = 2.938163982698783e+00;

  const d1 = 7.784695709041462e-03;
  const d2 = 3.224671290700398e-01;
  const d3 = 2.445134137142996e+00;
  const d4 = 3.754408661907416e+00;

  const plow = 0.02425;
  const phigh = 1 - plow;

  if (clamped < plow) {
    const q = Math.sqrt(-2 * Math.log(clamped));
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }

  if (clamped > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - clamped));
    return -(
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }

  const q = clamped - 0.5;
  const r = q * q;
  return (
    (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
    (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  );
};

const zScoreToPercentile = (z: number) => {
  const percentile = normalCdf(z) * 100;
  return Math.min(100, Math.max(0, percentile));
};

const percentileToZScore = (percentile: number) => {
  const clamped = Math.min(99.999, Math.max(0.001, percentile));
  return inverseNormalCdf(clamped / 100);
};

export function valueAtPercentile(
  metric: Metric,
  sexInput: SexInput,
  ageMonths: number,
  percentile: number
) {
  const std = getStandardAtAge(metric, sexInput, ageMonths);
  if (!std) return 0;
  const z = percentileToZScore(percentile);
  const value = lmsValueFromZScore(z, std);
  return Number(value.toFixed(2));
}

export function percentileFromValue(
  metric: Metric,
  sexInput: SexInput,
  ageMonths: number,
  value: number
) {
  const std = getStandardAtAge(metric, sexInput, ageMonths);
  if (!std) return 0;
  const z = lmsZScoreFromValue(value, std);
  return Number(zScoreToPercentile(z).toFixed(1));
}

export function getAgeMonths(birthDate: string, measurementDate: string): number {
  if (!birthDate || !measurementDate) return 0;
  const birth = new Date(birthDate);
  const measurement = new Date(measurementDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(measurement.getTime())) return 0;
  const years = measurement.getFullYear() - birth.getFullYear();
  const months = measurement.getMonth() - birth.getMonth();
  const days = measurement.getDate() - birth.getDate();
  let total = years * 12 + months + days / 30;
  if (total < 0) total = 0;
  return Number(total.toFixed(1));
}

export function getPredictions(
  metric: Metric,
  sexInput: SexInput,
  ageMonths: number,
  percentile: number
) {
  const months = [3, 6, 12];
  return months.map((m) => ({
    ageMonths: Number((ageMonths + m).toFixed(1)),
    value: valueAtPercentile(metric, sexInput, ageMonths + m, percentile),
  }));
}

export function getHistory(
  metric: Metric,
  sexInput: SexInput,
  ageMonths: number,
  percentile: number
) {
  const monthsBack = [12, 6, 3];
  return monthsBack
    .map((m) => ageMonths - m)
    .filter((m) => m > 0)
    .map((age) => {
      const noise = metric === "height" ? Math.sin(age / 3) * 0.6 : Math.sin(age / 4) * 0.2;
      return {
        ageMonths: Number(age.toFixed(1)),
        value: Number(
          (valueAtPercentile(metric, sexInput, age, percentile) + noise).toFixed(2)
        ),
      };
    });
}

export function buildChartData(
  metric: Metric,
  sexInput: SexInput,
  ageMonths: number,
  percentile: number,
  _currentValue: number,
  patientHistory: PatientPoint[] = []
) {
  const referenceBase = getReference(metric, sexInput);
  const referenceMax = referenceBase.length
    ? referenceBase[referenceBase.length - 1].ageMonths
    : 0;
  const maxAge = Math.max(referenceMax, Math.ceil(ageMonths + 12));
  const reference = Array.from({ length: maxAge + 1 }, (_, idx) =>
    getReferenceAtAge(metric, sexInput, idx)
  );
  const predictions = getPredictions(metric, sexInput, ageMonths, percentile);

  const patientMap = new Map<number, number>();
  patientHistory.forEach((item) => patientMap.set(Math.round(item.ageMonths), item.value));

  const predictedMap = new Map<number, number>();
  predictions.forEach((item) => predictedMap.set(Math.round(item.ageMonths), item.value));

  const chartData: ChartPoint[] = reference.map((point) => ({
    ageMonths: point.ageMonths,
    p3: Number(point.p3.toFixed(2)),
    p50: Number(point.p50.toFixed(2)),
    p97: Number(point.p97.toFixed(2)),
    patient: patientMap.get(point.ageMonths),
    predicted: predictedMap.get(point.ageMonths),
  }));

  return { chartData, history: patientHistory, predictions };
}
