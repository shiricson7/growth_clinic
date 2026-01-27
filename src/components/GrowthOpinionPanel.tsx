"use client";

import { useEffect, useMemo, useState } from "react";
import type { Measurement, TherapyCourse, PatientInfo } from "@/lib/types";

type OpinionResponse = {
  text: string;
  debugReason?: string;
};

interface GrowthOpinionPanelProps {
  patientInfo: PatientInfo;
  measurements: Measurement[];
  therapyCourses: TherapyCourse[];
}

const idleText =
  "성장 분석을 생성하려면 생년월일과 측정 기록을 입력해주세요.";

export default function GrowthOpinionPanel({
  patientInfo,
  measurements,
  therapyCourses,
}: GrowthOpinionPanelProps) {
  const [result, setResult] = useState<OpinionResponse>({ text: idleText });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const payload = useMemo(
    () => ({
      birthDate: patientInfo.birthDate,
      sex: patientInfo.sex,
      measurements: measurements.map((item) => ({
        measurementDate: item.date,
        heightCm: item.heightCm ?? null,
        weightKg: item.weightKg ?? null,
      })),
      therapyCourses: therapyCourses.map((course) => ({
        drug: course.drug,
        startDate: course.startDate,
        endDate: course.endDate ?? null,
        productName: course.productName ?? null,
        doseNote: course.doseNote ?? null,
        note: course.note ?? null,
      })),
    }),
    [patientInfo.birthDate, patientInfo.sex, measurements, therapyCourses]
  );

  const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);

  useEffect(() => {
    const hasData = Boolean(payload.birthDate) && payload.measurements.length > 0;
    if (!hasData) {
      setResult({ text: idleText });
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      try {
        setStatus("loading");
        const response = await fetch("/api/opinion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadKey,
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to fetch opinion");
        }
        const data = (await response.json()) as OpinionResponse;
        if (data?.text) {
          setResult(data);
          setStatus(data.debugReason ? "error" : "idle");
          return;
        }
        throw new Error("Invalid response");
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setResult({
          text:
            "성장 분석을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.",
        });
      }
    };

    run();
    return () => controller.abort();
  }, [payloadKey, payload.birthDate, payload.measurements.length]);

  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[#94a3b8]">
            성장 분석
          </p>
          <p className="text-sm font-semibold text-[#1a1c24]">
            gpt-5-mini 요약
          </p>
        </div>
        {status === "loading" && (
          <span className="text-xs text-[#64748b]">분석 중...</span>
        )}
      </div>
      <div className="mt-4 whitespace-pre-wrap text-sm text-[#334155]">
        {status === "loading" ? "성장 데이터를 분석 중입니다..." : result.text}
      </div>
      {result.debugReason && (
        <p className="mt-3 text-[11px] text-[#94a3b8]">
          오류 원인: {result.debugReason}
        </p>
      )}
    </div>
  );
}
