"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
type OpinionInput = {
  birthDate: string;
  sex: "male" | "female" | "";
  measurements: Array<{
    measurementDate: string;
    heightCm: number | null;
    weightKg: number | null;
  }>;
};

type OpinionResult = {
  title: string;
  message: string;
  severity: "calm" | "watch" | "encourage";
  debugReason?: string;
};

interface HedgehogBubbleProps {
  opinionInput: OpinionInput;
}

const severityStyles: Record<OpinionResult["severity"], string> = {
  calm: "from-[#e0f2fe] to-[#e7e5ff] text-[#1e3a8a]",
  watch: "from-[#fff7ed] to-[#fde2e4] text-[#9a3412]",
  encourage: "from-[#dcfce7] to-[#e0e7ff] text-[#166534]",
};

const idleComment: OpinionResult = {
  title: "기록이 필요해요",
  message: "측정값을 입력하거나 불러오면 성장 의견을 알려드릴게요.",
  severity: "calm",
};

export default function HedgehogBubble({ opinionInput }: HedgehogBubbleProps) {
  const [comment, setComment] = useState<OpinionResult>(idleComment);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const payloadKey = useMemo(
    () => JSON.stringify(opinionInput),
    [opinionInput]
  );

  useEffect(() => {
    const hasData =
      Boolean(opinionInput.birthDate) && opinionInput.measurements.length > 0;
    if (!hasData) {
      setComment(idleComment);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/opinion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadKey,
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to fetch opinion");
        }
        const data = (await response.json()) as OpinionResult;
        if (data?.title && data?.message && data?.severity) {
          setComment(data);
          setStatus(data.debugReason ? "error" : "idle");
          return;
        }
        throw new Error("Invalid response");
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setComment({
          title: "분석에 시간이 걸려요",
          message:
            "잠시 후 다시 확인해주세요. 현재 입력된 정보를 기반으로 확인 중이에요.",
          severity: "watch",
        });
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [payloadKey, opinionInput.birthDate, opinionInput.measurements.length]);

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
          <p className="mt-2 text-sm text-[#334155]">
            {status === "loading"
              ? "소아 성장전문가 의견을 분석 중이에요..."
              : comment.message}
          </p>
          {comment.debugReason && (
            <p className="mt-2 text-[11px] text-[#94a3b8]">
              실패 원인: {comment.debugReason}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
