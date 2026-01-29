"use client";

import { useMemo, useState, useId } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { addMonths, format, parseISO } from "date-fns";

type SnapshotPoint = { date: string; value: number };

type SnapshotTreatment = {
  id: string;
  type: "GH" | "GnRH";
  label: string;
  startDate: string;
  endDate?: string | null;
  note?: string;
};

type ParentSnapshotGrowthCardProps = {
  title: string;
  metric: "height" | "weight";
  unit: "cm" | "kg";
  mode?: "screen" | "report";
  updatedAt: string;
  data: {
    observed: SnapshotPoint[];
    current: { value: number; percentile: number; trend: "up" | "flat" | "down" };
    velocity: { value: number; unit: "cm/yr" | "kg/yr" };
  };
  treatments?: SnapshotTreatment[];
};

type LaneTreatment = SnapshotTreatment & {
  startTs: number;
  endTs: number;
  lane: number;
};

const getTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const trendIcon = {
  up: "↑",
  flat: "→",
  down: "↓",
};

const trendTone = {
  up: "text-emerald-600",
  flat: "text-slate-500",
  down: "text-rose-500",
};

const buildTreatmentLanes = (
  treatments: SnapshotTreatment[],
  rangeStart: number,
  rangeEnd: number,
  maxLanes = 2
) => {
  const clipped = treatments
    .map((treatment) => {
      const startTs = Math.max(getTimestamp(treatment.startDate), rangeStart);
      const rawEnd = treatment.endDate ? getTimestamp(treatment.endDate) : rangeEnd;
      const endTs = Math.min(rawEnd, rangeEnd);
      return { ...treatment, startTs, endTs };
    })
    .filter((item) => item.startTs && item.endTs && item.endTs >= rangeStart)
    .filter((item) => item.startTs <= rangeEnd)
    .sort((a, b) => a.startTs - b.startTs);

  const lanes: number[] = [];
  return clipped.map((item) => {
    let laneIndex = lanes.findIndex((end) => item.startTs > end);
    if (laneIndex === -1) {
      laneIndex = Math.min(lanes.length, maxLanes - 1);
    }
    lanes[laneIndex] = item.endTs;
    return { ...item, lane: laneIndex };
  }) as LaneTreatment[];
};

const formatTooltipDate = (value: string) => format(parseISO(value), "yyyy.MM.dd");

export default function ParentSnapshotGrowthCard({
  title,
  metric,
  unit,
  mode = "screen",
  updatedAt,
  data,
  treatments = [],
}: ParentSnapshotGrowthCardProps) {
  const isReport = mode === "report";
  const gradientId = useId();
  const rangeEnd = getTimestamp(updatedAt);
  const rangeStart = getTimestamp(format(addMonths(parseISO(updatedAt), -11), "yyyy-MM-dd"));

  const chartData = useMemo(
    () =>
      data.observed
        .map((item) => ({
          ...item,
          ts: getTimestamp(item.date),
        }))
        .filter((item) => item.ts >= rangeStart && item.ts <= rangeEnd),
    [data.observed, rangeEnd, rangeStart]
  );

  const lastPoint = chartData.length ? chartData[chartData.length - 1] : null;
  const lanes = useMemo(
    () => buildTreatmentLanes(treatments, rangeStart, rangeEnd),
    [rangeEnd, rangeStart, treatments]
  );
  const [hovered, setHovered] = useState<LaneTreatment | null>(null);

  const kpiTitle = metric === "height" ? "현재 키" : "현재 체중";
  const velocityLabel = metric === "height" ? "성장속도" : "증가속도";

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {isReport && (
            <p className="mt-1 text-xs text-slate-500">
              {metric === "height" ? "Height" : "Weight"} • Updated: {updatedAt}
            </p>
          )}
        </div>
        <div className="text-xs text-slate-400">Last 12 months</div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr,1fr]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
        >
          <div className="h-[120px] w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                측정 데이터가 없습니다.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#e0f2fe" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  {!isReport && (
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        borderColor: "#e2e8f0",
                        background: "#fff",
                        fontSize: 11,
                      }}
                      labelFormatter={(value) => formatTooltipDate(String(value))}
                      formatter={(value) => [`${value} ${unit}`, metric === "height" ? "키" : "체중"]}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill={`url(#spark-${gradientId})`}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#1e3a8a"
                    strokeWidth={2}
                    dot={false}
                  />
                  {lastPoint && (
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="transparent"
                      dot={({ cx, cy }) => (
                        <motion.circle
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill="#1d4ed8"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.4 }}
                        />
                      )}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {lastPoint && isReport && (
            <p className="mt-2 text-xs text-slate-500">
              현재 {lastPoint.value} {unit}
            </p>
          )}
        </motion.div>

        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="rounded-xl border border-slate-100 bg-white p-3"
          >
            <p className="text-xs text-slate-400">{kpiTitle}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {data.current.value} {unit}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="rounded-xl border border-slate-100 bg-white p-3"
          >
            <p className="text-xs text-slate-400">현재 백분위</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              P{data.current.percentile}
              <span className={`ml-2 ${trendTone[data.current.trend]}`}>
                {trendIcon[data.current.trend]}
              </span>
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="rounded-xl border border-slate-100 bg-white p-3"
          >
            <p className="text-xs text-slate-400">{velocityLabel}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {data.velocity.value} {data.velocity.unit}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-slate-400">치료 타임라인 (최근 12개월)</p>
        <div className="relative mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          {lanes.length === 0 ? (
            <p className="text-xs text-slate-400">치료 기록이 없습니다.</p>
          ) : (
            <div className="relative h-[48px]">
              {lanes.map((item) => {
                const left = ((item.startTs - rangeStart) / (rangeEnd - rangeStart)) * 100;
                const width = Math.max(
                  4,
                  ((item.endTs - item.startTs) / (rangeEnd - rangeStart)) * 100
                );
                const top = item.lane * 18;
                const isOngoing = !item.endDate;
                const barColor = item.type === "GH" ? "bg-emerald-200" : "bg-amber-200";
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35 }}
                    className="absolute"
                    style={{ left: `${left}%`, top }}
                    onMouseEnter={() => setHovered(item)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <div
                      className={`h-3 rounded-full ${barColor}`}
                      style={{ width: `${width}%` }}
                      title={`${item.label}: ${item.startDate} ~ ${item.endDate ?? "ongoing"}`}
                    />
                    {isReport && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {item.label} {item.startDate}
                        {item.endDate ? `~${item.endDate}` : " ~ ongoing"}
                      </p>
                    )}
                  </motion.div>
                );
              })}
              {!isReport && hovered && (
                <div className="absolute right-2 top-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 shadow-sm">
                  {hovered.label}: {hovered.startDate} ~ {hovered.endDate ?? "ongoing"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
