"use client";

import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Customized,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { format } from "date-fns";

export type GrowthObservedPoint = {
  date: string;
  value: number;
};

export type GrowthPercentilePoint = {
  date: string;
  p3: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p97: number;
};

export type GrowthTreatment = {
  id: string;
  type: "GH" | "GnRH";
  label: string;
  startDate: string;
  endDate?: string | null;
  note?: string;
};

type GrowthPercentileChartProps = {
  title: string;
  unit: string;
  mode?: "screen" | "report";
  data: {
    observed: GrowthObservedPoint[];
    percentiles: GrowthPercentilePoint[];
  };
  treatments?: GrowthTreatment[];
};

type CombinedPoint = {
  date: string;
  ts: number;
  observed?: number;
  p3?: number;
  p10?: number;
  p25?: number;
  p50?: number;
  p75?: number;
  p90?: number;
  p97?: number;
  band1090Base?: number;
  band1090?: number;
  band2575Base?: number;
  band2575?: number;
};

type TreatmentLane = GrowthTreatment & {
  startTs: number;
  endTs: number;
  lane: number;
};

type TreatmentTooltip = {
  id: string;
  x: number;
  y: number;
  label: string;
  type: GrowthTreatment["type"];
  startDate: string;
  endDate?: string | null;
  note?: string;
};

const formatTick = (value: number) => format(new Date(value), "yy.MM");
const formatTooltipDate = (value: number) => format(new Date(value), "yyyy.MM.dd");

const getTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const buildTreatmentLanes = (
  treatments: GrowthTreatment[],
  domainEnd: number,
  maxLanes: number
): TreatmentLane[] => {
  const sorted = [...treatments]
    .map((treatment) => ({
      ...treatment,
      startTs: getTimestamp(treatment.startDate),
      endTs: treatment.endDate ? getTimestamp(treatment.endDate) : domainEnd,
    }))
    .filter((item) => item.startTs > 0)
    .sort((a, b) => a.startTs - b.startTs);

  const lanes: number[] = [];
  return sorted.map((item) => {
    let laneIndex = lanes.findIndex((end) => item.startTs > end);
    if (laneIndex === -1) {
      laneIndex = Math.min(lanes.length, maxLanes - 1);
    }
    lanes[laneIndex] = item.endTs;
    return { ...item, lane: laneIndex };
  });
};

const legendItem = (label: string, color: string, isBand?: boolean) => (
  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
    <span
      className={isBand ? "h-2 w-4 rounded-sm" : "h-2 w-2 rounded-full"}
      style={{ backgroundColor: color }}
    />
    <span>{label}</span>
  </div>
);

