"use client";

import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Metric, ChartPoint, SexInput, percentileFromValue } from "@/lib/percentileLogic";

const metricTitle: Record<Metric, string> = {
  height: "키 성장 곡선",
  weight: "몸무게 성장 곡선",
};

const formatAgeLabel = (rawMonths: number) => {
  const months = Math.round(rawMonths);
  if (months >= 60) {
    const years = Math.floor(months / 12);
    const remainder = months % 12;
    return remainder === 0 ? `${years}세` : `${years}세 ${remainder}개월`;
  }
  return `${months}개월`;
};

const buildAgeTicks = (minAge: number, maxAge: number) => {
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
  return ticks;
};

const formatPercentileLabel = (value: number) =>
  Number.isInteger(value) ? `${value}` : value.toFixed(1);

interface GrowthChartProps {
  metric: Metric;
  chartData: ChartPoint[];
  currentAgeMonths: number;
  sex: SexInput;
}

export default function GrowthChart({ metric, chartData, currentAgeMonths, sex }: GrowthChartProps) {
  const maxAge = chartData.length ? chartData[chartData.length - 1].ageMonths : 0;
  const patientAges = chartData
    .filter((point) => typeof point.patient === "number")
    .map((point) => point.ageMonths);
  const earliestPatientAge = patientAges.length ? Math.min(...patientAges) : 0;
  const minAge = Math.max(0, earliestPatientAge - 6);
  const ageTicks = buildAgeTicks(minAge, maxAge);

  return (
    <div className="h-full w-full rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[#8b8fa3]">
            {metricTitle[metric]}
          </p>
          <p className="text-sm text-[#1a1c24]">P3–P97 범위를 함께 보여드려요.</p>
        </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
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
              ticks={ageTicks}
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

            <Area type="monotone" dataKey="p97" stroke="none" fill="url(#bandGradient)" />
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
