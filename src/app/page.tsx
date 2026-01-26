"use client";

import { useEffect, useMemo, useState } from "react";
import type { Measurement, TherapyCourse } from "@/lib/types";
import {
  loadMeasurements,
  loadTherapyCourses,
  saveMeasurements,
  saveTherapyCourses,
  clearGrowthStorage,
} from "@/lib/storage";
import { buildDemoMeasurements, buildDemoTherapies } from "@/lib/demoData";
import GrowthChart from "@/components/GrowthChart";
import MeasurementsPanel from "@/components/MeasurementsPanel";
import TherapyPanel from "@/components/TherapyPanel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const sortMeasurements = (items: Measurement[]) =>
  [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

const sortTherapies = (items: TherapyCourse[]) =>
  [...items].sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0
  );

export default function Page() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [therapyCourses, setTherapyCourses] = useState<TherapyCourse[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedMeasurements = loadMeasurements();
    const storedCourses = loadTherapyCourses();
    setMeasurements(sortMeasurements(storedMeasurements));
    setTherapyCourses(sortTherapies(storedCourses));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveMeasurements(measurements);
  }, [measurements, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveTherapyCourses(therapyCourses);
  }, [therapyCourses, hydrated]);

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
    clearGrowthStorage();
    saveMeasurements(demoMeasurements);
    saveTherapyCourses(demoCourses);
  };

  const totalSummary = useMemo(
    () => ({
      measurements: measurements.length,
      therapies: therapyCourses.length,
    }),
    [measurements.length, therapyCourses.length]
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
            <Button variant="outline" onClick={handleReset}>
              Reset demo data
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold">성장/치료 차트</h2>
              <p className="text-sm text-[#64748b]">
                치료 기간은 배경 밴드로 표시됩니다.
              </p>
            </CardHeader>
            <CardContent>
              <GrowthChart measurements={measurements} therapyCourses={therapyCourses} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold">데이터 입력</h2>
              <p className="text-sm text-[#64748b]">
                키·몸무게와 치료 기간을 입력하세요.
              </p>
            </CardHeader>
            <CardContent>
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
        </div>
      </div>
    </main>
  );
}
