"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Measurement, TherapyCourse, PatientInfo, HormoneLevels } from "@/lib/types";
import {
  loadMeasurements,
  loadTherapyCourses,
  saveMeasurements,
  saveTherapyCourses,
  clearGrowthStorage,
  loadPatientInfo,
  savePatientInfo,
  upsertPatientDirectory,
  loadPatientDirectory,
  loadPatientData,
  savePatientData,
} from "@/lib/storage";
import { buildDemoMeasurements, buildDemoTherapies } from "@/lib/demoData";
import { deriveRrnInfo, normalizeRrn } from "@/lib/rrn";
import { addMonths, differenceInMonths, format, parseISO } from "date-fns";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import GrowthPercentileChart from "@/components/GrowthPercentileChart";
import MeasurementsPanel from "@/components/MeasurementsPanel";
import TherapyPanel from "@/components/TherapyPanel";
import GrowthOpinionPanel from "@/components/GrowthOpinionPanel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAgeMonths, percentileFromValue, valueAtPercentile } from "@/lib/percentileLogic";
import {
  estimateIgf1Percentile,
  formatIgf1Range,
  getAgeYears,
  getIgf1Reference,
} from "@/lib/igf1Roche";
import type { NormalizedTestKey, ParsedResult } from "@/lib/labs/types";

const sortMeasurements = (items: Measurement[]) =>
  [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

const sortTherapies = (items: TherapyCourse[]) =>
  [...items].sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0
  );

const LAB_KEY_TO_HORMONE: Record<NormalizedTestKey, keyof HormoneLevels> = {
  hba1c: "HbA1c",
  ft4: "fT4",
  tsh: "TSH",
  lh: "LH",
  fsh: "FSH",
  testosterone: "Testosterone",
  estradiol: "E2",
  igfbp3: "IGF_BP3",
  igf1: "IGF_1",
  dhea: "DHEA",
};

const LAB_HORMONE_TO_KEY: Partial<Record<keyof HormoneLevels, NormalizedTestKey>> = {
  HbA1c: "hba1c",
  fT4: "ft4",
  TSH: "tsh",
  LH: "lh",
  FSH: "fsh",
  Testosterone: "testosterone",
  E2: "estradiol",
  IGF_BP3: "igfbp3",
  IGF_1: "igf1",
  DHEA: "dhea",
};

const normalizeHormoneLevels = (value: unknown): Record<string, string> => {
  if (!value) return {};
  if (typeof value === "object") {
    return value as Record<string, string>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, string>;
      }
    } catch (error) {
      return {};
    }
  }
  return {};
};

type ChartSuggestion = {
  chartNumber: string;
  name: string;
  birthDate: string;
  sex: PatientInfo["sex"];
};

