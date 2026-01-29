"use client";

import ParentSnapshotGrowthCard from "@/components/ParentSnapshotGrowthCard";
import { addMonths, format, parseISO } from "date-fns";

const buildObserved = () => {
  const start = parseISO("2025-02-01");
  return Array.from({ length: 12 }).map((_, index) => {
    const date = format(addMonths(start, index), "yyyy-MM-dd");
    return {
      date,
      value: Number((132 + index * 0.8 + (index % 3) * 0.2).toFixed(1)),
    };
  });
};

export default function DemoParentPage() {
  const observed = buildObserved();
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <ParentSnapshotGrowthCard
          title="Growth Summary (Last 12 months)"
          metric="height"
          unit="cm"
          mode="screen"
          updatedAt="2026-01-28"
          data={{
            observed,
            current: { value: 141.6, percentile: 42, trend: "up" },
            velocity: { value: 5.8, unit: "cm/yr" },
          }}
          treatments={[
            {
              id: "t1",
              type: "GH",
              label: "GH",
              startDate: "2025-06-01",
              endDate: "2025-12-31",
            },
            {
              id: "t2",
              type: "GnRH",
              label: "GnRH",
              startDate: "2025-10-15",
              endDate: null,
            },
          ]}
        />
        <ParentSnapshotGrowthCard
          title="Growth Summary (Report)"
          metric="height"
          unit="cm"
          mode="report"
          updatedAt="2026-01-28"
          data={{
            observed,
            current: { value: 141.6, percentile: 42, trend: "up" },
            velocity: { value: 5.8, unit: "cm/yr" },
          }}
          treatments={[
            {
              id: "t1-report",
              type: "GH",
              label: "GH",
              startDate: "2025-06-01",
              endDate: "2025-12-31",
            },
            {
              id: "t2-report",
              type: "GnRH",
              label: "GnRH",
              startDate: "2025-10-15",
              endDate: null,
            },
          ]}
        />
      </div>
    </main>
  );
}