export default function GrowthPercentileChart({
  title,
  unit,
  mode = "screen",
  data,
  treatments = [],
}: GrowthPercentileChartProps) {
  const isReport = mode === "report";
  const [treatmentHover, setTreatmentHover] = useState<TreatmentTooltip | null>(null);

  const combined = useMemo<CombinedPoint[]>(() => {
    const map = new Map<string, CombinedPoint>();
    data.percentiles.forEach((item) => {
      const band1090 =
        typeof item.p90 === "number" && typeof item.p10 === "number"
          ? item.p90 - item.p10
          : undefined;
      const band2575 =
        typeof item.p75 === "number" && typeof item.p25 === "number"
          ? item.p75 - item.p25
          : undefined;
      map.set(item.date, {
        date: item.date,
        ts: getTimestamp(item.date),
        p3: item.p3,
        p10: item.p10,
        p25: item.p25,
        p50: item.p50,
        p75: item.p75,
        p90: item.p90,
        p97: item.p97,
        band1090Base: item.p10,
        band1090,
        band2575Base: item.p25,
        band2575,
      });
    });
    data.observed.forEach((item) => {
      const existing = map.get(item.date);
      if (existing) {
        existing.observed = item.value;
        return;
      }
      map.set(item.date, {
        date: item.date,
        ts: getTimestamp(item.date),
        observed: item.value,
      });
    });
    return Array.from(map.values())
      .filter((item) => item.ts > 0)
      .sort((a, b) => a.ts - b.ts);
  }, [data.observed, data.percentiles]);

  const observedPoints = useMemo(
    () => combined.filter((item) => typeof item.observed === "number"),
    [combined]
  );
  const lastObserved = observedPoints.length
    ? observedPoints[observedPoints.length - 1]
    : null;

  const domainStart = combined.length ? combined[0].ts : Date.now();
  const domainEnd = combined.length ? combined[combined.length - 1].ts : Date.now();

  const treatmentLanes = useMemo(
    () => buildTreatmentLanes(treatments, domainEnd, 3),
    [treatments, domainEnd]
  );

  const laneHeight = isReport ? 16 : 12;
  const laneGap = isReport ? 8 : 6;
  const timelineHeight = treatmentLanes.length
    ? (Math.min(3, treatmentLanes.reduce((max, item) => Math.max(max, item.lane + 1), 0)) *
        (laneHeight + laneGap)) -
      laneGap
    : 0;

  const chartHeight = isReport ? 420 : 320;
  const axisFontSize = isReport ? 12 : 11;
  const yDomain = useMemo(() => {
    const values: number[] = [];
    combined.forEach((item) => {
      const candidates = [
        item.observed,
        item.p3,
        item.p10,
        item.p25,
        item.p50,
        item.p75,
        item.p90,
        item.p97,
      ];
      candidates.forEach((value) => {
        if (typeof value === "number" && Number.isFinite(value)) {
          values.push(value);
        }
      });
    });
    if (values.length === 0) return [0, 1] as [number, number];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.08, 1);
    return [min - padding, max + padding] as [number, number];
  }, [combined]);

  const TreatmentLayer = (props: any) => {
    if (!treatmentLanes.length) return null;
    const axis = Object.values(props.xAxisMap ?? {})[0] as any;
    if (!axis?.scale) return null;
    const scale = axis.scale;
    const offset = props.offset ?? { left: 0, top: 0 };

    const lanesInUse = Math.min(
      3,
      treatmentLanes.reduce((max, item) => Math.max(max, item.lane + 1), 0)
    );

    const topY = offset.top + 6;
    const railHeight = lanesInUse * (laneHeight + laneGap) - laneGap;

    return (
      <g>
        <rect
          x={offset.left}
          y={topY - 4}
          width={props.offset?.width ?? 0}
          height={railHeight + 8}
          fill="rgba(148,163,184,0.08)"
          rx={8}
        />
        {treatmentLanes.map((course) => {
          const startX = scale(course.startTs);
          const endX = scale(course.endTs);
          if (Number.isNaN(startX) || Number.isNaN(endX)) return null;
          const x = Math.min(startX, endX);
          const width = Math.max(6, Math.abs(endX - startX));
          const y = topY + course.lane * (laneHeight + laneGap);
          const color =
            course.type === "GH" ? "var(--chart-gh)" : "var(--chart-gnrh)";
          const textColor =
            course.type === "GH" ? "var(--chart-gh-text)" : "var(--chart-gnrh-text)";

          return (
            <motion.g key={course.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <motion.rect
                y={y}
                width={width}
                height={laneHeight}
                rx={laneHeight / 2}
                fill={color}
                initial={{ x: x - 6, opacity: 0 }}
                animate={{ x, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                onMouseEnter={() => {
                  setTreatmentHover({
                    id: course.id,
                    x: offset.left + x + width / 2,
                    y: topY + railHeight + 4,
                    label: course.label,
                    type: course.type,
                    startDate: course.startDate,
                    endDate: course.endDate,
                    note: course.note,
                  });
                }}
                onMouseLeave={() => setTreatmentHover(null)}
              />
              <text
                x={x + 8}
                y={y + laneHeight / 2 + 4}
                fontSize={10}
                fill={textColor}
                fontWeight={600}
              >
                {course.label}
              </text>
            </motion.g>
          );
        })}
      </g>
    );
  };

  const tooltipContent = (props: any) => {
    if (!props.active || !props.payload?.length) return null;
    const dataPoint = props.payload[0].payload as CombinedPoint;
    if (!dataPoint) return null;
    const observed = dataPoint.observed;
    const median = dataPoint.p50;
    const delta =
      typeof observed === "number" && typeof median === "number"
        ? observed - median
        : null;

    const activeTreatments = treatments.filter((treatment) => {
      const start = getTimestamp(treatment.startDate);
      const end = treatment.endDate ? getTimestamp(treatment.endDate) : domainEnd;
      return dataPoint.ts >= start && dataPoint.ts <= end;
    });

    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
      >
        <p className="text-[11px] text-white/70">
          {formatTooltipDate(dataPoint.ts)}
        </p>
        <p>
          실측값: {observed ?? "-"} {unit}
        </p>
        {delta !== null && (
          <p className="text-[11px] text-white/80">
            50p 대비 {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} {unit}
          </p>
        )}
        {activeTreatments.length > 0 && (
          <p className="text-[11px] text-white/80">
            치료중: {activeTreatments.map((item) => item.label).join(", ")}
          </p>
        )}
      </motion.div>
    );
  };

  const activeDot = (props: any) => {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) return null;
    return (
      <motion.g
        initial={{ scale: 0.9 }}
        animate={{ scale: 1.12 }}
        transition={{ duration: 0.2 }}
      >
        <circle cx={cx} cy={cy} r={8} fill="var(--chart-observed-soft)" />
        <circle cx={cx} cy={cy} r={4} fill="var(--chart-observed)" />
      </motion.g>
    );
  };

  const observedDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !lastObserved) return null;
    if (payload?.ts !== lastObserved.ts) return null;
    return (
      <motion.g
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill="var(--chart-observed-soft)"
          filter="url(#glow)"
        />
        <circle cx={cx} cy={cy} r={5} fill="var(--chart-observed)" />
      </motion.g>
    );
  };

  return (
    <div
      className={`relative w-full rounded-3xl border border-slate-200/70 bg-[#f8fafc] p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900 ${
        isReport ? "p-6" : ""
      } [--chart-observed:#1d4ed8] [--chart-observed-soft:rgba(59,130,246,0.22)] [--chart-median:#64748b] [--chart-band-1:rgba(186,230,253,0.5)] [--chart-band-2:rgba(199,210,254,0.45)] [--chart-gh:rgba(187,247,208,0.45)] [--chart-gh-text:#15803d] [--chart-gnrh:rgba(254,215,170,0.5)] [--chart-gnrh-text:#c2410c] dark:[--chart-observed:#93c5fd] dark:[--chart-observed-soft:rgba(147,197,253,0.25)] dark:[--chart-median:#94a3b8] dark:[--chart-band-1:rgba(56,189,248,0.18)] dark:[--chart-band-2:rgba(129,140,248,0.2)] dark:[--chart-gh:rgba(34,197,94,0.18)] dark:[--chart-gh-text:#86efac] dark:[--chart-gnrh:rgba(249,115,22,0.2)] dark:[--chart-gnrh-text:#fdba74]`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {title}
          </p>
          <p className={`text-sm font-semibold text-slate-800 dark:text-slate-100 ${
            isReport ? "text-base" : ""
          }`}>
            {unit} 성장 곡선
          </p>
        </div>
        <div className="text-xs text-slate-400">단위: {unit}</div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <div style={{ height: chartHeight }}>
          {combined.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400 dark:border-slate-700">
              표시할 데이터가 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={combined}
                margin={{ top: timelineHeight + 20, right: 24, left: 0, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="band1090" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-band-2)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--chart-band-2)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="band2575" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-band-1)" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="var(--chart-band-1)" stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="observedLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--chart-observed)" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="var(--chart-observed)" stopOpacity={1} />
                  </linearGradient>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={[domainStart, domainEnd]}
                  tickFormatter={formatTick}
                  tick={{ fontSize: axisFontSize, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={14}
                />
                <YAxis
                  tick={{ fontSize: axisFontSize, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  width={isReport ? 48 : 40}
                  domain={yDomain}
                  tickFormatter={(value) => Number(value).toFixed(0)}
                />

                <Customized component={TreatmentLayer} />

                <Area
                  dataKey="band1090Base"
                  stackId="band1090"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Area
                  dataKey="band1090"
                  stackId="band1090"
                  stroke="none"
                  fill="url(#band1090)"
                  isAnimationActive={false}
                />

                <Area
                  dataKey="band2575Base"
                  stackId="band2575"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Area
                  dataKey="band2575"
                  stackId="band2575"
                  stroke="none"
                  fill="url(#band2575)"
                  isAnimationActive={false}
                />

                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="var(--chart-median)"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive
                  animationDuration={500}
                />

                <Line
                  type="monotone"
                  dataKey="observed"
                  stroke="url(#observedLine)"
                  strokeWidth={3}
                  dot={observedDot}
                  activeDot={activeDot}
                  connectNulls
                  isAnimationActive
                  animationDuration={800}
                  animationEasing="ease-out"
                />

                {lastObserved && (
                  <ReferenceLine
                    x={lastObserved.ts}
                    stroke="rgba(148,163,184,0.45)"
                    strokeDasharray="4 4"
                  />
                )}

                <Tooltip
                  cursor={{ stroke: "rgba(148,163,184,0.4)", strokeDasharray: "3 3" }}
                  content={tooltipContent}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {treatmentHover && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-[11px] text-white shadow-lg"
            style={{ left: treatmentHover.x, top: treatmentHover.y }}
          >
            <p className="font-semibold">{treatmentHover.label}</p>
            <p>
              {treatmentHover.startDate} ~ {treatmentHover.endDate ?? "진행 중"}
            </p>
            {treatmentHover.note && (
              <p className="text-white/70">{treatmentHover.note}</p>
            )}
          </motion.div>
        )}
      </motion.div>

      <div className="mt-4 flex flex-wrap gap-4">
        {legendItem("Observed", "var(--chart-observed)")}
        {legendItem("50p", "var(--chart-median)")}
        {legendItem("Bands", "var(--chart-band-2)", true)}
        {legendItem("Treatments", "var(--chart-gh)", true)}
      </div>

      {/*
        체크리스트
        - [x] Observed/50p/밴드 렌더
        - [x] 치료 타임라인(hover tooltip)
        - [x] Glow dot + vertical guideline
        - [x] Framer Motion 애니메이션 적용
        - [x] report 모드 높이/타이포 조정
      */}
    </div>
  );
}
