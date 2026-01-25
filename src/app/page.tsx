"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChildInfoForm, { ChildInfo } from "@/components/ChildInfoForm";
import PercentileSlider from "@/components/PercentileSlider";
import ReportCard from "@/components/ReportCard";
import ShareButton, { getSharedPayload } from "@/components/ShareButton";
import { Button } from "@/components/ui/button";
import { normalizeRrn, isValidRrn, parseRrn } from "@/lib/rrn";
import { supabase } from "@/lib/supabase/client";
import {
  Metric,
  buildChartData,
  getAgeMonths,
  percentileFromValue,
  valueAtPercentile,
} from "@/lib/percentileLogic";
import { theme } from "@/styles/theme";

const today = new Date().toISOString().slice(0, 10);

const defaultChildInfo: ChildInfo = {
  chartNumber: "A-2026-001",
  name: "서윤",
  rrn: "",
  birthDate: "",
  sex: "",
  measurementDate: today,
  heightCm: "",
  weightKg: "",
};

export default function Home() {
  const searchParams = useSearchParams();
  const reportRef = useRef<HTMLDivElement>(null);

  const [childInfo, setChildInfo] = useState<ChildInfo>(defaultChildInfo);
  const [rrnError, setRrnError] = useState<string | null>(null);
  const [maskedRrn, setMaskedRrn] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("height");
  const [percentiles, setPercentiles] = useState({ height: 50, weight: 55 });
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [loadStatus, setLoadStatus] = useState<string>("");
  const [chartSuggestions, setChartSuggestions] = useState<
    Array<{ chartNumber: string; name: string; birthDate: string; sex: "male" | "female" }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [history, setHistory] = useState<
    Array<{ measurementDate: string; heightCm: number | null; weightKg: number | null }>
  >([]);

  const ageMonths = useMemo(
    () => getAgeMonths(childInfo.birthDate, childInfo.measurementDate),
    [childInfo.birthDate, childInfo.measurementDate]
  );
  const effectiveAge = ageMonths || 24;

  const heightValue = useMemo(() => {
    if (childInfo.heightCm) return Number(childInfo.heightCm);
    return valueAtPercentile("height", effectiveAge, percentiles.height);
  }, [childInfo.heightCm, effectiveAge, percentiles.height]);

  const weightValue = useMemo(() => {
    if (childInfo.weightKg) return Number(childInfo.weightKg);
    return valueAtPercentile("weight", effectiveAge, percentiles.weight);
  }, [childInfo.weightKg, effectiveAge, percentiles.weight]);

  const activePercentile = metric === "height" ? percentiles.height : percentiles.weight;
  const currentValue = metric === "height" ? heightValue : weightValue;

  const { chartData } = useMemo(
    () => buildChartData(metric, effectiveAge, activePercentile, currentValue),
    [metric, effectiveAge, activePercentile, currentValue]
  );

  useEffect(() => {
    if (!childInfo.heightCm) {
      setChildInfo((prev) => ({
        ...prev,
        heightCm: valueAtPercentile("height", effectiveAge, percentiles.height).toFixed(1),
      }));
    }
    if (!childInfo.weightKg) {
      setChildInfo((prev) => ({
        ...prev,
        weightKg: valueAtPercentile("weight", effectiveAge, percentiles.weight).toFixed(1),
      }));
    }
  }, [effectiveAge, childInfo.heightCm, childInfo.weightKg, percentiles.height, percentiles.weight]);

  useEffect(() => {
    const token = searchParams.get("share");
    if (!token) return;
    const payload = getSharedPayload(token);
    if (!payload) return;
    setChildInfo((prev) => ({
      ...prev,
      chartNumber: payload.chartNumber,
      name: payload.name,
      birthDate: payload.birthDate,
      sex: payload.sex,
      measurementDate: payload.measurementDate,
      heightCm: payload.heightCm,
      weightKg: payload.weightKg,
      rrn: "",
    }));
    setMetric(payload.metric);
    setPercentiles((prev) => ({
      ...prev,
      [payload.metric]: payload.percentile,
    }));
  }, [searchParams]);

  useEffect(() => {
    const query = childInfo.chartNumber.trim();
    if (query.length < 2) {
      setChartSuggestions([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("chart_number, name, birth_date, sex")
        .ilike("chart_number", `${query}%`)
        .order("chart_number", { ascending: true })
        .limit(6);

      if (error) {
        setChartSuggestions([]);
        setIsSearching(false);
        return;
      }

      setChartSuggestions(
        (data ?? []).map((item) => ({
          chartNumber: item.chart_number,
          name: item.name,
          birthDate: item.birth_date,
          sex: item.sex,
        }))
      );
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(handle);
  }, [childInfo.chartNumber]);

  const handleFieldChange = (field: keyof ChildInfo, value: string) => {
    setChildInfo((prev) => ({ ...prev, [field]: value }));
    if (field === "heightCm" && value) {
      setPercentiles((prev) => ({
        ...prev,
        height: percentileFromValue("height", effectiveAge, Number(value)),
      }));
    }
    if (field === "weightKg" && value) {
      setPercentiles((prev) => ({
        ...prev,
        weight: percentileFromValue("weight", effectiveAge, Number(value)),
      }));
    }
  };

  const handleRrnChange = (value: string) => {
    setChildInfo((prev) => ({ ...prev, rrn: value }));
    const digits = normalizeRrn(value);
    if (digits.length < 13) {
      setRrnError(null);
      setMaskedRrn(null);
      return;
    }
    if (!isValidRrn(digits)) {
      setRrnError("유효한 주민등록번호가 아닙니다.");
      setMaskedRrn(null);
      return;
    }
    const parsed = parseRrn(digits);
    setChildInfo((prev) => ({
      ...prev,
      birthDate: parsed.birthDate,
      sex: parsed.sex,
    }));
    setMaskedRrn(`${digits.slice(0, 6)}-*******`);
    setRrnError(null);
  };

  const handlePercentileChange = (value: number) => {
    setPercentiles((prev) => ({ ...prev, [metric]: value }));
    if (metric === "height") {
      const newValue = valueAtPercentile("height", effectiveAge, value);
      setChildInfo((prev) => ({ ...prev, heightCm: newValue.toFixed(1) }));
    } else {
      const newValue = valueAtPercentile("weight", effectiveAge, value);
      setChildInfo((prev) => ({ ...prev, weightKg: newValue.toFixed(1) }));
    }
  };

  const handleSave = async () => {
    setSaveStatus("Supabase에 저장 중...");
    try {
      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .upsert(
          {
            chart_number: childInfo.chartNumber,
            name: childInfo.name,
            birth_date: childInfo.birthDate,
            sex: childInfo.sex,
          },
          { onConflict: "chart_number" }
        )
        .select("id")
        .single();

      if (patientError || !patient) {
        setSaveStatus(patientError?.message ?? "저장에 실패했어요.");
        return;
      }

      const { error: measurementError } = await supabase
        .from("measurements")
        .insert({
          patient_id: patient.id,
          measurement_date: childInfo.measurementDate,
          height_cm: childInfo.heightCm ? Number(childInfo.heightCm) : null,
          weight_kg: childInfo.weightKg ? Number(childInfo.weightKg) : null,
        });

      if (measurementError) {
        setSaveStatus(measurementError.message ?? "측정값 저장에 실패했어요.");
        return;
      }

      setSaveStatus("저장 완료! (RRN은 저장하지 않았어요)");
    } catch (error) {
      setSaveStatus("저장 중 오류가 발생했어요.");
    }
  };

  const loadPatientByChartNumber = async (chartNumber: string) => {
    if (!chartNumber) {
      setLoadStatus("차트번호를 입력해주세요.");
      return;
    }
    setLoadStatus("최근 기록을 불러오는 중...");
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, chart_number, name, birth_date, sex")
      .eq("chart_number", chartNumber)
      .single();

    if (patientError || !patient) {
      setLoadStatus("환자 정보를 찾을 수 없어요.");
      return;
    }

    const { data: measurements, error: measurementError } = await supabase
      .from("measurements")
      .select("measurement_date, height_cm, weight_kg")
      .eq("patient_id", patient.id)
      .order("measurement_date", { ascending: false })
      .limit(6);

    if (measurementError) {
      setLoadStatus("측정 기록을 불러오지 못했어요.");
      return;
    }

    const latest = measurements?.[0];
    setChildInfo((prev) => ({
      ...prev,
      chartNumber: patient.chart_number,
      name: patient.name,
      birthDate: patient.birth_date,
      sex: patient.sex,
      measurementDate: latest?.measurement_date ?? prev.measurementDate,
      heightCm: latest?.height_cm?.toString() ?? prev.heightCm,
      weightKg: latest?.weight_kg?.toString() ?? prev.weightKg,
      rrn: "",
    }));

    setHistory(
      (measurements ?? []).map((item) => ({
        measurementDate: item.measurement_date,
        heightCm: item.height_cm,
        weightKg: item.weight_kg,
      }))
    );

    const ageForPercentile = getAgeMonths(
      patient.birth_date,
      latest?.measurement_date ?? childInfo.measurementDate
    );

    if (latest?.height_cm) {
      setPercentiles((prev) => ({
        ...prev,
        height: percentileFromValue("height", ageForPercentile || 24, latest.height_cm),
      }));
    }
    if (latest?.weight_kg) {
      setPercentiles((prev) => ({
        ...prev,
        weight: percentileFromValue("weight", ageForPercentile || 24, latest.weight_kg),
      }));
    }

    setMaskedRrn(null);
    setRrnError(null);
    setLoadStatus("최근 기록을 불러왔어요.");
  };

  const sharePayload = {
    chartNumber: childInfo.chartNumber,
    name: childInfo.name,
    birthDate: childInfo.birthDate,
    sex: childInfo.sex,
    measurementDate: childInfo.measurementDate,
    heightCm: childInfo.heightCm,
    weightKg: childInfo.weightKg,
    metric,
    percentile: activePercentile,
  };

  return (
    <main className="relative min-h-screen bg-[#f8fafc] pb-16 font-display text-[#1a1c24]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(219,234,254,0.8),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(233,213,255,0.6),_transparent_50%)]" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-5 pb-12 pt-10 lg:px-8">
        <header className="flex flex-col gap-3 text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#94a3b8]">
            Pediatric Growth Report
          </p>
          <h1 className="text-3xl font-bold text-[#1a1c24]">{theme.clinicName}</h1>
          <p className="text-sm text-[#64748b]">
            따뜻한 설명과 예측으로 보호자와 의료진이 함께 이해하는 성장 리포트
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr,1fr]">
          <div className="space-y-5">
            <ChildInfoForm
              data={childInfo}
              rrnError={rrnError}
              maskedRrn={maskedRrn}
              onFieldChange={handleFieldChange}
              onRrnChange={handleRrnChange}
              chartSuggestions={chartSuggestions}
              isSearching={isSearching}
              onChartSelect={loadPatientByChartNumber}
            />

            <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur-xl">
              <div>
                <p className="text-xs font-semibold text-[#94a3b8]">보기 기준</p>
                <p className="text-sm font-semibold text-[#1a1c24]">
                  {metric === "height" ? "키" : "몸무게"} 성장 리포트
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/80 p-1">
                <Button
                  variant={metric === "height" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMetric("height")}
                >
                  키
                </Button>
                <Button
                  variant={metric === "weight" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMetric("weight")}
                >
                  몸무게
                </Button>
              </div>
            </div>

            <PercentileSlider
              metric={metric}
              percentile={activePercentile}
              onChange={handlePercentileChange}
            />

            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleSave}>Supabase 저장</Button>
                <Button variant="outline" onClick={() => loadPatientByChartNumber(childInfo.chartNumber)}>
                  최근 기록 불러오기
                </Button>
              </div>
              {saveStatus && <p className="text-xs text-[#64748b]">{saveStatus}</p>}
              {loadStatus && <p className="text-xs text-[#64748b]">{loadStatus}</p>}
              <p className="text-[11px] text-[#94a3b8]">
                주민등록번호는 Supabase에 저장되지 않습니다.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#1a1c24]">최근 측정 기록</p>
                <span className="text-xs text-[#94a3b8]">최대 6회</span>
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-[#94a3b8]">아직 저장된 기록이 없어요.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((item) => (
                    <li
                      key={item.measurementDate}
                      className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-xs text-[#475569]"
                    >
                      <span>{item.measurementDate}</span>
                      <span>
                        {item.heightCm ? `${item.heightCm}cm` : "-"} ·{" "}
                        {item.weightKg ? `${item.weightKg}kg` : "-"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ShareButton reportRef={reportRef} payload={sharePayload} />
          </div>

          <ReportCard
            ref={reportRef}
            clinicName={theme.clinicName}
            chartNumber={childInfo.chartNumber}
            childName={childInfo.name}
            birthDate={childInfo.birthDate}
            sex={childInfo.sex}
            measurementDate={childInfo.measurementDate}
            metric={metric}
            chartData={chartData}
            percentile={activePercentile}
            ageMonths={effectiveAge}
          />
        </section>
      </div>
    </main>
  );
}
