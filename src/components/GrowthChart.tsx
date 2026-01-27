"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import type { Measurement, TherapyCourse } from "@/lib/types";
import {
  ChartPoint,
  Metric,
  SexInput,
  getAgeMonths,
  percentileFromValue,
} from "@/lib/percentileLogic";
import { toTimestamp } from "@/lib/date";

const bandStyles: Record<"GH" | "GNRH", { fill: string; stroke: string; label: string }> = {
  GH: {
    fill: "rgba(96,165,250,0.18)",
    stroke: "rgba(59,130,246,0.4)",
    label: "GH",
  },
  GNRH: {
    fill: "rgba(253,186,116,0.2)",
    stroke: "rgba(251,146,60,0.4)",
    label: "GnRH",
  },
};

const formatChartDate = (value: number) => format(new Date(value), "MM.dd");

const formatTooltipDate = (value: number) => format(new Date(value), "yyyy.MM.dd");

const buildDomain = (values: number[]) => {
  if (values.length === 0) return [0, 1] as [number, number];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.1, 1);
  return [min - padding, max + padding] as [number, number];
};

const legendDot = (color: string, text: string) => (
  <div className="flex items-center gap-2 text-xs text-[#475569]">
    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    <span>{text}</span>
  </div>
);

const legendBand = (color: string, text: string) => (
  <div className="flex items-center gap-2 text-xs text-[#475569]">
    <span
      className="h-2 w-4 rounded-sm"
      style={{ backgroundColor: color }}
    />
    <span>{text}</span>
  </div>
);

const formatPercentileLabel = (value: number) =>
  Number.isInteger(value) ? `${value}` : value.toFixed(1);

interface LegacyGrowthChartProps {
  metric: Metric;
  chartData: ChartPoint[];
  currentAgeMonths: number;
  sex: SexInput;
}

interface ModernGrowthChartProps {
  measurements: Measurement[];
  therapyCourses: TherapyCourse[];
  birthDate: string;
  sex: SexInput;
}

type GrowthChartProps = LegacyGrowthChartProps | ModernGrowthChartProps;

const isLegacyProps = (props: GrowthChartProps): props is LegacyGrowthChartProps =>
  "chartData" in props && "metric" in props;

