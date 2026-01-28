"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChildInfoForm, { ChildInfo } from "@/components/ChildInfoForm";
import PercentileSlider from "@/components/PercentileSlider";
import ReportCard from "@/components/ReportCard";
import ShareButton from "@/components/ShareButton";
import { Button } from "@/components/ui/button";
import { deriveRrnInfo, normalizeRrn } from "@/lib/rrn";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import {
  Metric,
  buildChartData,
  getAgeMonths,
  percentileFromValue,
  toSexCode,
  valueAtPercentile,
} from "@/lib/percentileLogic";
import { theme } from "@/styles/theme";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const today = new Date().toISOString().slice(0, 10);
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

type ParsedMeasurement = {
  measurement_date: string;
  height_cm: number | null;
  weight_kg: number | null;
};

type CsvParseResult = {
  rows: ParsedMeasurement[];
  skipped: number;
  error?: string;
};

const splitCsvLine = (line: string) => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
};

const isValidIsoDate = (value: string) => {
  if (!isoDateRegex.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const parseMeasurementsCsv = (content: string): CsvParseResult => {
  const trimmed = content.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return { rows: [], skipped: 0, error: "빈 CSV 파일입니다." };
  }
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return { rows: [], skipped: 0, error: "CSV 데이터를 찾을 수 없습니다." };
  }

  let startIndex = 0;
  let columnIndex = { date: 0, height: 1, weight: 2 };
  const headerCells = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const dateIndex = headerCells.findIndex((cell) => cell === "date" || cell === "measurement_date");
  const heightIndex = headerCells.findIndex((cell) => cell === "height_cm" || cell === "height");
  const weightIndex = headerCells.findIndex((cell) => cell === "weight_kg" || cell === "weight");
  if (dateIndex !== -1 && heightIndex !== -1 && weightIndex !== -1) {
    columnIndex = { date: dateIndex, height: heightIndex, weight: weightIndex };
    startIndex = 1;
  }

  let skipped = 0;
  const rows: ParsedMeasurement[] = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    const cells = splitCsvLine(line);
    const date = (cells[columnIndex.date] ?? "").trim();
    if (!date || !isValidIsoDate(date)) {
      skipped += 1;
      continue;
    }

    const heightRaw = (cells[columnIndex.height] ?? "").trim();
    const weightRaw = (cells[columnIndex.weight] ?? "").trim();
    const height = heightRaw ? Number(heightRaw) : null;
    const weight = weightRaw ? Number(weightRaw) : null;

    const heightValue = Number.isFinite(height) ? height : null;
    const weightValue = Number.isFinite(weight) ? weight : null;
    if (heightValue === null && weightValue === null) {
      skipped += 1;
      continue;
    }

    rows.push({
      measurement_date: date,
      height_cm: heightValue,
      weight_kg: weightValue,
    });
  }

  return { rows, skipped };
};

const defaultChildInfo: ChildInfo = {
  chartNumber: "",
  name: "",
  rrn: "",
  birthDate: "",
  sex: "",
  measurementDate: today,
  heightCm: "",
  weightKg: "",
  boneAge: "",
  boneAgeDate: "",
  hormoneLevels: {},
  hormoneTestDate: "",
};

const hasHormoneValues = (levels: Record<string, string> | undefined) =>
  Boolean(levels && Object.values(levels).some((value) => value && value.trim() !== ""));

