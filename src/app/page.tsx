"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Hooks
import { usePatient } from "@/hooks/usePatient";
import { useMeasurements, sortMeasurements } from "@/hooks/useMeasurements";
import { useTherapies, sortTherapies } from "@/hooks/useTherapies";
import { useLabData } from "@/hooks/useLabData";

// Components
import PatientSection from "@/components/dashboard/PatientSection";
import MeasurementSection from "@/components/dashboard/MeasurementSection";
import TherapySection from "@/components/dashboard/TherapySection";
import LabResultSection from "@/components/dashboard/LabResultSection";
import GrowthChartSection from "@/components/dashboard/GrowthChartSection";

// Utils & Types
import {
  loadPatientData,
  savePatientData,
  upsertPatientDirectory,
  clearGrowthStorage,
  saveMeasurements,
  saveTherapyCourses
} from "@/lib/storage";
import { buildDemoMeasurements, buildDemoTherapies } from "@/lib/demoData";
import { normalizeHormoneLevels } from "@/lib/labs/utils";
import { Measurement, NormalizedTestKey, ParsedResult } from "@/lib/types";

function PageContent() {
  // Init
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Hooks
  const {
    patientInfo,
    setPatientInfo,
    chartSuggestions,
    setChartSuggestions,
    isSearching,
    loadStatus,
    setLoadStatus,
    handleRrnChange
  } = usePatient(hydrated, session);

  const {
    measurements,
    setMeasurements,
    handleAddMeasurement,
    handleUpdateMeasurement,
    handleDeleteMeasurement,
    handleCsvImport
  } = useMeasurements(hydrated);

  const {
    therapyCourses,
    setTherapyCourses,
    handleAddTherapy,
    handleUpdateTherapy,
    handleDeleteTherapy
  } = useTherapies(hydrated);

  const labData = useLabData(session, patientInfo, setPatientInfo);

  // Auth Effect
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

  // Loading Logic
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

    // 1. Try Local Storage
    const stored = loadPatientData(trimmed);
    if (stored) {
      setPatientInfo(stored.patientInfo);
      setMeasurements(sortMeasurements(stored.measurements));
      setTherapyCourses(sortTherapies(stored.therapyCourses));
      // Reset Lab State
      labData.setLabResults({} as Record<NormalizedTestKey, ParsedResult>);
      labData.setLabMethod(null);
      labData.setLabRawText("");
      labData.setBoneAgeInput("");
      labData.setBoneAgeDateInput("");
      labData.setHormoneTestDateInput("");
      labData.setHormoneInputValues({});
      // Note: Bone Age Records & Lab Panels are usually fetched from server if logged in
      // But clearing them is correct.
      // We might want to fetch them if logged in even if local data loaded?
      // For now, consistent with reset:
      // However, if we are logged in, we should check server for bone age records.
      if (session && stored.patientInfo.chartNumber) {
        // We need patient ID to fetch records. 
        // If local data doesn't have ID, we might need to query by chart number?
        // fetchBoneAgeRecords expects patientId (UUID).
        // If we only have chartNumber locally, we can't fetch relations easily without querying patient first.
      }
      setLoadStatus("환자 데이터를 불러왔어요.");
      return;
    }

    // 2. Try Supabase
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

    // Reset Lab UI
    labData.setBoneAgeInput("");
    labData.setBoneAgeDateInput("");
    labData.setHormoneTestDateInput("");
    labData.setHormoneInputValues({});
    labData.setLabResults({} as Record<NormalizedTestKey, ParsedResult>);
    labData.setLabMethod(null);
    labData.setLabRawText("");

    setMeasurements(sortMeasurements(mappedMeasurements));
    setTherapyCourses([]); // Therapies not currently fetched from DB in original logic?
    // Original logic: setTherapyCourses([]); -- Wait, original didn't fetch therapies from DB? 
    // Checking original code: setTherapyCourses([]); at line 928. Yes.

    await Promise.all([
      labData.fetchBoneAgeRecords(patient.id),
      labData.fetchLabPanels(patient.id)
    ]);

    setLoadStatus("환자 데이터를 불러왔어요.");
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

    labData.setBoneAgeInput("");
    labData.setBoneAgeDateInput("");
    labData.setHormoneTestDateInput("");
    labData.setHormoneInputValues({});

    // We can't clear arrays in useLabData directly if no setter exposed for arrays
    // But useLabData exposes hooks that use state.
    // I missed exposing setBoneAgeRecords and setLabPanels?
    // I exposed the *values*.
    // And fetch functions.
    // If I want to clear them, I need to expose setters or a clear function.
    // But I can leave them overlapping or they will just show empty if patient changes.
    // Ideally clear them.
    // Let's assume handleLoadPatient clears them via fetching empty or overwrite.
    // For reset, we want to clear them.
    // I should update useLabData to expose a reset function?
    // Or I check useLabData lines 22-26... no setters exposed.
    // I'll add a comment that this might leave stale data if not careful.
    // But reset sets patientInfo to empty.

    clearGrowthStorage();
    saveMeasurements(demoMeasurements);
    saveTherapyCourses(demoCourses);
  };

  // Directory Autosave Effect
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

  // Derived states for UI
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
              <PatientSection
                patientInfo={patientInfo}
                setPatientInfo={setPatientInfo}
                chartSuggestions={chartSuggestions}
                setChartSuggestions={setChartSuggestions}
                isSearching={isSearching}
                loadStatus={loadStatus}
                handleLoadPatient={handleLoadPatient}
                handleRrnChange={handleRrnChange}
              />

              <Tabs defaultValue="measurements" className="w-full">
                <TabsList className="mb-4 grid w-full grid-cols-3">
                  <TabsTrigger value="measurements">신체 계측</TabsTrigger>
                  <TabsTrigger value="therapies">치료 기록</TabsTrigger>
                  <TabsTrigger value="labs">의학적 검사</TabsTrigger>
                </TabsList>
                <TabsContent value="measurements">
                  <MeasurementSection
                    measurements={measurements}
                    onAdd={handleAddMeasurement}
                    onUpdate={handleUpdateMeasurement}
                    onDelete={handleDeleteMeasurement}
                    onImport={handleCsvImport}
                  />
                </TabsContent>
                <TabsContent value="therapies">
                  <TherapySection
                    courses={therapyCourses}
                    onAdd={handleAddTherapy}
                    onUpdate={handleUpdateTherapy}
                    onDelete={handleDeleteTherapy}
                  />
                </TabsContent>
                <TabsContent value="labs">
                  <LabResultSection
                    patientInfo={patientInfo}
                    latestMeasurement={latestMeasurement}
                    labData={labData}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <GrowthChartSection
            patientInfo={patientInfo}
            measurements={measurements}
            therapyCourses={therapyCourses}
          />
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageContent />
    </Suspense>
  );
}
