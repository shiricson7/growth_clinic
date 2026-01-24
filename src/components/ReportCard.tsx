"use client";

import * as React from "react";
import { motion } from "framer-motion";
import GrowthChart from "@/components/GrowthChart";
import HedgehogBubble from "@/components/HedgehogBubble";
import { ChartPoint, Metric } from "@/lib/percentileLogic";

interface ReportCardProps {
  clinicName: string;
  chartNumber: string;
  childName: string;
  birthDate: string;
  sex: "male" | "female" | "";
  measurementDate: string;
  metric: Metric;
  chartData: ChartPoint[];
  percentile: number;
  ageMonths: number;
  prevPercentile?: number;
}

const ReportCard = React.forwardRef<HTMLDivElement, ReportCardProps>(
  (
    {
      clinicName,
      chartNumber,
      childName,
      birthDate,
      sex,
      measurementDate,
      metric,
      chartData,
      percentile,
      ageMonths,
      prevPercentile,
    },
    ref
  ) => {
    return (
      <motion.section
        ref={ref}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full overflow-hidden rounded-[32px] border border-white/60 bg-white/70 p-6 shadow-[0_30px_80px_rgba(148,163,184,0.3)] backdrop-blur-2xl"
      >
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-gradient-to-br from-[#dbeafe] via-[#e9d5ff] to-[#fed7aa] opacity-40 blur-2xl" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[#94a3b8]">Pediatric Growth Report</p>
              <h1 className="text-xl font-bold text-[#1a1c24]">{clinicName}</h1>
            </div>
            <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-[#475569]">
              차트번호 {chartNumber || "미입력"}
            </div>
          </div>

          <div className="mt-4 grid gap-4 rounded-2xl border border-white/70 bg-white/60 p-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-[#94a3b8]">아이 이름</p>
              <p className="text-sm font-semibold text-[#1a1c24]">{childName || "미입력"}</p>
            </div>
            <div>
              <p className="text-xs text-[#94a3b8]">생년월일 / 성별</p>
              <p className="text-sm font-semibold text-[#1a1c24]">
                {birthDate || "미입력"} · {sex === "male" ? "남아" : sex === "female" ? "여아" : "미입력"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#94a3b8]">측정일</p>
              <p className="text-sm font-semibold text-[#1a1c24]">{measurementDate || "미입력"}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[2fr,1fr]">
            <GrowthChart metric={metric} chartData={chartData} currentAgeMonths={ageMonths} />
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-white/70 bg-white/70 p-4 text-sm text-[#1a1c24]">
                <p className="text-xs font-semibold uppercase text-[#94a3b8]">현재 백분위</p>
                <p className="mt-2 text-2xl font-bold text-[#4f46e5]">
                  P{percentile.toFixed(1)}
                </p>
                <p className="mt-2 text-xs text-[#64748b]">
                  또래 기준 상위 {(100 - percentile).toFixed(0)}% 수준이에요.
                </p>
              </div>
              <HedgehogBubble
                metric={metric}
                currentPercentile={percentile}
                prevPercentile={prevPercentile}
                deltaMonths={3}
                ageMonths={ageMonths}
              />
            </div>
          </div>
        </div>
      </motion.section>
    );
  }
);

ReportCard.displayName = "ReportCard";

export default ReportCard;