export default function HomeClient() {
  const searchParams = useSearchParams();
  const reportRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string>("");

  const [childInfo, setChildInfo] = useState<ChildInfo>(defaultChildInfo);
  const [isPristine, setIsPristine] = useState(true);
  const [rrnError, setRrnError] = useState<string | null>(null);
  const [maskedRrn, setMaskedRrn] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("height");
  const [percentiles, setPercentiles] = useState({ height: 50, weight: 55 });
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [loadStatus, setLoadStatus] = useState<string>("");
  const [historyStatus, setHistoryStatus] = useState<string>("");
  const [csvStatus, setCsvStatus] = useState<string>("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [showMeasurementDate, setShowMeasurementDate] = useState(true);
  const [heightLocked, setHeightLocked] = useState(false);
  const [weightLocked, setWeightLocked] = useState(false);
  const [chartSuggestions, setChartSuggestions] = useState<
    Array<{ chartNumber: string; name: string; birthDate: string; sex: "male" | "female" }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [history, setHistory] = useState<
    Array<{ measurementDate: string; heightCm: number | null; weightKg: number | null }>
  >([]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const ageMonths = useMemo(
    () => getAgeMonths(childInfo.birthDate, childInfo.measurementDate),
    [childInfo.birthDate, childInfo.measurementDate]
  );
  const effectiveAge = ageMonths || 24;
  const sexCode = useMemo(() => toSexCode(childInfo.sex), [childInfo.sex]);

  const heightValue = useMemo(() => {
    if (childInfo.heightCm) return Number(childInfo.heightCm);
    return valueAtPercentile("height", sexCode, effectiveAge, percentiles.height);
  }, [childInfo.heightCm, effectiveAge, percentiles.height, sexCode]);

  const weightValue = useMemo(() => {
    if (childInfo.weightKg) return Number(childInfo.weightKg);
    return valueAtPercentile("weight", sexCode, effectiveAge, percentiles.weight);
  }, [childInfo.weightKg, effectiveAge, percentiles.weight, sexCode]);

  const activePercentile = metric === "height" ? percentiles.height : percentiles.weight;
  const currentValue = metric === "height" ? heightValue : weightValue;

  const chartHistory = useMemo(() => {
    if (!childInfo.birthDate) return [];
    return history
      .map((item) => {
        const value = metric === "height" ? item.heightCm : item.weightKg;
        if (value === null || value === undefined) return null;
        const age = getAgeMonths(childInfo.birthDate, item.measurementDate);
        return { ageMonths: age, value };
      })
      .filter((item): item is { ageMonths: number; value: number } => Boolean(item))
      .sort((a, b) => a.ageMonths - b.ageMonths);
  }, [history, childInfo.birthDate, metric]);

  const opinionMeasurements = useMemo(() => {
    const entries = new Map<
      string,
      { measurementDate: string; heightCm: number | null; weightKg: number | null }
    >();
    history.forEach((item) => {
      if (!item.measurementDate) return;
      entries.set(item.measurementDate, {
        measurementDate: item.measurementDate,
        heightCm: item.heightCm,
        weightKg: item.weightKg,
      });
    });

    if (childInfo.measurementDate) {
      const heightValue = childInfo.heightCm ? Number(childInfo.heightCm) : null;
      const weightValue = childInfo.weightKg ? Number(childInfo.weightKg) : null;
      if (heightValue !== null || weightValue !== null) {
        entries.set(childInfo.measurementDate, {
          measurementDate: childInfo.measurementDate,
          heightCm: heightValue,
          weightKg: weightValue,
        });
      }
    }

    return Array.from(entries.values()).sort((a, b) =>
      a.measurementDate < b.measurementDate ? -1 : 1
    );
  }, [history, childInfo.measurementDate, childInfo.heightCm, childInfo.weightKg]);

  const opinionInput = useMemo(
    () => ({
      birthDate: childInfo.birthDate,
      sex: childInfo.sex,
      measurements: opinionMeasurements,
    }),
    [childInfo.birthDate, childInfo.sex, opinionMeasurements]
  );

  const { chartData } = useMemo(
    () =>
      buildChartData(metric, sexCode, effectiveAge, activePercentile, currentValue, chartHistory),
    [metric, sexCode, effectiveAge, activePercentile, currentValue, chartHistory]
  );

  useEffect(() => {
    if (!childInfo.heightCm) {
      setChildInfo((prev) => ({
        ...prev,
        heightCm: valueAtPercentile("height", sexCode, effectiveAge, percentiles.height).toFixed(1),
      }));
    }
    if (!childInfo.weightKg) {
      setChildInfo((prev) => ({
        ...prev,
        weightKg: valueAtPercentile("weight", sexCode, effectiveAge, percentiles.weight).toFixed(1),
      }));
    }
  }, [
    effectiveAge,
    sexCode,
    childInfo.heightCm,
    childInfo.weightKg,
    percentiles.height,
    percentiles.weight,
  ]);

  useEffect(() => {
    const token = searchParams.get("share");
    if (!token) return;
    if (!supabase) return;
    const load = async () => {
      setIsPristine(false);
      const stored = window.localStorage.getItem("growth-report-share");
      if (!stored) return;
      const data = JSON.parse(stored);
      const entry = data[token];
      if (!entry) return;
      if (Date.now() > entry.expiresAt) return;
      const payload = entry.payload;
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
    };
    load();
  }, [searchParams, supabase]);

  useEffect(() => {
    if (!session || !supabase || isPristine) return;
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
        .select("chart_number, name, birth_date, sex, bone_age, bone_age_date, hormone_levels, hormone_test_date")
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
  }, [childInfo.chartNumber, session, supabase, isPristine]);

  const handleFieldChange = (field: keyof ChildInfo, value: string) => {
    setIsPristine(false);
    setChildInfo((prev) => ({ ...prev, [field]: value }));
    if (field === "chartNumber") {
      setHistory([]);
      setPatientId(null);
    }
    if (field === "heightCm") {
      setHeightLocked(value.trim() !== "");
    }
    if (field === "weightKg") {
      setWeightLocked(value.trim() !== "");
    }
    if (field === "heightCm" && value) {
      setPercentiles((prev) => ({
        ...prev,
        height: percentileFromValue("height", sexCode, effectiveAge, Number(value)),
      }));
    }
    if (field === "weightKg" && value) {
      setPercentiles((prev) => ({
        ...prev,
        weight: percentileFromValue("weight", sexCode, effectiveAge, Number(value)),
      }));
    }
  };

  const handleHormoneChange = (key: string, value: string) => {
    setIsPristine(false);
    setChildInfo((prev) => ({
      ...prev,
      hormoneLevels: {
        ...(prev.hormoneLevels ?? {}),
        [key]: value,
      },
    }));
  };

  const handleRrnChange = (value: string) => {
    setIsPristine(false);
    setChildInfo((prev) => ({ ...prev, rrn: value }));
    const digits = normalizeRrn(value);
    if (digits.length < 6) {
      setChildInfo((prev) => ({ ...prev, birthDate: "", sex: "" }));
      setRrnError(null);
      setMaskedRrn(null);
      return;
    }

    const info = deriveRrnInfo(digits);
    setChildInfo((prev) => ({
      ...prev,
      birthDate: info.birthDate ?? prev.birthDate,
      sex: info.sex ?? "",
    }));

    if (digits.length < 13) {
      setRrnError(null);
      setMaskedRrn(null);
      return;
    }

    setMaskedRrn(`${digits.slice(0, 6)}-*******`);
    setRrnError(null);
  };

  const handlePercentileChange = (value: number) => {
    setPercentiles((prev) => ({ ...prev, [metric]: value }));
    if (metric === "height") {
      const newValue = valueAtPercentile("height", sexCode, effectiveAge, value);
      setChildInfo((prev) => ({ ...prev, heightCm: newValue.toFixed(1) }));
      setHeightLocked(false);
    } else {
      const newValue = valueAtPercentile("weight", sexCode, effectiveAge, value);
      setChildInfo((prev) => ({ ...prev, weightKg: newValue.toFixed(1) }));
      setWeightLocked(false);
    }
  };

  const handleSave = async () => {
    if (!session || !supabase) {
      setSaveStatus("로그인 후 저장할 수 있어요.");
      return;
    }
    setSaveStatus("저장 중...");
    try {
      const hormonePayload = hasHormoneValues(childInfo.hormoneLevels)
        ? childInfo.hormoneLevels
        : null;
      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .upsert(
          {
            chart_number: childInfo.chartNumber,
            name: childInfo.name,
            birth_date: childInfo.birthDate,
            sex: childInfo.sex,
            bone_age: childInfo.boneAge || null,
            bone_age_date: childInfo.boneAgeDate || null,
            hormone_levels: hormonePayload,
            hormone_test_date: childInfo.hormoneTestDate || null,
          },
          { onConflict: "chart_number" }
        )
        .select("id")
        .single();

      if (patientError || !patient) {
        setSaveStatus(patientError?.message ?? "저장에 실패했어요.");
        return;
      }
      setPatientId(patient.id);

      const hasMeasurementValues = Boolean(childInfo.heightCm || childInfo.weightKg);
      const measurementDateValid =
        Boolean(childInfo.measurementDate) && isValidIsoDate(childInfo.measurementDate);

      if (measurementDateValid && hasMeasurementValues) {
        const { error: measurementError } = await supabase
          .from("measurements")
          .insert({
            patient_id: patient.id,
            measurement_date: childInfo.measurementDate,
            height_cm: childInfo.heightCm ? Number(childInfo.heightCm) : null,
            weight_kg: childInfo.weightKg ? Number(childInfo.weightKg) : null,
          });

        if (measurementError) {
          setSaveStatus(measurementError.message ?? "??? ??? ?????.");
          return;
        }

        setHistory((prev) => {
          const entry = {
            measurementDate: childInfo.measurementDate,
            heightCm: childInfo.heightCm ? Number(childInfo.heightCm) : null,
            weightKg: childInfo.weightKg ? Number(childInfo.weightKg) : null,
          };
          const filtered = prev.filter((item) => item.measurementDate !== entry.measurementDate);
          return [entry, ...filtered].sort((a, b) =>
            a.measurementDate < b.measurementDate ? 1 : -1
          );
        });

        setSaveStatus("?? ??! (RRN? ???? ???)");
        setHeightLocked(Boolean(childInfo.heightCm));
        setWeightLocked(Boolean(childInfo.weightKg));
      } else {
        setSaveStatus(
          "?? ?? ?? ??! ???/?/???? ?? ?? ??? ???? ????."
        );
        setHeightLocked(false);
        setWeightLocked(false);
      }
    } catch (error) {
      setSaveStatus("저장 중 오류가 발생했어요.");
    }
  };

  const resolvePatientId = async () => {
    if (!supabase) return null;
    if (patientId) return patientId;
    const chartNumber = childInfo.chartNumber.trim();
    if (!chartNumber) return null;
    const { data, error } = await supabase
      .from("patients")
      .select("id")
      .eq("chart_number", chartNumber)
      .maybeSingle();
    if (error || !data?.id) return null;
    setPatientId(data.id);
    return data.id;
  };

  const handleCsvUpload = async () => {
    if (!session || !supabase) {
      setCsvStatus("로그인 후 업로드할 수 있어요.");
      return;
    }
    if (!csvFile) {
      setCsvStatus("CSV 파일을 선택해주세요.");
      return;
    }
    if (!childInfo.chartNumber || !childInfo.name || !childInfo.birthDate || !childInfo.sex) {
      setCsvStatus("아이 기본 정보를 먼저 입력해주세요.");
      return;
    }
    if (!childInfo.measurementDate || !isValidIsoDate(childInfo.measurementDate)) {
      setCsvStatus("최근 측정일을 YYYY-MM-DD 형식으로 입력해주세요.");
      return;
    }

    setCsvStatus("CSV를 읽는 중...");
    let content = "";
    try {
      content = await csvFile.text();
    } catch (error) {
      setCsvStatus("CSV 파일을 읽을 수 없습니다.");
      return;
    }

    const parsed = parseMeasurementsCsv(content);
    if (parsed.error) {
      setCsvStatus(parsed.error);
      return;
    }

    const cutoffDate = childInfo.measurementDate;
    const beforeCutoff = parsed.rows.filter(
      (row) => row.measurement_date < cutoffDate
    );
    const excludedAfter = parsed.rows.length - beforeCutoff.length;

    let duplicateCount = 0;
    const uniqueByDate = new Map<string, ParsedMeasurement>();
    beforeCutoff.forEach((row) => {
      if (uniqueByDate.has(row.measurement_date)) {
        duplicateCount += 1;
      }
      uniqueByDate.set(row.measurement_date, row);
    });
    const uniqueRows = Array.from(uniqueByDate.values());

    if (uniqueRows.length === 0) {
      setCsvStatus("업로드할 이전 기록이 없습니다.");
      return;
    }

    setCsvStatus("환자 정보를 확인하는 중...");
    const hormonePayload = hasHormoneValues(childInfo.hormoneLevels)
      ? childInfo.hormoneLevels
      : null;
    const { data: patient, error: patientError } = await supabase
        .from("patients")
        .upsert(
          {
            chart_number: childInfo.chartNumber,
            name: childInfo.name,
            birth_date: childInfo.birthDate,
            sex: childInfo.sex,
            bone_age: childInfo.boneAge || null,
            bone_age_date: childInfo.boneAgeDate || null,
            hormone_levels: hormonePayload,
            hormone_test_date: childInfo.hormoneTestDate || null,
          },
        { onConflict: "chart_number" }
      )
      .select("id")
      .single();

    if (patientError || !patient) {
      setCsvStatus(patientError?.message ?? "환자 정보를 저장할 수 없습니다.");
      return;
    }
    setPatientId(patient.id);

    const payload = uniqueRows.map((row) => ({
      patient_id: patient.id,
      measurement_date: row.measurement_date,
      height_cm: row.height_cm,
      weight_kg: row.weight_kg,
    }));

    setCsvStatus("CSV 데이터를 업로드하는 중...");
    let measurementError: { message?: string } | null = null;
    const { error: upsertError } = await supabase
      .from("measurements")
      .upsert(payload, { onConflict: "patient_id,measurement_date" });

    if (upsertError) {
      if (upsertError.message?.includes("no unique or exclusion constraint")) {
        const { error: insertError } = await supabase.from("measurements").insert(payload);
        if (insertError) {
          measurementError = insertError;
        }
      } else {
        measurementError = upsertError;
      }
    }

    if (measurementError) {
      setCsvStatus(measurementError.message ?? "CSV 업로드에 실패했어요.");
      return;
    }

    setHistory((prev) => {
      const merged = new Map<string, { measurementDate: string; heightCm: number | null; weightKg: number | null }>();
      prev.forEach((item) => merged.set(item.measurementDate, item));
      uniqueRows.forEach((row) => {
        merged.set(row.measurement_date, {
          measurementDate: row.measurement_date,
          heightCm: row.height_cm,
          weightKg: row.weight_kg,
        });
      });
      return Array.from(merged.values()).sort((a, b) =>
        a.measurementDate < b.measurementDate ? 1 : -1
      );
    });

    const summary = [
      `${uniqueRows.length}건 업로드`,
      parsed.skipped ? `${parsed.skipped}건 제외(형식 오류)` : null,
      excludedAfter ? `${excludedAfter}건 제외(최근 측정일 이후)` : null,
      duplicateCount ? `${duplicateCount}건 제외(중복 날짜)` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const latestRow = uniqueRows.reduce((latest, row) =>
      latest.measurement_date < row.measurement_date ? row : latest
    );
    const latestAge = getAgeMonths(childInfo.birthDate, latestRow.measurement_date);
    setChildInfo((prev) => ({
      ...prev,
      measurementDate: latestRow.measurement_date,
      heightCm:
        typeof latestRow.height_cm === "number"
          ? latestRow.height_cm.toString()
          : prev.heightCm,
      weightKg:
        typeof latestRow.weight_kg === "number"
          ? latestRow.weight_kg.toString()
          : prev.weightKg,
    }));
    setHeightLocked(typeof latestRow.height_cm === "number");
    setWeightLocked(typeof latestRow.weight_kg === "number");
    setPercentiles((prev) => ({
      ...prev,
      height:
        typeof latestRow.height_cm === "number"
          ? percentileFromValue("height", sexCode, latestAge || 24, latestRow.height_cm)
          : prev.height,
      weight:
        typeof latestRow.weight_kg === "number"
          ? percentileFromValue("weight", sexCode, latestAge || 24, latestRow.weight_kg)
          : prev.weight,
    }));

    setCsvStatus(`CSV 업로드 완료! ${summary}`);
    setCsvFile(null);
    setShowMeasurementDate(false);
    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
  };

  const handleDeleteHistory = async (measurementDate: string) => {
    if (!session || !supabase) {
      setHistoryStatus("로그인 후 삭제할 수 있어요.");
      return;
    }
    if (measurementDate === childInfo.measurementDate) {
      setHistoryStatus("최근 측정일은 삭제할 수 없어요.");
      return;
    }
    setHistoryStatus("삭제 중...");
    const resolvedId = await resolvePatientId();
    if (!resolvedId) {
      setHistoryStatus("환자 정보를 찾을 수 없어요.");
      return;
    }
    const { error } = await supabase
      .from("measurements")
      .delete()
      .eq("patient_id", resolvedId)
      .eq("measurement_date", measurementDate);

    if (error) {
      setHistoryStatus(error.message ?? "삭제에 실패했어요.");
      return;
    }
    setHistory((prev) => prev.filter((item) => item.measurementDate !== measurementDate));
    setHistoryStatus("삭제 완료!");
  };

  const loadPatientByChartNumber = async (chartNumber: string) => {
    if (!session || !supabase) {
      setLoadStatus("로그인 후 불러올 수 있어요.");
      return;
    }
    if (!chartNumber) {
      setLoadStatus("차트번호를 입력해주세요.");
      return;
    }
    setLoadStatus("최근 기록을 불러오는 중...");
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, chart_number, name, birth_date, sex, bone_age, bone_age_date, hormone_levels, hormone_test_date")
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
      .order("measurement_date", { ascending: false });

    if (measurementError) {
      setLoadStatus("측정 기록을 불러오지 못했어요.");
      return;
    }

    const latest = measurements?.[0];
    setIsPristine(false);
    setChildInfo((prev) => ({
      ...prev,
      chartNumber: patient.chart_number,
      name: patient.name,
      birthDate: patient.birth_date,
      sex: patient.sex,
      boneAge: patient.bone_age ?? prev.boneAge,
      boneAgeDate: patient.bone_age_date ?? prev.boneAgeDate,
      hormoneLevels:
        patient.hormone_levels && typeof patient.hormone_levels === "object"
          ? patient.hormone_levels
          : prev.hormoneLevels,
      hormoneTestDate: patient.hormone_test_date ?? prev.hormoneTestDate,
      measurementDate: latest?.measurement_date ?? prev.measurementDate,
      heightCm: latest?.height_cm?.toString() ?? prev.heightCm,
      weightKg: latest?.weight_kg?.toString() ?? prev.weightKg,
      rrn: "",
    }));
    setHeightLocked(Boolean(latest?.height_cm));
    setWeightLocked(Boolean(latest?.weight_kg));

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
        height: percentileFromValue("height", sexCode, ageForPercentile || 24, latest.height_cm),
      }));
    }
    if (latest?.weight_kg) {
      setPercentiles((prev) => ({
        ...prev,
        weight: percentileFromValue("weight", sexCode, ageForPercentile || 24, latest.weight_kg),
      }));
    }

    setMaskedRrn(null);
    setRrnError(null);
    setLoadStatus("최근 기록을 불러왔어요.");
    setPatientId(patient.id);
    setShowMeasurementDate(true);
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

        {authLoading ? (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold text-[#1a1c24]">로그인 확인 중</h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#64748b]">잠시만 기다려주세요.</p>
            </CardContent>
          </Card>
        ) : !supabase ? (
          <Card className="max-w-lg">
            <CardHeader>
              <h2 className="text-lg font-bold text-[#1a1c24]">환경변수 설정 필요</h2>
              <p className="text-sm text-[#64748b]">
                NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#94a3b8]">
                Vercel Project Settings → Environment Variables에서 추가 후 Redeploy해주세요.
              </p>
            </CardContent>
          </Card>
        ) : !session ? (
          <Card className="max-w-lg">
            <CardHeader>
              <h2 className="text-lg font-bold text-[#1a1c24]">클리닉 로그인</h2>
              <p className="text-sm text-[#64748b]">
                병원 계정으로 로그인해야 기록을 조회/저장할 수 있어요.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="clinic@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="********"
                />
              </div>
              <Button
                onClick={async () => {
                  setAuthMessage("로그인 중...");
                  const { error } = await supabase.auth.signInWithPassword({
                    email: authEmail,
                    password: authPassword,
                  });
                  if (error) {
                    setAuthMessage(error.message ?? "로그인에 실패했어요.");
                    return;
                  }
                  setAuthMessage("로그인 완료!");
                }}
              >
                로그인
              </Button>
              {authMessage && <p className="text-xs text-[#64748b]">{authMessage}</p>}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur-xl">
              <div>
                <p className="text-xs text-[#94a3b8]">로그인 계정</p>
                <p className="text-sm font-semibold text-[#1a1c24]">{session.user.email}</p>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setChartSuggestions([]);
                  setHistory([]);
                  setChildInfo(defaultChildInfo);
                  setIsPristine(true);
                  setCsvFile(null);
                  setCsvStatus("");
                  setHistoryStatus("");
                  setPatientId(null);
                  setShowMeasurementDate(true);
                  setHeightLocked(false);
                  setWeightLocked(false);
                }}
              >
                로그아웃
              </Button>
            </div>

            <section className="grid gap-6 lg:grid-cols-[1.05fr,1fr]">
              <div className="space-y-5">
                <ChildInfoForm
                  data={childInfo}
                  rrnError={rrnError}
                  maskedRrn={maskedRrn}
                  isPristine={isPristine}
                  onFieldChange={handleFieldChange}
                  onRrnChange={handleRrnChange}
                  onHormoneChange={handleHormoneChange}
                  chartSuggestions={chartSuggestions}
                  isSearching={isSearching}
                  onChartSelect={loadPatientByChartNumber}
                  csvStatus={csvStatus}
                  csvInputRef={csvInputRef}
                  onCsvFileChange={(file) => {
                    setCsvFile(file);
                    setCsvStatus("");
                  }}
                  onCsvUpload={handleCsvUpload}
                  showMeasurementDate={showMeasurementDate}
                  onShowMeasurementDate={() => {
                    setShowMeasurementDate(true);
                    setCsvFile(null);
                    setCsvStatus("");
                    if (csvInputRef.current) {
                      csvInputRef.current.value = "";
                    }
                  }}
                />

                <div className="space-y-3 rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleSave}>저장</Button>
                    <Button variant="outline" onClick={() => loadPatientByChartNumber(childInfo.chartNumber)}>
                      최근 기록 불러오기
                    </Button>
                  </div>
                  {saveStatus && <p className="text-xs text-[#64748b]">{saveStatus}</p>}
                  {loadStatus && <p className="text-xs text-[#64748b]">{loadStatus}</p>}
                  <p className="text-[11px] text-[#94a3b8]">
                    주민등록번호는 저장되지 않습니다.
                  </p>
                </div>

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
                  disabled={metric === "height" ? heightLocked : weightLocked}
                />

                <div className="space-y-3 rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#1a1c24]">최근 측정 기록</p>
                    <span className="text-xs text-[#94a3b8]">전체</span>
                  </div>
                  {history.length === 0 ? (
                    <p className="text-xs text-[#94a3b8]">아직 저장된 기록이 없어요.</p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((item) => {
                        const ageForItem = childInfo.birthDate
                          ? getAgeMonths(childInfo.birthDate, item.measurementDate)
                          : null;
                        const heightPercentile =
                          ageForItem !== null && item.heightCm !== null
                            ? percentileFromValue("height", sexCode, ageForItem, item.heightCm)
                            : null;
                        const weightPercentile =
                          ageForItem !== null && item.weightKg !== null
                            ? percentileFromValue("weight", sexCode, ageForItem, item.weightKg)
                            : null;

                        return (
                          <li
                            key={item.measurementDate}
                            className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-xs text-[#475569]"
                          >
                            <div className="flex flex-col">
                              <span>{item.measurementDate}</span>
                              <span className="text-[10px] text-[#94a3b8]">
                                {heightPercentile !== null
                                  ? `키 P${heightPercentile}`
                                  : "키 -"}{" "}
                                ·{" "}
                                {weightPercentile !== null
                                  ? `몸무게 P${weightPercentile}`
                                  : "몸무게 -"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span>
                                {item.heightCm ? `${item.heightCm}cm` : "-"} ·{" "}
                                {item.weightKg ? `${item.weightKg}kg` : "-"}
                              </span>
                              {item.measurementDate !== childInfo.measurementDate && (
                                <button
                                  type="button"
                                  className="rounded-full border border-white/80 px-2 py-1 text-[10px] font-semibold text-[#475569] hover:bg-white"
                                  onClick={() => handleDeleteHistory(item.measurementDate)}
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {historyStatus && <p className="text-xs text-[#64748b]">{historyStatus}</p>}
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
                opinionInput={opinionInput}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
