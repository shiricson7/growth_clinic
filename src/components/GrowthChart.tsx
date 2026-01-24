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
import { Metric, ChartPoint } from "@/lib/percentileLogic";

const metricTitle: Record<Metric, string> = {
  height: "키 성장 곡선",
  weight: "몸무게 성장 곡선",
};

interface GrowthChartProps {
  metric: Metric;
  chartData: ChartPoint[];
  currentAgeMonths: number;
}

export default function GrowthChart({ metric, chartData, currentAgeMonths }: GrowthChartProps) {
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
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              interval={5}
            />
            <YAxis hide domain={["dataMin - 3", "dataMax + 3"]} />

            <Tooltip
              cursor={{ stroke: "#b6c8ff", strokeDasharray: "4 4" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as ChartPoint;
                const value = point.patient ?? point.predicted;
                return (
                  <div className="rounded-lg bg-[#1a1c24] px-3 py-2 text-xs text-white shadow-lg">
                    {point.ageMonths}개월 · {value ? `${value}` : "데이터 없음"}
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
                const isCurrent = Math.round(props.payload?.ageMonths) === Math.round(currentAgeMonths);
                const radius = isCurrent ? 6 : 4;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={radius}
                    fill={isCurrent ? "#6366f1" : "#fff"}
                    stroke="#6366f1"
                    strokeWidth={2}
                  />
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
