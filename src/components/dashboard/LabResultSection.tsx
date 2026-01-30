"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ParsedResult,
    NormalizedTestKey,
    PatientInfo,
    HormoneLevels,
    Measurement
} from "@/lib/types";
import {
    LAB_KEY_TO_HORMONE,
    LAB_HORMONE_TO_KEY,
    LAB_SUMMARY_META,
    LAB_SUMMARY_ORDER
} from "@/lib/labs/constants";
import { getAgeMonths } from "@/lib/percentileLogic";
import { getAgeYears, estimateIgf1Percentile, formatIgf1Range, getIgf1Reference } from "@/lib/igf1Roche";

interface LabResultSectionProps {
    patientInfo: PatientInfo;
    latestMeasurement: Measurement | null; // For IGF-1 calculation
    labData: any; // ReturnType<typeof useLabData> - explicit type would be better but requires exporting return type
}

export default function LabResultSection({
    patientInfo,
    latestMeasurement,
    labData,
}: LabResultSectionProps) {
    const {
        labPanels,
        boneAgeRecords,
        labFile, setLabFile,
        labResults,
        labMethod,
        labImportStatus,
        labSaveStatus,
        boneAgeInput, setBoneAgeInput,
        boneAgeDateInput, setBoneAgeDateInput,
        boneAgeSaveStatus,
        hormoneTestDateInput, setHormoneTestDateInput,
        hormoneInputValues, setHormoneInputValues,
        handleSaveBoneAge,
        handleSaveLabResults,
        handleImportLabPdf,
        hormoneFields
    } = labData;

    const [showBoneAge, setShowBoneAge] = useState(false);
    const [showHormoneLevels, setShowHormoneLevels] = useState(false);
    const boneAgeToggledRef = useRef(false);
    const hormoneToggledRef = useRef(false);

    const hasBoneAgeValue = Boolean(patientInfo.boneAge?.trim() || patientInfo.boneAgeDate);
    const hasHormoneValue =
        typeof patientInfo.hormoneLevels === "string"
            ? patientInfo.hormoneLevels.trim()
            : Object.values(patientInfo.hormoneLevels ?? {}).some(
                (value) => value && value.trim() !== ""
            );

    useEffect(() => {
        if (!boneAgeToggledRef.current && hasBoneAgeValue && !showBoneAge) {
            setShowBoneAge(true);
        }
        if (!hormoneToggledRef.current && (hasHormoneValue || patientInfo.hormoneTestDate) && !showHormoneLevels) {
            setShowHormoneLevels(true);
        }
    }, [hasBoneAgeValue, hasHormoneValue, patientInfo.hormoneTestDate, showBoneAge, showHormoneLevels]);

    // Auto-show when PDF import succeeds (if parent updates labData.labResults, this effect might not trigger unless we spy on it)
    // Actually page.tsx did: setLabResults(...) then setShowHormoneLevels(true).
    // The handleImportLabPdf in hook doesn't touch the local state of THIS component.
    // So we might need to expose setShowHormoneLevels or handle it via checking labResults.
    useEffect(() => {
        if (Object.keys(labResults).length > 0 && !showHormoneLevels) {
            setShowHormoneLevels(true);
            hormoneToggledRef.current = true; // User action implied
        }
    }, [labResults]);

    const hormoneValues: Record<string, string> =
        typeof patientInfo.hormoneLevels === "string"
            ? {}
            : (patientInfo.hormoneLevels ?? {});

    const mergedHormoneValues = useMemo(() => {
        return {
            ...hormoneValues,
            ...Object.entries(hormoneInputValues).reduce((acc, [key, value]) => {
                if (typeof value === 'string' && value.trim()) {
                    acc[key] = value;
                }
                return acc;
            }, {} as Record<string, string>),
        };
    }, [hormoneInputValues, hormoneValues]);

    const igf1Insight = useMemo(() => {
        const raw = mergedHormoneValues.IGF_1?.trim();
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
        mergedHormoneValues.IGF_1,
        latestMeasurement?.date,
        patientInfo.birthDate,
        patientInfo.hormoneTestDate,
        patientInfo.sex,
    ]);

    const formatAgeFromMonths = (monthsValue: number) => {
        if (!Number.isFinite(monthsValue) || monthsValue < 0) return "";
        const totalMonths = Math.floor(monthsValue);
        const years = Math.floor(totalMonths / 12);
        const remaining = totalMonths % 12;
        if (years <= 0) return `${remaining}개월`;
        return remaining === 0 ? `${years}세` : `${years}세 ${remaining}개월`;
    };

    const hormoneSummaryItems = useMemo(() => {
        // Need to cast keys safely
        return hormoneFields
            .map((field: any) => {
                const raw = hormoneValues[field.key]?.trim();
                if (!raw) return null;
                const unit = field.summaryUnit ? ` ${field.summaryUnit}` : "";
                const label = field.summaryLabel ?? field.label;
                return `${label} ${raw}${unit}`;
            })
            .filter((item: any): item is string => Boolean(item));
    }, [hormoneFields, hormoneValues]);

    const boneAgeSummaryRows = useMemo(() => {
        if (boneAgeRecords.length > 0) return boneAgeRecords;
        if (patientInfo.boneAgeDate || patientInfo.boneAge) {
            return [
                {
                    id: "current",
                    measuredAt: patientInfo.boneAgeDate || "",
                    boneAge: patientInfo.boneAge || "",
                },
            ];
        }
        return [];
    }, [boneAgeRecords, patientInfo.boneAge, patientInfo.boneAgeDate]);

    const parseLabNumeric = (raw: string) => {
        const numeric = Number(raw.replace(/[<>≤≥＜＞]/g, "").trim());
        return Number.isFinite(numeric) ? numeric : null;
    };

    const labPanelSummaryRows = useMemo(() => {
        if (labPanels.length > 0) return labPanels;
        if (patientInfo.hormoneTestDate && hormoneSummaryItems.length > 0) {
            const results = {} as Record<NormalizedTestKey, ParsedResult>;
            Object.entries(hormoneValues).forEach(([key, value]) => {
                const trimmed = value?.trim();
                if (!trimmed) return;
                const labKey = LAB_HORMONE_TO_KEY[key as keyof HormoneLevels];
                if (!labKey) return;
                results[labKey] = {
                    testKey: labKey,
                    valueRaw: trimmed,
                    valueNumeric: parseLabNumeric(trimmed),
                    unit: LAB_SUMMARY_META[labKey]?.unit ?? null,
                    sourceLine: "",
                    matchedBy: "legacy",
                };
            });
            return [
                {
                    id: "current",
                    collectedAt: patientInfo.hormoneTestDate,
                    results,
                },
            ];
        }
        return [];
    }, [hormoneSummaryItems.length, hormoneValues, labPanels, patientInfo.hormoneTestDate]);

    const formatLabItems = (results: Record<NormalizedTestKey, ParsedResult>) => {
        return LAB_SUMMARY_ORDER.map((key) => {
            const result = results[key];
            if (!result?.valueRaw) return null;
            const meta = LAB_SUMMARY_META[key];
            const unit = meta?.unit ? ` ${meta.unit}` : "";
            return `${meta.label} ${result.valueRaw}${unit}`;
        }).filter((item): item is string => Boolean(item));
    };

    return (
        <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#1a1c24]">검사 요약</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/70 bg-white/80 p-3">
                    <p className="text-xs text-[#64748b]">골연령</p>
                    {boneAgeSummaryRows.length > 0 ? (
                        <div className="mt-2 space-y-2 text-xs text-[#475569]">
                            {boneAgeSummaryRows.map((record: any) => {
                                const chronological = record.measuredAt && patientInfo.birthDate
                                    ? formatAgeFromMonths(
                                        getAgeMonths(patientInfo.birthDate, record.measuredAt)
                                    )
                                    : "";
                                return (
                                    <div
                                        key={record.id}
                                        className="rounded-lg border border-white/70 bg-white/90 px-3 py-2"
                                    >
                                        <div className="flex flex-wrap gap-3">
                                            <span>
                                                검사일:{" "}
                                                <strong className="font-semibold text-[#1a1c24]">
                                                    {record.measuredAt || "미입력"}
                                                </strong>
                                            </span>
                                            <span>
                                                역연령:{" "}
                                                <strong className="font-semibold text-[#1a1c24]">
                                                    {chronological || "미입력"}
                                                </strong>
                                            </span>
                                            <span>
                                                골연령:{" "}
                                                <strong className="font-semibold text-[#1a1c24]">
                                                    {record.boneAge?.trim() ? record.boneAge : "미입력"}
                                                </strong>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="mt-2 text-xs text-[#94a3b8]">골연령 기록이 없습니다.</p>
                    )}
                </div>
                <div className="rounded-xl border border-white/70 bg-white/80 p-3">
                    <p className="text-xs text-[#64748b]">혈액검사</p>
                    {labPanelSummaryRows.length > 0 ? (
                        <div className="mt-2 space-y-2 text-xs text-[#475569]">
                            {labPanelSummaryRows.map((panel: any) => {
                                const items = formatLabItems(panel.results);
                                return (
                                    <div
                                        key={panel.id}
                                        className="rounded-lg border border-white/70 bg-white/90 px-3 py-2"
                                    >
                                        <p>
                                            검사일:{" "}
                                            <strong className="font-semibold text-[#1a1c24]">
                                                {panel.collectedAt || "미입력"}
                                            </strong>
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {items.length > 0 ? (
                                                items.map((item) => (
                                                    <span
                                                        key={`${panel.id}-${item}`}
                                                        className="rounded-full border border-white/70 bg-white/90 px-2 py-1"
                                                    >
                                                        {item}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[#94a3b8]">
                                                    검사항목 미입력
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="mt-2 text-xs text-[#94a3b8]">혈액검사 기록이 없습니다.</p>
                    )}
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
                        placeholder="예: 7세 3개월"
                    />
                    <Label htmlFor="boneAgeDate">검사일</Label>
                    <Input
                        id="boneAgeDate"
                        type="date"
                        value={boneAgeDateInput}
                        onChange={(event) => setBoneAgeDateInput(event.target.value)}
                    />
                    <div className="flex items-center gap-3">
                        <Button size="sm" onClick={handleSaveBoneAge}>
                            골연령 저장
                        </Button>
                        {boneAgeSaveStatus && (
                            <span className="text-xs text-[#64748b]">{boneAgeSaveStatus}</span>
                        )}
                    </div>
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
                            />
                        </div>
                        {hormoneFields.map((field: any) => {
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
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${labResult ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
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
                                            setHormoneInputValues((prev: any) => ({
                                                ...prev,
                                                [field.key]: event.target.value,
                                            }))
                                        }
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
                    </div>

                    <div className="flex items-center gap-3">
                        <Button onClick={handleSaveLabResults}>
                            수치 저장
                        </Button>
                        {labSaveStatus && (
                            <span className="text-xs text-[#64748b]">{labSaveStatus}</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
