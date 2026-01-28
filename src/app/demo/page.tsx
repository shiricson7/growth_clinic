"use client";

import Link from "next/link";
import { addMonths, format } from "date-fns";
import GrowthPercentileChart, {
  type GrowthObservedPoint,
  type GrowthPercentilePoint,
  type GrowthTreatment,
} from "@/components/GrowthPercentileChart";

const buildDates = (start: string, count: number) =>
  Array.from({ length: count }, (_, index) =>
    format(addMonths(new Date(start), index), "yyyy-MM-dd")
  );

const dates = buildDates("2024-01-01", 14);

const percentileData: GrowthPercentilePoint[] = dates.map((date, index) => {
  const baseline = 84 + index * 0.85;
  return {
    date,
    p3: Number((baseline - 6.2).toFixed(1)),
    p10: Number((baseline - 4.5).toFixed(1)),
    p25: Number((baseline - 2.8).toFixed(1)),
    p50: Number(baseline.toFixed(1)),
    p75: Number((baseline + 2.7).toFixed(1)),
    p90: Number((baseline + 4.4).toFixed(1)),
    p97: Number((baseline + 6.1).toFixed(1)),
  };
});

const observedData: GrowthObservedPoint[] = dates
  .filter((_, index) => index % 2 === 0)
  .map((date, index) => {
    const baseline = 84 + index * 0.85;
    const variation = index % 3 === 0 ? 0.6 : -0.3;
    return { date, value: Number((baseline + variation).toFixed(1)) };
  });

const treatments: GrowthTreatment[] = [
  {
    id: "gh-course",
    type: "GH",
    label: "Growth Hormone",
    startDate: "2024-06-01",
    endDate: "2024-12-31",
    note: "주 6회 투약",
  },
  {
    id: "gnrh-course",
    type: "GnRH",
    label: "GnRH agonist",
    startDate: "2024-10-15",
    endDate: null,
    note: "진행 중",
  },
];

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Growth Chart Demo
            </p>
            <h1 className="text-3xl font-bold">성장 곡선 데모</h1>
            <p className="text-sm text-slate-500">보고서 품질의 차트 시각화를 확인하세요.</p>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold text-slate-500 underline-offset-4 hover:underline"
          >
            메인으로 돌아가기
          </Link>
        </header>

        <GrowthPercentileChart
          title="Height Growth"
          unit="cm"
          mode="screen"
          data={{ observed: observedData, percentiles: percentileData }}
          treatments={treatments}
        />

        <GrowthPercentileChart
          title="Height Growth (Report)"
          unit="cm"
          mode="report"
          data={{ observed: observedData, percentiles: percentileData }}
          treatments={treatments}
        />
      </div>
    </main>
  );
}
