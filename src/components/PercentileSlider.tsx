"use client";

import { motion } from "framer-motion";
import { Metric } from "@/lib/percentileLogic";

interface PercentileSliderProps {
  metric: Metric;
  percentile: number;
  onChange: (value: number) => void;
}

const metricLabel: Record<Metric, string> = {
  height: "키 백분위",
  weight: "몸무게 백분위",
};

export default function PercentileSlider({
  metric,
  percentile,
  onChange,
}: PercentileSliderProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1a1c24]">{metricLabel[metric]}</h3>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#4f46e5]">
          P{percentile.toFixed(1)}
        </span>
      </div>

      <div className="relative">
        <input
          type="range"
          min={3}
          max={97}
          step={0.1}
          value={percentile}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full appearance-none rounded-full bg-gradient-to-r from-[#c7f3e9] via-[#eadcff] to-[#ffd4c0] focus:outline-none"
        />
        <motion.div
          className="absolute -top-6 left-0"
          animate={{ x: `${((percentile - 3) / 94) * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <span className="rounded-full bg-[#1a1c24] px-2 py-1 text-[10px] font-semibold text-white">
            P{percentile.toFixed(1)}
          </span>
        </motion.div>
      </div>

      <div className="flex items-center justify-between text-xs text-[#6b7280]">
        <span>P3</span>
        <span>평균</span>
        <span>P97</span>
      </div>
    </div>
  );
}
