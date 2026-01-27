"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Measurement, TherapyCourse, PatientInfo } from "@/lib/types";
import {
  loadMeasurements,
  loadTherapyCourses,
  saveMeasurements,
  saveTherapyCourses,
  clearGrowthStorage,
  loadPatientInfo,
  savePatientInfo,
  upsertPatientDirectory,
  loadPatientData,
  savePatientData,
} from "@/lib/storage";
import { buildDemoMeasurements, buildDemoTherapies } from "@/lib/demoData";
import { deriveRrnInfo, normalizeRrn } from "@/lib/rrn";
import { differenceInMonths, parseISO } from "date-fns";
import GrowthChart from "@/components/GrowthChart";
import MeasurementsPanel from "@/components/MeasurementsPanel";
import TherapyPanel from "@/components/TherapyPanel";
import GrowthOpinionPanel from "@/components/GrowthOpinionPanel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAgeMonths, percentileFromValue } from "@/lib/percentileLogic";

const sortMeasurements = (items: Measurement[]) =>
  [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

const sortTherapies = (items: TherapyCourse[]) =>
  [...items].sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0
  );

function PageContent() {
  const searchParams = useSearchParams();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [therapyCourses, setTherapyCourses] = useState<TherapyCourse[]>([]);
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: "",
    chartNumber: "",
    rrn: "",
    sex: "",
    birthDate: "",
    boneAge: "",
    hormoneLevels: {},
  });
  const [hydrated, setHydrated] = useState(false);
  const [showBoneAge, setShowBoneAge] = useState(false);
  const [showHormoneLevels, setShowHormoneLevels] = useState(false);
  const [loadStatus, setLoadStatus] = useState("");

  const hormoneFields = useMemo(
    () => [
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
    ],
    []
  );

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
    const target = searchParams.get("patient");
    if (!target) return;
    const stored = loadPatientData(target);
    if (stored) {
      setPatientInfo(stored.patientInfo);
      setMeasurements(sortMeasurements(stored.measurements));
      setTherapyCourses(sortTherapies(stored.therapyCourses));
      setLoadStatus("환자 데이터를 불러왔어요.");
    } else {
      setLoadStatus("해당 차트번호의 저장된 데이터가 없습니다.");
    }
  }, [hydrated, searchParams]);

  useEffect(() => {
    if (!hydrated) return;
    if (patientInfo.boneAge && !showBoneAge) {
      setShowBoneAge(true);
    }
    const hormoneValues =
      typeof patientInfo.hormoneLevels === "string"
        ? patientInfo.hormoneLevels.trim()
        : Object.values(patientInfo.hormoneLevels ?? {}).some(
            (value) => value && value.trim() !== ""
          );
    if (hormoneValues && !showHormoneLevels) {
      setShowHormoneLevels(true);
    }
  }, [hydrated, patientInfo.boneAge, patientInfo.hormoneLevels, showBoneAge, showHormoneLevels]);

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
      hormoneLevels: {},
    });
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

  const handleLoadPatient = (key: string) => {
    const stored = loadPatientData(key);
    if (!stored) {
      setLoadStatus("해당 차트번호의 저장된 데이터가 없습니다.");
      return;
    }
    setPatientInfo(stored.patientInfo);
    setMeasurements(sortMeasurements(stored.measurements));
    setTherapyCourses(sortTherapies(stored.therapyCourses));
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

  const summaryName = patientInfo.name?.trim() || "아이";
  const heightSummary = latestHeightPercentile !== null
    ? `${latestHeightPercentile.toFixed(1)}퍼센타일`
    : "-";
  const weightSummary = latestWeightPercentile !== null
    ? `${latestWeightPercentile.toFixed(1)}퍼센타일`
    : "-";

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
            <Button variant="outline" onClick={handleReset}>
              Reset demo data
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
                  <div className="space-y-2">
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
                        handleLoadPatient(key);
                      }}
                      placeholder="예: 12345"
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#94a3b8]">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const key = patientInfo.chartNumber.trim();
                          if (!key) {
                            setLoadStatus("차트번호를 입력해주세요.");
                            return;
                          }
                          handleLoadPatient(key);
                        }}
                      >
                        차트번호로 불러오기
                      </Button>
                    </div>
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
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#475569]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1a1c24]"
                      checked={showBoneAge}
                      onChange={(event) => setShowBoneAge(event.target.checked)}
                    />
                    골연령 입력
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1a1c24]"
                      checked={showHormoneLevels}
                      onChange={(event) => setShowHormoneLevels(event.target.checked)}
                    />
                    호르몬 수치 입력
                  </label>
                </div>
                {showBoneAge && (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="boneAge">골연령</Label>
                    <Input
                      id="boneAge"
                      value={patientInfo.boneAge ?? ""}
                      onChange={(event) =>
                        setPatientInfo((prev) => ({
                          ...prev,
                          boneAge: event.target.value,
                        }))
                      }
                      placeholder="예: 7세 3개월"
                    />
                  </div>
                )}
                {showHormoneLevels && (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm font-semibold text-[#1a1c24]">호르몬 수치</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {hormoneFields.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <Label htmlFor={`hormone-${field.key}`}>{field.label}</Label>
                          <Input
                            id={`hormone-${field.key}`}
                            value={hormoneValues[field.key as keyof typeof hormoneValues] ?? ""}
                            onChange={(event) =>
                              setPatientInfo((prev) => ({
                                ...prev,
                                hormoneLevels: {
                                  ...((typeof prev.hormoneLevels === "object" && prev.hormoneLevels)
                                    ? prev.hormoneLevels
                                    : {}),
                                  [field.key]: event.target.value,
                                },
                              }))
                            }
                            placeholder="수치 입력"
                          />
                        </div>
                      ))}
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

          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold">성장/치료 차트</h2>

              <p className="text-sm text-[#64748b]">
                치료 기간은 배경 밴드로 표시됩니다.
              </p>
            </CardHeader>
            <CardContent>
              <GrowthChart
                measurements={measurements}
                therapyCourses={therapyCourses}
                birthDate={patientInfo.birthDate}
                sex={patientInfo.sex}
              />
            </CardContent>
          </Card>
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