function PageContent() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
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
    hormoneLevels: {},
    hormoneTestDate: "",
  });
  const [hydrated, setHydrated] = useState(false);
  const [showBoneAge, setShowBoneAge] = useState(false);
  const [showHormoneLevels, setShowHormoneLevels] = useState(false);
  const boneAgeToggledRef = useRef(false);
  const hormoneToggledRef = useRef(false);
  const [loadStatus, setLoadStatus] = useState("");
  const [chartSuggestions, setChartSuggestions] = useState<ChartSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [labFile, setLabFile] = useState<File | null>(null);
  const [labResults, setLabResults] = useState<Record<NormalizedTestKey, ParsedResult>>(
    {} as Record<NormalizedTestKey, ParsedResult>
  );
  const [labCollectedAt, setLabCollectedAt] = useState("");
  const [labMethod, setLabMethod] = useState<"pdf-text" | "ocr" | null>(null);
  const [labRawText, setLabRawText] = useState("");
  const [labImportStatus, setLabImportStatus] = useState("");
  const [labSaveStatus, setLabSaveStatus] = useState("");
  const [saveRawText, setSaveRawText] = useState(false);
  const [boneAgeInput, setBoneAgeInput] = useState("");
  const [boneAgeDateInput, setBoneAgeDateInput] = useState("");
  const [hormoneTestDateInput, setHormoneTestDateInput] = useState("");
  const [hormoneInputValues, setHormoneInputValues] = useState<Record<string, string>>({});

  const hormoneFields = useMemo(
    () => [
      { key: "LH", label: "LH", unitCaption: "mIU/mL", summaryUnit: "mIU/mL" },
      { key: "FSH", label: "FSH", unitCaption: "mIU/mL", summaryUnit: "mIU/mL" },
      { key: "E2", label: "E2", unitCaption: "ng/mL", summaryUnit: "ng/mL" },
      { key: "Testosterone", label: "Testosterone", unitCaption: "ng/mL", summaryUnit: "ng/mL" },
      { key: "TSH", label: "TSH", unitCaption: "uIU/mL", summaryUnit: "uIU/mL" },
      { key: "fT4", label: "fT4", unitCaption: "ng/dL", summaryUnit: "ng/dL" },
      { key: "DHEA", label: "DHEA", unitCaption: "ng/mL", summaryUnit: "ng/mL" },
      { key: "IGF_BP3", label: "IGF-BP3", unitCaption: "ng/mL", summaryUnit: "ng/mL" },
      {
        key: "IGF_1",
        label: "IGF-1",
        summaryLabel: "Somatomedin-C",
        unitCaption: "Somatomedin-C ng/mL",
        summaryUnit: "ng/mL",
      },
      { key: "HbA1c", label: "HbA1c", unitCaption: "%", summaryUnit: "%" },
    ],
    []
  );

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    setAuthLoading(true);
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const storedMeasurements = loadMeasurements();
    const storedCourses = loadTherapyCourses();
    const storedPatient = loadPatientInfo();
    setMeasurements(sortMeasurements(storedMeasurements));
    setTherapyCourses(sortTherapies(storedCourses));
    if (storedPatient) {
      setPatientInfo(storedPatient);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (authLoading) return;
    const target = searchParams.get("patient");
    if (!target) return;
    void handleLoadPatient(target);
  }, [hydrated, searchParams, authLoading]);

  useEffect(() => {
    if (!hydrated) return;
    if (!supabase || !session) return;
    const chartNumber = patientInfo.chartNumber.trim();
    if (!chartNumber) return;
    if (!patientInfo.name || !patientInfo.birthDate || !patientInfo.sex) return;
    const hormonePayload =
      patientInfo.hormoneLevels &&
      typeof patientInfo.hormoneLevels === "object" &&
      Object.values(patientInfo.hormoneLevels).some(
        (value) => value && value.trim() !== ""
      )
        ? patientInfo.hormoneLevels
        : null;

    const timer = setTimeout(async () => {
      try {
        const { data: patient, error: patientError } = await supabase
          .from("patients")
          .upsert(
            {
              chart_number: chartNumber,
              name: patientInfo.name,
              birth_date: patientInfo.birthDate,
              sex: patientInfo.sex,
              bone_age: patientInfo.boneAge || null,
              bone_age_date: patientInfo.boneAgeDate || null,
              hormone_levels: hormonePayload,
              hormone_test_date: patientInfo.hormoneTestDate || null,
            },
            { onConflict: "chart_number" }
          )
          .select("id")
          .single();

        if (patientError || !patient) {
          return;
        }

        const payload = measurements.map((item) => ({
          patient_id: patient.id,
          measurement_date: item.date,
          height_cm: item.heightCm ?? null,
          weight_kg: item.weightKg ?? null,
        }));

        if (payload.length > 0) {
          const { error: upsertError } = await supabase
            .from("measurements")
            .upsert(payload, { onConflict: "patient_id,measurement_date" });

          if (upsertError?.message?.includes("no unique or exclusion constraint")) {
            await supabase.from("measurements").insert(payload);
          }
        }
      } catch (error) {
        return;
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    hydrated,
    supabase,
    session,
    patientInfo.chartNumber,
    patientInfo.name,
    patientInfo.birthDate,
    patientInfo.sex,
    patientInfo.boneAge,
    patientInfo.boneAgeDate,
    patientInfo.hormoneLevels,
    patientInfo.hormoneTestDate,
    measurements,
  ]);

  useEffect(() => {
    if (patientInfo.hormoneTestDate && !labCollectedAt) {
      setLabCollectedAt(patientInfo.hormoneTestDate);
    }
  }, [patientInfo.hormoneTestDate, labCollectedAt]);

  useEffect(() => {
    if (!hydrated) return;
    const query = patientInfo.chartNumber.trim();
    if (query.length < 2) {
      setChartSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (supabase && session) {
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
            name: item.name ?? "",
            birthDate: item.birth_date ?? "",
            sex: item.sex ?? "",
          }))
        );
        setIsSearching(false);
      }, 250);

      return () => clearTimeout(handle);
    }

    const local = loadPatientDirectory()
      .filter((item) => item.chartNumber?.startsWith(query))
      .slice(0, 6)
      .map((item) => ({
        chartNumber: item.chartNumber,
        name: item.name,
        birthDate: item.birthDate,
        sex: item.sex,
      }));
    setChartSuggestions(local);
    setIsSearching(false);
  }, [hydrated, patientInfo.chartNumber, session, supabase]);

  const hasBoneAgeValue = Boolean(patientInfo.boneAge?.trim() || patientInfo.boneAgeDate);
  const hasHormoneValue =
    typeof patientInfo.hormoneLevels === "string"
      ? patientInfo.hormoneLevels.trim()
      : Object.values(patientInfo.hormoneLevels ?? {}).some(
          (value) => value && value.trim() !== ""
        );

  useEffect(() => {
    if (!hydrated) return;
    if (!boneAgeToggledRef.current && hasBoneAgeValue && !showBoneAge) {
      setShowBoneAge(true);
    }
    if (!hormoneToggledRef.current && (hasHormoneValue || patientInfo.hormoneTestDate) && !showHormoneLevels) {
      setShowHormoneLevels(true);
    }
    if (!hasBoneAgeValue && !showBoneAge) {
      boneAgeToggledRef.current = false;
    }
    if (!hasHormoneValue && !patientInfo.hormoneTestDate && !showHormoneLevels) {
      hormoneToggledRef.current = false;
    }
  }, [
    hydrated,
    hasBoneAgeValue,
    hasHormoneValue,
    patientInfo.hormoneTestDate,
    showBoneAge,
    showHormoneLevels,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    saveMeasurements(measurements);
  }, [measurements, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveTherapyCourses(therapyCourses);
  }, [therapyCourses, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    savePatientInfo(patientInfo);
  }, [patientInfo, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const name = patientInfo.name?.trim() ?? "";
    const chartNumber = patientInfo.chartNumber?.trim() ?? "";
    const birthDate = patientInfo.birthDate ?? "";
    const sex = patientInfo.sex;
    const hasKey = Boolean(chartNumber || (name && birthDate));
    if (!hasKey) return;
    if (measurements.length === 0 && therapyCourses.length === 0) return;

    const sorted = [...measurements].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );
    const lastMeasurementDate = sorted.length ? sorted[sorted.length - 1].date : undefined;
    const id = chartNumber || `${name}_${birthDate}`;

    upsertPatientDirectory({
      id,
      name,
      chartNumber,
      birthDate,
      sex,
      updatedAt: new Date().toISOString(),
      measurementCount: measurements.length,
      therapyCount: therapyCourses.length,
      lastMeasurementDate,
    });

    savePatientData(id, {
      patientInfo,
      measurements,
      therapyCourses,
    });
  }, [hydrated, patientInfo, measurements, therapyCourses]);

  const handleAddMeasurement = (measurement: Measurement) => {
    setMeasurements((prev) => sortMeasurements([...prev, measurement]));
  };

  const handleUpdateMeasurement = (measurement: Measurement) => {
    setMeasurements((prev) =>
      sortMeasurements(prev.map((item) => (item.id === measurement.id ? measurement : item)))
    );
  };

  const handleDeleteMeasurement = (id: string) => {
    setMeasurements((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddTherapy = (course: TherapyCourse) => {
    setTherapyCourses((prev) => sortTherapies([...prev, course]));
  };

  const handleUpdateTherapy = (course: TherapyCourse) => {
    setTherapyCourses((prev) =>
      sortTherapies(prev.map((item) => (item.id === course.id ? course : item)))
    );
  };

  const handleDeleteTherapy = (id: string) => {
    setTherapyCourses((prev) => prev.filter((item) => item.id !== id));
  };

  const handleReset = () => {
    const demoMeasurements = buildDemoMeasurements();
    const demoCourses = buildDemoTherapies(demoMeasurements);
    setMeasurements(sortMeasurements(demoMeasurements));
    setTherapyCourses(sortTherapies(demoCourses));
    setPatientInfo({
      name: "",
      chartNumber: "",
      rrn: "",
      sex: "",
      birthDate: "",
      boneAge: "",
      boneAgeDate: "",
      hormoneLevels: {},
      hormoneTestDate: "",
    });
    setBoneAgeInput("");
    setBoneAgeDateInput("");
    setHormoneTestDateInput("");
    setHormoneInputValues({});
    setShowBoneAge(false);
    setShowHormoneLevels(false);
    clearGrowthStorage();
    saveMeasurements(demoMeasurements);
    saveTherapyCourses(demoCourses);
  };

  const handleCsvImport = (items: Measurement[]) => {
    let added = 0;
    let updated = 0;
    const byDate = new Map<string, Measurement>();
    measurements.forEach((item) => byDate.set(item.date, item));
    items.forEach((item) => {
      const existing = byDate.get(item.date);
      if (existing) {
        byDate.set(item.date, {
          ...existing,
          heightCm: item.heightCm ?? existing.heightCm,
          weightKg: item.weightKg ?? existing.weightKg,
        });
        updated += 1;
      } else {
        byDate.set(item.date, item);
        added += 1;
      }
    });
    setMeasurements(sortMeasurements(Array.from(byDate.values())));
    return { added, updated, skipped: items.length - added - updated };
  };

  const applyLabResultsToForm = (
    results: Record<NormalizedTestKey, ParsedResult>,
    collectedAtValue?: string | null
  ) => {
    const updates: Partial<HormoneLevels> = {};
    Object.entries(results).forEach(([key, result]) => {
      const hormoneKey = LAB_KEY_TO_HORMONE[key as NormalizedTestKey];
      if (!hormoneKey) return;
      updates[hormoneKey] = result.valueRaw;
    });
    if (Object.keys(updates).length > 0) {
      setPatientInfo((prev) => ({
        ...prev,
        hormoneLevels: {
          ...((typeof prev.hormoneLevels === "object" && prev.hormoneLevels)
            ? prev.hormoneLevels
            : {}),
          ...updates,
        },
        hormoneTestDate: collectedAtValue ?? prev.hormoneTestDate ?? "",
      }));
    } else if (collectedAtValue) {
      setPatientInfo((prev) => ({
        ...prev,
        hormoneTestDate: collectedAtValue,
      }));
    }
    setHormoneInputValues({});
  };

  const parseLabNumeric = (raw: string) => {
    const numeric = Number(raw.replace(/[<>≤≥＜＞]/g, "").trim());
    return Number.isFinite(numeric) ? numeric : null;
  };

  const commitBoneAge = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPatientInfo((prev) => ({
      ...prev,
      boneAge: trimmed,
    }));
    setBoneAgeInput("");
  };

  const commitBoneAgeDate = (value: string) => {
    if (!value) return;
    setPatientInfo((prev) => ({
      ...prev,
      boneAgeDate: value,
    }));
    setBoneAgeDateInput("");
  };

  const commitHormoneTestDate = (value: string) => {
    if (!value) return;
    setPatientInfo((prev) => ({
      ...prev,
      hormoneTestDate: value,
    }));
    setHormoneTestDateInput("");
  };

  const commitHormoneValue = (key: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setHormoneInputValues((prev) => ({
        ...prev,
        [key]: "",
      }));
      return;
    }
    setPatientInfo((prev) => ({
      ...prev,
      hormoneLevels: {
        ...((typeof prev.hormoneLevels === "object" && prev.hormoneLevels)
          ? prev.hormoneLevels
          : {}),
        [key]: trimmed,
      },
    }));
    const labKey = LAB_HORMONE_TO_KEY[key as keyof HormoneLevels];
    if (labKey) {
      setLabResults((prev) => ({
        ...prev,
        [labKey]: {
          testKey: labKey,
          valueRaw: trimmed,
          valueNumeric: parseLabNumeric(trimmed),
          unit: prev[labKey]?.unit ?? null,
          sourceLine: prev[labKey]?.sourceLine ?? "",
          matchedBy: prev[labKey]?.matchedBy ?? "manual",
        },
      }));
    }
    setHormoneInputValues((prev) => ({
      ...prev,
      [key]: "",
    }));
  };

  const handleImportLabPdf = async () => {
    if (!session || !supabase) {
      setLabImportStatus("로그인 후 업로드할 수 있어요.");
      return;
    }
    if (!labFile) {
      setLabImportStatus("PDF 파일을 선택해주세요.");
      return;
    }

    setLabImportStatus("PDF를 분석하는 중...");
    try {
      const formData = new FormData();
      formData.append("file", labFile);
      const response = await fetch("/api/labs/import-pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      if (!response.ok) {
        throw new Error("import failed");
      }
      const data = (await response.json()) as {
        collectedAt: string | null;
        results: Record<NormalizedTestKey, ParsedResult>;
        method: "pdf-text" | "ocr";
        rawText: string;
      };
      setLabResults(data.results ?? {});
      setLabCollectedAt(data.collectedAt ?? "");
      setLabMethod(data.method ?? null);
      setLabRawText(data.rawText ?? "");
      applyLabResultsToForm(data.results ?? {}, data.collectedAt);
      setShowHormoneLevels(true);
      hormoneToggledRef.current = true;
      setLabImportStatus("추출 완료!");
    } catch (error) {
      setLabImportStatus("추출 실패: PDF 내용을 확인해주세요.");
    }
  };

  const handleSaveLabResults = async () => {
    if (!session || !supabase) {
      setLabSaveStatus("로그인 후 저장할 수 있어요.");
      return;
    }
    if (!patientInfo.chartNumber) {
      setLabSaveStatus("차트번호를 입력해주세요.");
      return;
    }
    if (!labCollectedAt) {
      setLabSaveStatus("검체접수일을 입력해주세요.");
      return;
    }
    if (!labMethod) {
      setLabSaveStatus("먼저 PDF를 업로드해주세요.");
      return;
    }
    setLabSaveStatus("저장 중...");
    try {
      const response = await fetch("/api/labs/save", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chartNumber: patientInfo.chartNumber,
          collectedAt: labCollectedAt,
          results: labResults,
          extractionMethod: labMethod,
          rawText: saveRawText ? labRawText : null,
        }),
      });
      if (!response.ok) {
        let message = "저장에 실패했습니다.";
        try {
          const data = (await response.json()) as { error?: string };
          if (data?.error) {
            message = `저장 실패: ${data.error}`;
          }
        } catch {
          // Ignore JSON parse failures
        }
        setLabSaveStatus(message);
        return;
      }
      setLabSaveStatus("저장 완료!");
    } catch (error) {
      setLabSaveStatus("저장에 실패했습니다.");
    }
  };

  const handleLoadPatient = async (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) {
      setLoadStatus("차트번호를 입력해주세요.");
      return;
    }
    setPatientInfo((prev) => ({
      ...prev,
      chartNumber: trimmed,
    }));
    const stored = loadPatientData(trimmed);
    if (stored) {
      setPatientInfo(stored.patientInfo);
      setMeasurements(sortMeasurements(stored.measurements));
      setTherapyCourses(sortTherapies(stored.therapyCourses));
      setLabResults({} as Record<NormalizedTestKey, ParsedResult>);
      setLabCollectedAt(stored.patientInfo.hormoneTestDate ?? "");
      setLabMethod(null);
      setLabRawText("");
      setBoneAgeInput("");
      setBoneAgeDateInput("");
      setHormoneTestDateInput("");
      setHormoneInputValues({});
      setLoadStatus("환자 데이터를 불러왔어요.");
      return;
    }
    if (!supabase || !session) {
      setLoadStatus("해당 차트번호의 저장된 데이터가 없습니다.");
      return;
    }
    setLoadStatus("환자 데이터를 불러오는 중...");
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, chart_number, name, birth_date, sex, bone_age, bone_age_date, hormone_levels, hormone_test_date")
      .eq("chart_number", trimmed)
      .single();

    if (patientError || !patient) {
      setLoadStatus("환자 정보를 찾을 수 없습니다.");
      return;
    }

    const { data: measurementsData, error: measurementsError } = await supabase
      .from("measurements")
      .select("measurement_date, height_cm, weight_kg")
      .eq("patient_id", patient.id)
      .order("measurement_date", { ascending: true });

    if (measurementsError) {
      setLoadStatus("측정 기록을 불러오지 못했어요.");
      return;
    }

    const mappedMeasurements: Measurement[] = (measurementsData ?? []).map((item, index) => ({
      id: `${patient.id}-${item.measurement_date}-${index}`,
      date: item.measurement_date,
      heightCm: item.height_cm ?? undefined,
      weightKg: item.weight_kg ?? undefined,
    }));

    setPatientInfo({
      name: patient.name ?? "",
      chartNumber: patient.chart_number ?? trimmed,
      rrn: "",
      sex: patient.sex ?? "",
      birthDate: patient.birth_date ?? "",
      boneAge: patient.bone_age ?? "",
      boneAgeDate: patient.bone_age_date ?? "",
      hormoneLevels: normalizeHormoneLevels(patient.hormone_levels),
      hormoneTestDate: patient.hormone_test_date ?? "",
    });
    setBoneAgeInput("");
    setBoneAgeDateInput("");
    setHormoneTestDateInput("");
    setHormoneInputValues({});
    setLabResults({} as Record<NormalizedTestKey, ParsedResult>);
    setLabCollectedAt(patient.hormone_test_date ?? "");
    setLabMethod(null);
    setLabRawText("");
    setMeasurements(sortMeasurements(mappedMeasurements));
    setTherapyCourses([]);
    setLoadStatus("환자 데이터를 불러왔어요.");
  };

  const handleRrnChange = (value: string) => {
    const digits = normalizeRrn(value);
    const info = deriveRrnInfo(digits);
    setPatientInfo((prev) => ({
      ...prev,
      rrn: value,
      sex: info.sex ?? prev.sex,
      birthDate: info.birthDate ?? prev.birthDate,
    }));
  };

  const ageLabel = useMemo(() => {
    if (!patientInfo.birthDate) return "";
    const months = differenceInMonths(new Date(), parseISO(patientInfo.birthDate));
    if (!Number.isFinite(months) || months < 0) return "";
    const years = Math.floor(months / 12);
    const remaining = months % 12;
    if (years <= 0) return `${remaining}개월`;
    return remaining === 0 ? `${years}세` : `${years}세 ${remaining}개월`;
  }, [patientInfo.birthDate]);

  const totalSummary = useMemo(
    () => ({
      measurements: measurements.length,
      therapies: therapyCourses.length,
    }),
    [measurements.length, therapyCourses.length]
  );

  const latestMeasurement = useMemo(() => {
    const sorted = sortMeasurements(measurements);
    return sorted.length ? sorted[sorted.length - 1] : null;
  }, [measurements]);

  const latestAgeMonths = useMemo(() => {
    if (!patientInfo.birthDate || !latestMeasurement?.date) return null;
    return getAgeMonths(patientInfo.birthDate, latestMeasurement.date);
  }, [patientInfo.birthDate, latestMeasurement]);

  const latestHeightPercentile = useMemo(() => {
    if (!patientInfo.sex) return null;
    if (
      latestMeasurement?.heightCm === undefined ||
      latestMeasurement?.heightCm === null ||
      latestAgeMonths === null
    ) {
      return null;
    }
    return percentileFromValue(
      "height",
      patientInfo.sex,
      latestAgeMonths,
      latestMeasurement.heightCm
    );
  }, [latestMeasurement, latestAgeMonths, patientInfo.sex]);

  const latestWeightPercentile = useMemo(() => {
    if (!patientInfo.sex) return null;
    if (
      latestMeasurement?.weightKg === undefined ||
      latestMeasurement?.weightKg === null ||
      latestAgeMonths === null
    ) {
      return null;
    }
    return percentileFromValue(
      "weight",
      patientInfo.sex,
      latestAgeMonths,
      latestMeasurement.weightKg
    );
  }, [latestMeasurement, latestAgeMonths, patientInfo.sex]);

  const hormoneValues: Record<string, string> =
    typeof patientInfo.hormoneLevels === "string"
      ? {}
      : (patientInfo.hormoneLevels ?? {});

  const igf1Insight = useMemo(() => {
    const raw = hormoneValues.IGF_1?.trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    if (patientInfo.sex !== "male" && patientInfo.sex !== "female") return null;
    if (!patientInfo.birthDate) return null;
    const referenceDate =
      patientInfo.hormoneTestDate ||
      latestMeasurement?.date ||
      new Date().toISOString().slice(0, 10);
    const ageYears = getAgeYears(patientInfo.birthDate, referenceDate);
    if (ageYears === null) return null;
    const reference = getIgf1Reference(patientInfo.sex, ageYears);
    if (!reference) return null;
    const percentile = estimateIgf1Percentile(value, reference);
    return {
      percentile,
      range: formatIgf1Range(reference),
      ageYears,
      referenceDate,
    };
  }, [
    hormoneValues.IGF_1,
    latestMeasurement?.date,
    patientInfo.birthDate,
    patientInfo.hormoneTestDate,
    patientInfo.sex,
  ]);

  const boneAgeChronological = useMemo(() => {
    if (!patientInfo.birthDate || !patientInfo.boneAgeDate) return "";
    const months = getAgeMonths(patientInfo.birthDate, patientInfo.boneAgeDate);
    if (!Number.isFinite(months) || months < 0) return "";
    const years = Math.floor(months / 12);
    const remaining = months % 12;
    if (years <= 0) return `${remaining}개월`;
    return remaining === 0 ? `${years}세` : `${years}세 ${remaining}개월`;
  }, [patientInfo.birthDate, patientInfo.boneAgeDate]);

  const hormoneSummaryItems = useMemo(() => {
    return hormoneFields
      .map((field) => {
        const raw = hormoneValues[field.key]?.trim();
        if (!raw) return null;
        const unit = field.summaryUnit ? ` ${field.summaryUnit}` : "";
        const label = field.summaryLabel ?? field.label;
        return `${label} ${raw}${unit}`;
      })
      .filter((item): item is string => Boolean(item));
  }, [hormoneFields, hormoneValues]);

  const summaryName = patientInfo.name?.trim() || "아이";
  const heightSummary = latestHeightPercentile !== null
    ? `${latestHeightPercentile.toFixed(1)}퍼센타일`
    : "-";
  const weightSummary = latestWeightPercentile !== null
    ? `${latestWeightPercentile.toFixed(1)}퍼센타일`
    : "-";

  const heightObserved = useMemo(
    () =>
      measurements
        .filter((item) => typeof item.heightCm === "number")
        .map((item) => ({ date: item.date, value: item.heightCm as number })),
    [measurements]
  );

  const weightObserved = useMemo(
    () =>
      measurements
        .filter((item) => typeof item.weightKg === "number")
        .map((item) => ({ date: item.date, value: item.weightKg as number })),
    [measurements]
  );

  const buildPercentiles = (metric: "height" | "weight", extraDates: string[]) => {
    if (!patientInfo.birthDate) return [];
    if (!patientInfo.sex) return [];
    if (!measurements.length) return [];
    const sorted = sortMeasurements(measurements);
    const startDate = sorted[0]?.date;
    const endDate = sorted[sorted.length - 1]?.date;
    if (!startDate || !endDate) return [];
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const totalMonths = Math.max(0, differenceInMonths(end, start));
    const dates: string[] = [];
    for (let i = 0; i <= totalMonths; i += 1) {
      dates.push(format(addMonths(start, i), "yyyy-MM-dd"));
    }
    if (dates[dates.length - 1] !== endDate) {
      dates.push(endDate);
    }
    const dateSet = new Set<string>([...dates, ...extraDates]);
    const finalDates = Array.from(dateSet).sort((a, b) => (a < b ? -1 : 1));
    return finalDates.map((date) => {
      const ageMonths = getAgeMonths(patientInfo.birthDate, date);
      return {
        date,
        p3: valueAtPercentile(metric, patientInfo.sex, ageMonths, 3),
        p10: valueAtPercentile(metric, patientInfo.sex, ageMonths, 10),
        p25: valueAtPercentile(metric, patientInfo.sex, ageMonths, 25),
        p50: valueAtPercentile(metric, patientInfo.sex, ageMonths, 50),
        p75: valueAtPercentile(metric, patientInfo.sex, ageMonths, 75),
        p90: valueAtPercentile(metric, patientInfo.sex, ageMonths, 90),
        p97: valueAtPercentile(metric, patientInfo.sex, ageMonths, 97),
      };
    });
  };

  const heightPercentiles = useMemo(
    () => buildPercentiles("height", heightObserved.map((item) => item.date)),
    [measurements, patientInfo.birthDate, patientInfo.sex, heightObserved]
  );

  const weightPercentiles = useMemo(
    () => buildPercentiles("weight", weightObserved.map((item) => item.date)),
    [measurements, patientInfo.birthDate, patientInfo.sex, weightObserved]
  );

  const chartTreatments = useMemo(
    () =>
      therapyCourses.map((course) => ({
        id: course.id,
        type: course.drug === "GH" ? ("GH" as const) : ("GnRH" as const),
        label: course.drug === "GH" ? "Growth Hormone" : "GnRH agonist",
        startDate: course.startDate,
        endDate: course.endDate ?? null,
        note: course.note ?? course.productName ?? undefined,
      })),
    [therapyCourses]
  );

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 pb-16 pt-10 text-[#1a1c24]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#94a3b8]">
              Pediatric Growth Timeline
            </p>
            <h1 className="text-3xl font-bold">성장 추적 리포트</h1>
            <p className="text-sm text-[#64748b]">
              치료 기간과 성장 기록을 한 화면에서 확인하세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-2 text-xs text-[#475569]">
              측정 {totalSummary.measurements}건 · 치료 {totalSummary.therapies}건
            </div>
            <Link href="/patients">
              <Button variant="outline">환자 리스트</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.open("/print", "_blank", "noopener,noreferrer");
                }
              }}
            >
              A4 요약 인쇄
            </Button>
            <Link href="/igf1">
              <Button variant="outline">IGF-1 분석기</Button>
            </Link>
            <Button variant="outline" onClick={handleReset}>
              초기화
            </Button>
          </div>
        </header>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold">데이터 입력</h2>
              <p className="text-sm text-[#64748b]">
                키·몸무게와 치료 기간을 입력하세요.
              </p>
            </CardHeader>
            <CardContent>
              <div className="mb-6 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#1a1c24]">환자 정보</p>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="patientName">이름</Label>
                    <Input
                      id="patientName"
                      value={patientInfo.name}
                      onChange={(event) =>
                        setPatientInfo((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      placeholder="예: 김지안"
                    />
                  </div>
                  <div className="relative space-y-2">
                    <Label htmlFor="chartNumber">차트번호</Label>
                    <Input
                      id="chartNumber"
                      value={patientInfo.chartNumber}
                      onChange={(event) =>
                        setPatientInfo((prev) => ({
                          ...prev,
                          chartNumber: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        const key = patientInfo.chartNumber.trim();
                        if (!key) {
                          setLoadStatus("차트번호를 입력해주세요.");
                          return;
                        }
                        void handleLoadPatient(key);
                      }}
                      placeholder="예: 12345"
                      autoComplete="off"
                    />
                    {(isSearching || chartSuggestions.length > 0) && (
                      <div className="absolute left-0 right-0 top-[72px] z-20 rounded-2xl border border-white/70 bg-white/90 p-2 text-sm shadow-lg backdrop-blur-xl">
                        {isSearching && (
                          <p className="px-3 py-2 text-xs text-[#94a3b8]">검색 중...</p>
                        )}
                        {!isSearching && chartSuggestions.length === 0 && (
                          <p className="px-3 py-2 text-xs text-[#94a3b8]">
                            검색 결과가 없습니다.
                          </p>
                        )}
                        <ul className="space-y-1">
                          {chartSuggestions.map((item) => (
                            <li key={`${item.chartNumber}-${item.birthDate}`}>
                              <button
                                type="button"
                                className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white"
                                onClick={() => {
                                  setPatientInfo((prev) => ({
                                    ...prev,
                                    chartNumber: item.chartNumber,
                                  }));
                                  void handleLoadPatient(item.chartNumber);
                                  setChartSuggestions([]);
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-[#1a1c24]">
                                    {item.chartNumber}
                                  </span>
                                  <span className="text-xs text-[#94a3b8]">
                                    {item.sex === "male"
                                      ? "남아"
                                      : item.sex === "female"
                                      ? "여아"
                                      : "-"}
                                  </span>
                                </div>
                                <p className="text-xs text-[#64748b]">
                                  {item.name || "미입력"} · {item.birthDate || "-"}
                                </p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {loadStatus && <p className="text-xs text-[#94a3b8]">{loadStatus}</p>}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="rrn">주민등록번호</Label>
                    <Input
                      id="rrn"
                      value={patientInfo.rrn}
                      onChange={(event) => handleRrnChange(event.target.value)}
                      placeholder="13자리 (예: 230101-1234567)"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sex">성별</Label>
                    <Input
                      id="sex"
                      value={
                        patientInfo.sex === "male"
                          ? "남자"
                          : patientInfo.sex === "female"
                          ? "여자"
                          : ""
                      }
                      readOnly
                      placeholder="자동완성"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">나이</Label>
                    <Input id="age" value={ageLabel} readOnly placeholder="자동완성" />
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[#1a1c24]">검사 요약</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/70 bg-white/80 p-3">
                      <p className="text-xs text-[#64748b]">골연령</p>
                      <div className="mt-1 space-y-1 text-xs text-[#475569]">
                        <p>
                          검사일:{" "}
                          <span className="font-semibold text-[#1a1c24]">
                            {patientInfo.boneAgeDate || "미입력"}
                          </span>
                        </p>
                        <p>
                          역연령:{" "}
                          <span className="font-semibold text-[#1a1c24]">
                            {boneAgeChronological || "미입력"}
                          </span>
                        </p>
                        <p>
                          골연령:{" "}
                          <span className="font-semibold text-[#1a1c24]">
                            {patientInfo.boneAge?.trim() ? patientInfo.boneAge : "미입력"}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white/80 p-3">
                      <p className="text-xs text-[#64748b]">혈액검사</p>
                      <p className="mt-1 text-xs text-[#475569]">
                        검사일:{" "}
                        <span className="font-semibold text-[#1a1c24]">
                          {patientInfo.hormoneTestDate || "미입력"}
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#475569]">
                        {hormoneSummaryItems.length > 0 ? (
                          hormoneSummaryItems.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-white/70 bg-white/90 px-2 py-1"
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="text-[#94a3b8]">검사항목 미입력</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#475569]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1a1c24]"
                      checked={showBoneAge}
                      onChange={(event) => {
                        boneAgeToggledRef.current = true;
                        setShowBoneAge(event.target.checked);
                      }}
                    />
                    골연령 입력
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1a1c24]"
                      checked={showHormoneLevels}
                      onChange={(event) => {
                        hormoneToggledRef.current = true;
                        setShowHormoneLevels(event.target.checked);
                      }}
                    />
                    호르몬 수치 입력
                  </label>
                </div>
                {showBoneAge && (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="boneAge">골연령</Label>
                    <Input
                      id="boneAge"
                      value={boneAgeInput}
                      onChange={(event) => setBoneAgeInput(event.target.value)}
                      onBlur={() => commitBoneAge(boneAgeInput)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        commitBoneAge(boneAgeInput);
                      }}
                      placeholder="예: 7세 3개월"
                    />
                    <Label htmlFor="boneAgeDate">검사일</Label>
                    <Input
                      id="boneAgeDate"
                      type="date"
                      value={boneAgeDateInput}
                      onChange={(event) => setBoneAgeDateInput(event.target.value)}
                      onBlur={() => commitBoneAgeDate(boneAgeDateInput)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        commitBoneAgeDate(boneAgeDateInput);
                      }}
                    />
                  </div>
                )}
                {showHormoneLevels && (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm font-semibold text-[#1a1c24]">호르몬 수치</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor="hormoneTestDate">검사일</Label>
                        <Input
                          id="hormoneTestDate"
                          type="date"
                          value={hormoneTestDateInput}
                          onChange={(event) => setHormoneTestDateInput(event.target.value)}
                          onBlur={() => commitHormoneTestDate(hormoneTestDateInput)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            commitHormoneTestDate(hormoneTestDateInput);
                          }}
                        />
                      </div>
                      {hormoneFields.map((field) => {
                        const labKey = LAB_HORMONE_TO_KEY[
                          field.key as keyof HormoneLevels
                        ];
                        const labResult = labKey ? labResults[labKey] : undefined;
                        const unitCaption = labResult?.unit ?? field.unitCaption;
                        return (
                          <div key={field.key} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`hormone-${field.key}`}>{field.label}</Label>
                                {unitCaption && (
                                  <span className="text-[10px] text-[#94a3b8]">
                                    {unitCaption}
                                  </span>
                                )}
                              </div>
                              {labKey && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    labResult ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {labResult ? "추출됨" : "없음"}
                                </span>
                              )}
                            </div>
                          <Input
                            id={`hormone-${field.key}`}
                            value={hormoneInputValues[field.key] ?? ""}
                            onChange={(event) =>
                              setHormoneInputValues((prev) => ({
                                ...prev,
                                [field.key]: event.target.value,
                              }))
                            }
                            onBlur={() =>
                              commitHormoneValue(field.key, hormoneInputValues[field.key] ?? "")
                            }
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              commitHormoneValue(
                                field.key,
                                hormoneInputValues[field.key] ?? ""
                              );
                            }}
                            placeholder="수치 입력"
                          />
                          {field.key === "IGF_1" && igf1Insight && (
                            <p className="text-[11px] text-[#64748b]">
                              Roche Elecsys IGF-1 참고치: {igf1Insight.range} ng/mL ·
                              약 P{igf1Insight.percentile.toFixed(1)}{" "}
                              (기준 {igf1Insight.referenceDate}, 만 {igf1Insight.ageYears.toFixed(1)}세)
                            </p>
                          )}
                        </div>
                      );
                      })}
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm">
                      <p className="text-sm font-semibold text-[#1a1c24]">혈액검사 PDF 업로드</p>
                      <p className="mt-1 text-xs text-[#64748b]">
                        Roche Elecsys IGF-1 검사 기준으로 결과를 자동 매칭합니다.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(event) => setLabFile(event.target.files?.[0] ?? null)}
                        />
                        <Button variant="outline" onClick={handleImportLabPdf}>
                          PDF 추출
                        </Button>
                        {labMethod && (
                          <span className="text-xs text-[#94a3b8]">
                            추출 방식: {labMethod === "pdf-text" ? "텍스트" : "OCR"}
                          </span>
                        )}
                      </div>
                      {labImportStatus && (
                        <p className="mt-2 text-xs text-[#64748b]">{labImportStatus}</p>
                      )}
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="labCollectedAt">검체접수일</Label>
                          <Input
                            id="labCollectedAt"
                            type="date"
                            value={labCollectedAt}
                            onChange={(event) => {
                              setLabCollectedAt(event.target.value);
                              setPatientInfo((prev) => ({
                                ...prev,
                                hormoneTestDate: event.target.value,
                              }));
                            }}
                          />
                        </div>
                        <div className="flex items-end gap-3">
                          <label className="flex items-center gap-2 text-xs text-[#475569]">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[#1a1c24]"
                              checked={saveRawText}
                              onChange={(event) => setSaveRawText(event.target.checked)}
                            />
                            원문 텍스트 저장 허용
                          </label>
                          <Button onClick={handleSaveLabResults}>검사 결과 저장</Button>
                        </div>
                      </div>
                      {labSaveStatus && (
                        <p className="mt-2 text-xs text-[#64748b]">{labSaveStatus}</p>
                      )}
                      {labRawText && labImportStatus.includes("실패") && (
                        <details className="mt-3 text-xs text-[#64748b]">
                          <summary className="cursor-pointer font-semibold">원문 미리보기</summary>
                          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[11px] text-slate-700">
                            {labRawText.slice(0, 2000)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                )}
                {patientInfo.birthDate && (
                  <p className="mt-3 text-xs text-[#94a3b8]">
                    생년월일: {patientInfo.birthDate}
                  </p>
                )}
              </div>

              <Tabs defaultValue="measurements">
                <TabsList className="mb-5">
                  <TabsTrigger value="measurements">Measurements</TabsTrigger>
                  <TabsTrigger value="therapies">Treatment Periods</TabsTrigger>
                </TabsList>

                <TabsContent value="measurements">
                  <MeasurementsPanel
                    measurements={measurements}
                    onAdd={handleAddMeasurement}
                    onUpdate={handleUpdateMeasurement}
                    onDelete={handleDeleteMeasurement}
                    onImport={handleCsvImport}
                  />
                </TabsContent>

                <TabsContent value="therapies">
                  <TherapyPanel
                    courses={therapyCourses}
                    onAdd={handleAddTherapy}
                    onUpdate={handleUpdateTherapy}
                    onDelete={handleDeleteTherapy}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold">퍼센타일 요약</h2>
              <p className="text-sm text-[#64748b]">
                최신 측정값 기준으로 키/몸무게 퍼센타일을 표시합니다.
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-white/60 bg-white/70 p-5 text-sm text-[#1a1c24] shadow-sm">
                <p className="text-base font-semibold">
                  {summaryName}의 키는 {heightSummary}, 몸무게는 {weightSummary}입니다.
                </p>
                <p className="mt-2 text-xs text-[#64748b]">
                  퍼센타일 계산을 위해 생년월일, 성별, 최신 측정값이 필요합니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <GrowthOpinionPanel
            patientInfo={patientInfo}
            measurements={measurements}
            therapyCourses={therapyCourses}
          />

          <GrowthPercentileChart
            title="Height Growth"
            unit="cm"
            mode="screen"
            minY={90}
            data={{
              observed: heightObserved,
              percentiles: heightPercentiles,
            }}
            treatments={chartTreatments}
          />

          {weightObserved.length > 0 && (
            <GrowthPercentileChart
              title="Weight Growth"
              unit="kg"
              mode="screen"
              data={{
                observed: weightObserved,
                percentiles: weightPercentiles,
              }}
              treatments={chartTreatments}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}
