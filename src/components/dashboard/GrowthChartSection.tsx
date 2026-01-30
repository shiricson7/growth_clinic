"use client";

import { useMemo } from "react";
import { format, addMonths, differenceInMonths, parseISO } from "date-fns";
import {
    Measurement,
    TherapyCourse,
    PatientInfo
} from "@/lib/types";
import { getAgeMonths, valueAtPercentile } from "@/lib/percentileLogic";
import GrowthPercentileChart, {
    GrowthObservedPoint,
    GrowthTreatment
} from "./GrowthPercentileChart";

// Helper function locally, or imported if exported
const sortMeasurements = (items: Measurement[]) =>
    [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

interface GrowthChartSectionProps {
    patientInfo: PatientInfo;
    measurements: Measurement[];
    therapyCourses: TherapyCourse[];
}

export default function GrowthChartSection({
    patientInfo,
    measurements,
    therapyCourses
}: GrowthChartSectionProps) {

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
        <div className="grid gap-6 lg:grid-cols-2">
            <GrowthPercentileChart
                title="Height"
                unit="cm"
                theme="auto"
                data={{
                    observed: heightObserved,
                    percentiles: heightPercentiles,
                }}
                treatments={chartTreatments}
            />
            <GrowthPercentileChart
                title="Weight"
                unit="kg"
                theme="auto"
                data={{
                    observed: weightObserved,
                    percentiles: weightPercentiles,
                }}
                treatments={chartTreatments}
            />
        </div>
    );
}