function LegacyGrowthChart({ metric, chartData, currentAgeMonths, sex }: LegacyGrowthChartProps) {
  const maxAge = chartData.length ? chartData[chartData.length - 1].ageMonths : 0;
  const patientAges = chartData
    .filter((point) => typeof point.patient === "number")
    .map((point) => point.ageMonths);
  const earliestPatientAge = patientAges.length ? Math.min(...patientAges) : 0;
  const minAge = Math.max(0, earliestPatientAge - 6);
  const step = 6;
  const start = Math.max(0, Math.floor(minAge));
  const end = Math.max(start, Math.round(maxAge));
  const ticks: number[] = [];
  const firstTick = Math.floor(start / step) * step;
  for (let m = firstTick; m <= end; m += step) {
    ticks.push(m);
  }
  if (ticks.length === 0 || ticks[ticks.length - 1] !== end) {
    ticks.push(end);
  }

  const formatAgeLabel = (rawMonths: number) => {
    const months = Math.round(rawMonths);
    if (months >= 60) {
      const years = Math.floor(months / 12);
      const remainder = months % 12;
      return remainder === 0 ? `${years}세` : `${years}세 ${remainder}개월`;
    }
    return `${months}개월`;
  };

  return (
    <div className="h-full w-full rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[#8b8fa3]">{metric}</p>
          <p className="text-sm text-[#1a1c24]">P3–P97 범위를 함께 보여드려요.</p>
        </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="bandGradientLegacy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dff7ee" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#f4e7ff" stopOpacity={0.4} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="ageMonths"
              type="number"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              ticks={ticks}
              interval={0}
              minTickGap={14}
              tickMargin={8}
              domain={[minAge, maxAge]}
              allowDataOverflow
              tickFormatter={formatAgeLabel}
            />
            <YAxis hide domain={["dataMin - 3", "dataMax + 3"]} />

            <Tooltip
              cursor={{ stroke: "#b6c8ff", strokeDasharray: "4 4" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as ChartPoint;
                const value = point.patient ?? point.predicted;
                const percentile =
                  typeof value === "number"
                    ? percentileFromValue(metric, sex, point.ageMonths, value)
                    : null;
                return (
                  <div className="rounded-lg bg-[#1a1c24] px-3 py-2 text-xs text-white shadow-lg">
                    <div>
                      {formatAgeLabel(point.ageMonths)} · {value ? `${value}` : "데이터 없음"}
                    </div>
                    {percentile !== null && (
                      <div className="text-[10px] text-white/80">
                        P{formatPercentileLabel(percentile)}
                      </div>
                    )}
                  </div>
                );
              }}
            />

            <Area type="monotone" dataKey="p97" stroke="none" fill="url(#bandGradientLegacy)" />
            <Area type="monotone" dataKey="p3" stroke="none" fill="#ffffff" />

            <Line
              type="monotone"
              dataKey="p50"
              stroke="#c4b5fd"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="patient"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, payload, value } = props;
                if (cx === undefined || cy === undefined) return null;
                const numericValue =
                  typeof value === "number" ? value : (payload?.patient as number | undefined);
                if (typeof numericValue !== "number") return null;
                const ageMonths = payload?.ageMonths ?? 0;
                const percentile = percentileFromValue(metric, sex, ageMonths, numericValue);
                const isCurrent = Math.round(ageMonths) === Math.round(currentAgeMonths);
                const radius = isCurrent ? 6 : 4;
                return (
                  <g>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={isCurrent ? "#6366f1" : "#fff"}
                      stroke="#6366f1"
                      strokeWidth={2}
                    />
                    <text
                      x={cx}
                      y={cy - (isCurrent ? 12 : 10)}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={600}
                      fill="#6366f1"
                    >
                      P{formatPercentileLabel(percentile)}
                    </text>
                  </g>
                );
              }}
              activeDot={{ r: 6, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#f59e0b"
              strokeDasharray="5 4"
              strokeWidth={2}
              dot={{ r: 3, fill: "#fff7ed", stroke: "#f59e0b", strokeWidth: 1.5 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ModernGrowthChart({ measurements, therapyCourses, birthDate, sex }: ModernGrowthChartProps) {
  const sortedMeasurements = [...measurements].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  const chartData = sortedMeasurements.map((measurement) => ({
    isoDate: measurement.date,
    date: toTimestamp(measurement.date),
    height: measurement.heightCm ?? null,
    weight: measurement.weightKg ?? null,
    ageMonths: birthDate ? getAgeMonths(birthDate, measurement.date) : null,
  }));

  const chartDataWithPercentiles = chartData.map((item) => {
    const hasAge = typeof item.ageMonths === "number" && !Number.isNaN(item.ageMonths);
    const hasSex = sex === "male" || sex === "female" || sex === 1 || sex === 2;
    const canCompute = hasAge && hasSex;
    const heightPercentile =
      canCompute && typeof item.height === "number"
        ? percentileFromValue("height", sex, item.ageMonths as number, item.height)
        : null;
    const weightPercentile =
      canCompute && typeof item.weight === "number"
        ? percentileFromValue("weight", sex, item.ageMonths as number, item.weight)
        : null;
    return {
      ...item,
      heightPercentile,
      weightPercentile,
    };
  });

  const heightValues = chartData
    .map((item) => item.height)
    .filter((value): value is number => typeof value === "number");
  const weightValues = chartData
    .map((item) => item.weight)
    .filter((value): value is number => typeof value === "number");
  const allValues = [...heightValues, ...weightValues];

  const hasHeight = heightValues.length > 0;
  const hasWeight = weightValues.length > 0;

  const leftDomain = buildDomain(allValues.length ? allValues : heightValues);
  const rightDomain = buildDomain(weightValues);

  const minDate = chartData.length ? chartData[0].date : Date.now();
  const maxDate = chartData.length ? chartData[chartData.length - 1].date : Date.now();

  const today = Date.now();
  const normalizedCourses = therapyCourses
    .map((course) => {
      const start = toTimestamp(course.startDate);
      const end = course.endDate ? toTimestamp(course.endDate) : today;
      return {
        ...course,
        start,
        end: end >= start ? end : start,
      };
    })
    .sort((a, b) => a.start - b.start);

  return (
    <div className="h-full w-full rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[#8b8fa3]">
            성장 추적 차트
          </p>
          <p className="text-sm text-[#1a1c24]">
            치료 기간과 측정값을 한 눈에 확인하세요.
          </p>
        </div>
      </div>

      <div className="h-[360px] w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/70 text-sm text-[#94a3b8]">
            No data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartDataWithPercentiles} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <XAxis
                dataKey="date"
                type="number"
                scale="time"
                domain={[minDate, maxDate]}
                tickFormatter={formatChartDate}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                minTickGap={14}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                domain={leftDomain}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={40}
                hide={!hasHeight}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={rightDomain}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={40}
                hide={!hasWeight}
              />

              {normalizedCourses.map((course) => {
                const style = bandStyles[course.drug];
                const labelText = course.productName
                  ? `${style.label} · ${course.productName}`
                  : `${style.label} 시작`;
                return (
                  <ReferenceArea
                    key={course.id}
                    x1={course.start}
                    x2={course.end}
                    yAxisId="left"
                    y1={leftDomain[0]}
                    y2={leftDomain[1]}
                    fill={style.fill}
                    stroke={style.stroke}
                    label={{
                      value: labelText,
                      position: "insideTopLeft",
                      fill: style.stroke,
                      fontSize: 10,
                    }}
                  />
                );
              })}

              <Tooltip
                cursor={{ stroke: "#cbd5f5", strokeDasharray: "4 4" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload as {
                    date: number;
                    isoDate: string;
                    height: number | null;
                    weight: number | null;
                    heightPercentile: number | null;
                    weightPercentile: number | null;
                  };
                  return (
                    <div className="rounded-lg bg-[#1a1c24] px-3 py-2 text-xs text-white shadow-lg">
                      <p className="text-[11px] text-white/70">
                        {formatTooltipDate(data.date)}
                      </p>
                      <p>
                        ?: {data.height ?? "-"} cm{" "}
                        {data.heightPercentile !== null
                          ? `(P${formatPercentileLabel(data.heightPercentile)})`
                          : ""}
                      </p>
                      <p>
                        ???: {data.weight ?? "-"} kg{" "}
                        {data.weightPercentile !== null
                          ? `(P${formatPercentileLabel(data.weightPercentile)})`
                          : ""}
                      </p>
                    </div>
                  );
                }}
              />

              {hasHeight && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="height"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload, value } = props;
                    if (cx === undefined || cy === undefined) return null;
                    const numericValue =
                      typeof value === "number" ? value : (payload?.height as number | undefined);
                    if (typeof numericValue !== "number") return null;
                    const percentile =
                      typeof payload?.heightPercentile === "number" ? payload.heightPercentile : null;
                    return (
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={3}
                          fill="#fff"
                          stroke="#6366f1"
                          strokeWidth={2}
                        />
                        {percentile !== null && (
                          <text
                            x={cx}
                            y={cy - 10}
                            textAnchor="middle"
                            fontSize={10}
                            fontWeight={600}
                            fill="#6366f1"
                          >
                            P{formatPercentileLabel(percentile)}
                          </text>
                        )}
                      </g>
                    );
                  }}
                  connectNulls
                />
              )}
              {hasWeight && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="weight"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload, value } = props;
                    if (cx === undefined || cy === undefined) return null;
                    const numericValue =
                      typeof value === "number" ? value : (payload?.weight as number | undefined);
                    if (typeof numericValue !== "number") return null;
                    const percentile =
                      typeof payload?.weightPercentile === "number" ? payload.weightPercentile : null;
                    return (
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={3}
                          fill="#fff"
                          stroke="#f97316"
                          strokeWidth={2}
                        />
                        {percentile !== null && (
                          <text
                            x={cx}
                            y={cy + 14}
                            textAnchor="middle"
                            fontSize={10}
                            fontWeight={600}
                            fill="#f97316"
                          >
                            P{formatPercentileLabel(percentile)}
                          </text>
                        )}
                      </g>
                    );
                  }}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        {legendDot("#6366f1", "Height")}
        {legendDot("#f97316", "Weight")}
        {legendBand(bandStyles.GH.fill, "GH treatment")}
        {legendBand(bandStyles.GNRH.fill, "GnRH analog")}
      </div>
    </div>
  );
}

export default function GrowthChart(props: GrowthChartProps) {
  if (isLegacyProps(props)) {
    return <LegacyGrowthChart {...props} />;
  }
  return (
    <ModernGrowthChart
      measurements={props.measurements}
      therapyCourses={props.therapyCourses}
      birthDate={props.birthDate}
      sex={props.sex}
    />
  );
}
