"use client";

import { motion } from "framer-motion";
import { generateComment } from "@/lib/commentGenerator";
import { Metric } from "@/lib/percentileLogic";

interface HedgehogBubbleProps {
  metric: Metric;
  currentPercentile: number;
  prevPercentile?: number;
  deltaValue?: number;
  deltaMonths?: number;
  ageMonths: number;
}

const severityStyles = {
  calm: "from-[#e0f2fe] to-[#e7e5ff] text-[#1e3a8a]",
  watch: "from-[#fff7ed] to-[#fde2e4] text-[#9a3412]",
  encourage: "from-[#dcfce7] to-[#e0e7ff] text-[#166534]",
};

export default function HedgehogBubble({
  metric,
  currentPercentile,
  prevPercentile,
  deltaValue,
  deltaMonths,
  ageMonths,
}: HedgehogBubbleProps) {
  const comment = generateComment({
    metric,
    currentPercentile,
    prevPercentile,
    deltaValue,
    deltaMonths,
    ageMonths,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-xl"
    >
      <div
        className={`absolute inset-0 -z-10 bg-gradient-to-br ${severityStyles[comment.severity]} opacity-40`}
      />
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-white/90 p-2 shadow-sm">
          <svg viewBox="0 0 120 120" className="h-full w-full">
            <defs>
              <linearGradient id="hedge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c7b299" />
                <stop offset="100%" stopColor="#a47148" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="42" fill="url(#hedge)" />
            <circle cx="44" cy="55" r="6" fill="#1f2937" />
            <circle cx="76" cy="55" r="6" fill="#1f2937" />
            <circle cx="60" cy="70" r="8" fill="#f8fafc" />
            <circle cx="60" cy="70" r="4" fill="#1f2937" />
            <path
              d="M18 48c5-10 12-18 22-24"
              stroke="#8c6239"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M102 48c-5-10-12-18-22-24"
              stroke="#8c6239"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M20 78c12 10 26 16 40 16s28-6 40-16"
              stroke="#f3f4f6"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <circle cx="95" cy="85" r="8" fill="#e0f2fe" />
            <path
              d="M95 82v8"
              stroke="#1e3a8a"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M92 86h6"
              stroke="#1e3a8a"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-[#1a1c24]">{comment.title}</p>
          <p className="mt-2 text-sm text-[#334155]">{comment.message}</p>
        </div>
      </div>
    </motion.div>
  );
}
