export type Metric = "height" | "weight";

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

const MAX_REFERENCE_MONTHS = 60;

const referenceCache: Record<Metric, GrowthPoint[]> = {
  height: [],
  weight: [],
};

function baseHeight(ageMonths: number) {
  if (ageMonths <= 12) return 50 + ageMonths * 2.1;
  if (ageMonths <= 24) return 75.2 + (ageMonths - 12) * 1.0;
  return 87.2 + (ageMonths - 24) * 0.5;
}

function baseWeight(ageMonths: number) {
  if (ageMonths <= 12) return 3.3 + ageMonths * 0.52;
  if (ageMonths <= 24) return 9.5 + (ageMonths - 12) * 0.25;
  return 12.5 + (ageMonths - 24) * 0.15;
}

function spread(metric: Metric, ageMonths: number) {
  if (metric === "height") return 5.2 + ageMonths * 0.03;
  return 1.6 + ageMonths * 0.02;
}

function generateReference(metric: Metric) {
  if (referenceCache[metric].length > 0) return referenceCache[metric];
  const points: GrowthPoint[] = [];
  for (let m = 0; m <= MAX_REFERENCE_MONTHS; m += 1) {
    const p50 = metric === "height" ? baseHeight(m) : baseWeight(m);
    const s = spread(metric, m);
    points.push({
      ageMonths: m,
      p3: Number((p50 - s).toFixed(2)),
      p50: Number(p50.toFixed(2)),
      p97: Number((p50 + s).toFixed(2)),
    });
  }
  referenceCache[metric] = points;
  return points;
}

function interpolate(a: GrowthPoint, b: GrowthPoint, age: number): GrowthPoint {
  const t = (age - a.ageMonths) / (b.ageMonths - a.ageMonths);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    ageMonths: age,
    p3: lerp(a.p3, b.p3),
    p50: lerp(a.p50, b.p50),
    p97: lerp(a.p97, b.p97),
  };
}

export function getReference(metric: Metric): GrowthPoint[] {
  return generateReference(metric);
}

export function getReferenceAtAge(metric: Metric, ageMonths: number): GrowthPoint {
  const ref = generateReference(metric);
  if (ageMonths <= 0) return ref[0];
  if (ageMonths >= ref[ref.length - 1].ageMonths) {
    const last = ref[ref.length - 1];
    const prev = ref[ref.length - 2];
    const delta = ageMonths - last.ageMonths;
    return {
      ageMonths,
      p3: last.p3 + (last.p3 - prev.p3) * delta,
      p50: last.p50 + (last.p50 - prev.p50) * delta,
      p97: last.p97 + (last.p97 - prev.p97) * delta,
    };
  }
  const lower = Math.floor(ageMonths);
  const upper = Math.ceil(ageMonths);
  if (lower === upper) return ref[lower];
  return interpolate(ref[lower], ref[upper], ageMonths);
}

export function valueAtPercentile(
  metric: Metric,
  ageMonths: number,
  percentile: number
) {
  const ref = getReferenceAtAge(metric, ageMonths);
  const p = Math.min(97, Math.max(3, percentile));
  const t = (p - 3) / 94;
  return Number((ref.p3 + (ref.p97 - ref.p3) * t).toFixed(2));
}

export function percentileFromValue(
  metric: Metric,
  ageMonths: number,
  value: number
) {
  const ref = getReferenceAtAge(metric, ageMonths);
  if (value <= ref.p3) return 3;
  if (value >= ref.p97) return 97;
  const t = (value - ref.p3) / (ref.p97 - ref.p3);
  return Number((3 + t * 94).toFixed(1));
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
  ageMonths: number,
  percentile: number
) {
  const months = [3, 6, 12];
  return months.map((m) => ({
    ageMonths: Number((ageMonths + m).toFixed(1)),
    value: valueAtPercentile(metric, ageMonths + m, percentile),
  }));
}

export function getHistory(
  metric: Metric,
  ageMonths: number,
  percentile: number
) {
  const monthsBack = [12, 6, 3];
  return monthsBack
    .map((m) => ageMonths - m)
    .filter((m) => m > 0)
    .map((age) => {
      const noise =
        metric === "height"
          ? Math.sin(age / 3) * 0.6
          : Math.sin(age / 4) * 0.2;
      return {
        ageMonths: Number(age.toFixed(1)),
        value: Number((valueAtPercentile(metric, age, percentile) + noise).toFixed(2)),
      };
    });
}

export function buildChartData(
  metric: Metric,
  ageMonths: number,
  percentile: number,
  _currentValue: number,
  patientHistory: PatientPoint[] = []
) {
  const maxAge = Math.max(MAX_REFERENCE_MONTHS, Math.ceil(ageMonths + 12));
  const reference = Array.from({ length: maxAge + 1 }, (_, idx) =>
    getReferenceAtAge(metric, idx)
  );
  const predictions = getPredictions(metric, ageMonths, percentile);

  const patientMap = new Map<number, number>();
  patientHistory.forEach((item) => patientMap.set(Math.round(item.ageMonths), item.value));

  const predictedMap = new Map<number, number>();
  predictions.forEach((item) =>
    predictedMap.set(Math.round(item.ageMonths), item.value)
  );

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
