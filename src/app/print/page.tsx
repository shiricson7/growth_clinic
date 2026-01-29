"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, differenceInMonths, format, parseISO } from "date-fns";
import type { Measurement, TherapyCourse, PatientInfo } from "@/lib/types";
import { loadMeasurements, loadTherapyCourses, loadPatientInfo } from "@/lib/storage";
import { getAgeMonths, percentileFromValue } from "@/lib/percentileLogic";
import ParentSnapshotGrowthCard from "@/components/ParentSnapshotGrowthCard";
import logo from "../../../data/growth_clinic_logo.png";

type SummaryResponse = {
  text: string;
  debugReason?: string;
};

type SnapshotTreatment = {
  id: string;
  type: "GH" | "GnRH";
  label: string;
  startDate: string;
  endDate?: string | null;
  note?: string;
};

const formatSex = (sex: PatientInfo["sex"]) =>
  sex === "male" ? "남아" : sex === "female" ? "여아" : "-";

export default function PrintPage() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [therapyCourses, setTherapyCourses] = useState<TherapyCourse[]>([]);
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: "",
    chartNumber: "",
    rrn: "",
    sex: "",
    birthDate: "",
    boneAge: "",
    boneAgeDate: "",
    hormoneLevels: "",
    hormoneTestDate: "",
  });
  const [summary, setSummary] = useState<SummaryResponse>({
    text: "요약을 생성 중입니다.",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    setMeasurements(loadMeasurements());
    setTherapyCourses(loadTherapyCourses());
    const storedPatient = loadPatientInfo();
    if (storedPatient) {
      setPatientInfo(storedPatient);
    }
  }, []);

  const sortedMeasurements = useMemo(
    () =>
      [...measurements].sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : 0
      ),
    [measurements]
  );

  const latestMeasurement = sortedMeasurements.length
    ? sortedMeasurements[sortedMeasurements.length - 1]
    : null;
  const firstMeasurement = sortedMeasurements.length ? sortedMeasurements[0] : null;

  const latestAgeMonths = useMemo(() => {
    if (!patientInfo.birthDate || !latestMeasurement?.date) return null;
    return getAgeMonths(patientInfo.birthDate, latestMeasurement.date);
  }, [patientInfo.birthDate, latestMeasurement]);

  const latestHeightPercentile = useMemo(() => {
    if (!patientInfo.sex || latestAgeMonths === null || !latestMeasurement?.heightCm) return null;
    return percentileFromValue(
      "height",
      patientInfo.sex,
      latestAgeMonths,
      latestMeasurement.heightCm
    );
  }, [patientInfo.sex, latestAgeMonths, latestMeasurement]);

  const latestWeightPercentile = useMemo(() => {
    if (!patientInfo.sex || latestAgeMonths === null || !latestMeasurement?.weightKg) return null;
    return percentileFromValue(
      "weight",
      patientInfo.sex,
      latestAgeMonths,
      latestMeasurement.weightKg
    );
  }, [patientInfo.sex, latestAgeMonths, latestMeasurement]);

  const measurementRange = useMemo(() => {
    if (!firstMeasurement || !latestMeasurement) return "-";
    return `${firstMeasurement.date} ~ ${latestMeasurement.date}`;
  }, [firstMeasurement, latestMeasurement]);

  const measurementSpanMonths = useMemo(() => {
    if (!firstMeasurement || !latestMeasurement) return null;
    const start = parseISO(firstMeasurement.date);
    const end = parseISO(latestMeasurement.date);
    const months = differenceInMonths(end, start);
    return Number.isFinite(months) ? months : null;
  }, [firstMeasurement, latestMeasurement]);

  const hormoneEntries = useMemo(() => {
    if (typeof patientInfo.hormoneLevels === "string") {
      const raw = patientInfo.hormoneLevels.trim();
      return raw ? [{ label: "기타", value: raw }] : [];
    }
    const levels = patientInfo.hormoneLevels ?? {};
    const ordered = [
      { key: "LH", label: "LH" },
      { key: "FSH", label: "FSH" },
      { key: "E2", label: "E2" },
      { key: "Testosterone", label: "Testosterone" },
      { key: "TSH", label: "TSH" },
      { key: "fT4", label: "fT4" },
      { key: "DHEA", label: "DHEA" },
      { key: "IGF_BP3", label: "IGF-BP3" },
      { key: "IGF_1", label: "IGF-1" },
      { key: "HbA1c", label: "HbA1c" },
    ];
    return ordered
      .map((item) => ({
        label: item.label,
        value: levels[item.key as keyof typeof levels],
      }))
      .filter((entry) => entry.value && entry.value.trim() !== "");
  }, [patientInfo.hormoneLevels]);

  const hormoneSummary = useMemo(() => {
    if (hormoneEntries.length === 0) return "-";
    const summary = hormoneEntries.slice(0, 4).map((entry) => `${entry.label} ${entry.value}`);
    if (hormoneEntries.length > 4) {
      summary.push(`외 ${hormoneEntries.length - 4}항목`);
    }
    return summary.join(" · ");
  }, [hormoneEntries]);

  const heightDelta = useMemo(() => {
    if (!firstMeasurement?.heightCm || !latestMeasurement?.heightCm) return null;
    return Number((latestMeasurement.heightCm - firstMeasurement.heightCm).toFixed(1));
  }, [firstMeasurement, latestMeasurement]);

  const weightDelta = useMemo(() => {
    if (!firstMeasurement?.weightKg || !latestMeasurement?.weightKg) return null;
    return Number((latestMeasurement.weightKg - firstMeasurement.weightKg).toFixed(1));
  }, [firstMeasurement, latestMeasurement]);

  const payload = useMemo(
    () => ({
      birthDate: patientInfo.birthDate,
      sex: patientInfo.sex,
      boneAge: patientInfo.boneAge ?? null,
      hormoneLevels: patientInfo.hormoneLevels ?? null,
      measurements: sortedMeasurements.map((item) => ({
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
    [patientInfo.birthDate, patientInfo.sex, sortedMeasurements, therapyCourses]
  );

  const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);

  const snapshotMetric = useMemo(() => {
    if (sortedMeasurements.some((item) => typeof item.heightCm === "number")) return "height";
    if (sortedMeasurements.some((item) => typeof item.weightKg === "number")) return "weight";
    return "height";
  }, [sortedMeasurements]);

  const snapshotUnit = snapshotMetric === "height" ? "cm" : "kg";

  const snapshotObserved = useMemo(() => {
    const points = sortedMeasurements
      .filter((item) =>
        snapshotMetric === "height"
          ? typeof item.heightCm === "number"
          : typeof item.weightKg === "number"
      )
      .map((item) => ({
        date: item.date,
        value:
          snapshotMetric === "height"
            ? (item.heightCm as number)
            : (item.weightKg as number),
      }));
    if (!latestMeasurement?.date) return points.slice(-12);
    const windowStart = addMonths(parseISO(latestMeasurement.date), -11);
    const inWindow = points.filter((item) => parseISO(item.date) >= windowStart);
    return inWindow.length > 0 ? inWindow : points.slice(-12);
  }, [latestMeasurement?.date, snapshotMetric, sortedMeasurements]);

  const snapshotTrend = useMemo(() => {
    if (snapshotObserved.length < 2) return "flat" as const;
    const last = snapshotObserved[snapshotObserved.length - 1].value;
    const prev = snapshotObserved[Math.max(0, snapshotObserved.length - 3)].value;
    const delta = last - prev;
    const threshold = snapshotMetric === "height" ? 0.4 : 0.2;
    if (delta > threshold) return "up" as const;
    if (delta < -threshold) return "down" as const;
    return "flat" as const;
  }, [snapshotMetric, snapshotObserved]);

  const snapshotVelocity = useMemo(() => {
    if (snapshotObserved.length < 2) return 0;
    const first = snapshotObserved[0];
    const last = snapshotObserved[snapshotObserved.length - 1];
    const months = differenceInMonths(parseISO(last.date), parseISO(first.date));
    if (!Number.isFinite(months) || months <= 0) return 0;
    const yearly = ((last.value - first.value) / months) * 12;
    return Number(yearly.toFixed(1));
  }, [snapshotObserved]);

  const snapshotPercentile = snapshotMetric === "height" ? latestHeightPercentile : latestWeightPercentile;

  const snapshotCurrentValue = snapshotObserved.length
    ? snapshotObserved[snapshotObserved.length - 1].value
    : 0;

  const snapshotUpdatedAt =
    latestMeasurement?.date ?? format(new Date(), "yyyy-MM-dd");

  const snapshotTreatments = useMemo<SnapshotTreatment[]>(
    () =>
      therapyCourses.map((course) => {
        const mappedType = course.drug === "GH" ? "GH" : "GnRH";
        return {
          id: course.id,
          type: mappedType,
          label: mappedType,
          startDate: course.startDate,
          endDate: course.endDate ?? null,
          note: course.note,
        };
      }),
    [therapyCourses]
  );

  useEffect(() => {
    const hasData = Boolean(payload.birthDate) && payload.measurements.length > 0;
    if (!hasData) {
      setSummary({ text: "생년월일과 측정 기록을 입력하면 요약이 생성됩니다." });
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const run = async () => {
      try {
        setStatus("loading");
        const response = await fetch("/api/guardian-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadKey,
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to fetch summary");
        }
        const data = (await response.json()) as SummaryResponse;
        if (data?.text) {
          setSummary(data);
          setStatus(data.debugReason ? "error" : "idle");
          return;
        }
        throw new Error("Invalid response");
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setSummary({ text: "요약 생성에 실패했습니다. 잠시 후 다시 시도해주세요." });
      }
    };
    run();
    return () => controller.abort();
  }, [payloadKey, payload.birthDate, payload.measurements.length]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-white to-[#e2e8f0] px-4 py-6 print:bg-white print:px-0 print:py-0">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }
        @media print {
          html,
          body {
            background: white !important;
          }
          .print-page {
            break-after: page;
            page-break-after: always;
          }
          .print-last {
            break-before: page;
            page-break-before: always;
          }
          .print-avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="relative mx-auto w-full max-w-[210mm] rounded-[32px] bg-white/90 px-8 py-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] ring-1 ring-[#e2e8f0] backdrop-blur-sm print:rounded-none print:bg-white print:shadow-none print:ring-0">
        <div className="pointer-events-none absolute -right-20 -top-24 h-40 w-40 rounded-full bg-gradient-to-br from-[#dbeafe] via-[#e9d5ff] to-[#fde68a] opacity-50 blur-2xl print:hidden" />
        <div className="pointer-events-none absolute -left-16 top-28 h-32 w-32 rounded-full bg-gradient-to-br from-[#bbf7d0] to-[#bfdbfe] opacity-40 blur-2xl print:hidden" />
        <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
          <Link
            href="/"
            className="text-sm font-semibold text-[#475569] underline-offset-4 hover:underline"
          >
            돌아가기
          </Link>
          <button
            type="button"
            className="rounded-full bg-[#1a1c24] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => window.print()}
          >
            인쇄하기
          </button>
        </div>

        <section className="print-page flex min-h-[calc(297mm-24mm)] flex-col gap-4">
          <div className="flex items-center justify-center gap-4">
            <img
              src={logo.src}
              alt="신익순 소아청소년과 로고"
              className="w-[75%] max-h-[60mm] object-contain"
            />
          </div>

          <header className="relative border-b border-[#e2e8f0] pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#94a3b8]">
              성장 요약
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-[#0f172a]">성장 요약 리포트</h1>
              <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-[#4338ca]">
                보호자용
              </span>
            </div>
            <p className="mt-2 text-xs text-[#64748b]">
              최근 성장 흐름을 한 장으로 정리했습니다.
            </p>
          </header>

          <section className="mt-5 grid gap-4 lg:grid-cols-[1.25fr,1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm">
                <p className="text-xs font-semibold text-[#94a3b8]">아이 정보</p>
                <div className="mt-2 grid gap-x-4 gap-y-1 text-[13px] text-[#1f2937] md:grid-cols-2">
                  <p>이름: {patientInfo.name || "미입력"}</p>
                  <p>성별: {formatSex(patientInfo.sex)}</p>
                  <p>생년월일: {patientInfo.birthDate || "-"}</p>
                  <p>측정 기간: {measurementRange}</p>
                  {patientInfo.boneAge && <p>골연령: {patientInfo.boneAge}</p>}
                  {patientInfo.boneAgeDate && <p>골연령 검사일: {patientInfo.boneAgeDate}</p>}
                  {hormoneEntries.length > 0 ? (
                    <div className="md:col-span-2 pt-1 text-xs text-[#475569]">
                      <p className="font-semibold text-[#64748b]">호르몬 수치</p>
                      {patientInfo.hormoneTestDate && (
                        <p className="text-[11px] text-[#64748b]">
                          검사일: {patientInfo.hormoneTestDate}
                        </p>
                      )}
                      <ul className="mt-1 space-y-0.5">
                        {hormoneEntries.map((entry) => (
                          <li key={`${entry.label}-${entry.value}`}>
                            {entry.label}: {entry.value}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="md:col-span-2 text-[11px] text-[#94a3b8]">
                      호르몬 수치: {hormoneSummary}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/90 p-3 shadow-sm">
                <p className="text-xs font-semibold text-[#94a3b8]">최근 측정 요약</p>
                {latestMeasurement ? (
                  <div className="mt-2 grid gap-x-4 gap-y-1 text-[13px] text-[#1f2937] md:grid-cols-2">
                    <p>측정일 {latestMeasurement.date}</p>
                    <p>
                      키 {latestMeasurement.heightCm ?? "-"} cm{" "}
                      {latestHeightPercentile !== null
                        ? `(키${latestHeightPercentile.toFixed(1)}백분위)`
                        : ""}
                    </p>
                    <p>
                      몸무게 {latestMeasurement.weightKg ?? "-"} kg{" "}
                      {latestWeightPercentile !== null
                        ? `(몸무게${latestWeightPercentile.toFixed(1)}백분위)`
                        : ""}
                    </p>
                    <p>
                      기간: {measurementSpanMonths !== null ? `${measurementSpanMonths}개월` : "-"}
                    </p>
                    <p>키변화 {heightDelta !== null ? `${heightDelta} cm` : "-"}</p>
                    <p>몸무게변화 {weightDelta !== null ? `${weightDelta} kg` : "-"}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[#64748b]">측정 기록이 없습니다.</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/90 p-3 shadow-sm">
                <p className="text-xs font-semibold text-[#94a3b8]">치료 기간</p>
                {therapyCourses.length === 0 ? (
                  <p className="mt-2 text-sm text-[#64748b]">기록된 치료가 없습니다.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-[13px] text-[#1f2937]">
                    {therapyCourses.map((course) => {
                      const doseLabel =
                        course.drug === "GH" && course.doseNote ? ` (${course.doseNote})` : "";
                      return (
                        <li key={course.id}>
                          {course.drug}
                          {doseLabel} · {course.startDate}
                          {course.endDate ? ` ~ ${course.endDate}` : " (진행 중)"}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <ParentSnapshotGrowthCard
              title="Growth Summary (Last 12 months)"
              metric={snapshotMetric}
              unit={snapshotUnit}
              mode="report"
              updatedAt={snapshotUpdatedAt}
              data={{
                observed: snapshotObserved,
                current: {
                  value: snapshotCurrentValue,
                  percentile: snapshotPercentile ? Math.round(snapshotPercentile) : 0,
                  trend: snapshotTrend,
                },
                velocity: {
                  value: snapshotVelocity,
                  unit: snapshotMetric === "height" ? "cm/yr" : "kg/yr",
                },
              }}
              treatments={snapshotTreatments}
            />
          </section>
        </section>

        <section className="print-last mt-6 flex min-h-[calc(297mm-24mm)] flex-col gap-4">
          <section className="relative overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-white via-white to-[#f8fafc] p-5 shadow-sm print-avoid-break">
            <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[#818cf8] via-[#60a5fa] to-[#34d399] opacity-70" />
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#0f172a]">보호자 설명 요약</p>
              {status === "loading" && (
                <span className="text-xs text-[#94a3b8]">요약 생성 중...</span>
              )}
            </div>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#1f2937]">
              {status === "loading" ? "요약을 생성 중입니다..." : summary.text}
            </div>
            {summary.debugReason && (
              <p className="mt-3 text-[11px] text-[#94a3b8]">
                오류 원인: {summary.debugReason}
              </p>
            )}
          </section>

          <footer className="border-t border-[#e2e8f0] pt-3 text-xs text-[#94a3b8]">
            보호자 설명용 요약이며, 의료적 판단은 담당 의료진과 상담해주세요.
          </footer>

          <div className="mt-auto pt-6 text-center text-2xl font-bold text-[#0f172a]">
            신익순 소아청소년과
          </div>
        </section>
      </div>
    </main>
  );
}
