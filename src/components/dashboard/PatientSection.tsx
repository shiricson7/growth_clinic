"use client";

import { useMemo } from "react";
import { differenceInMonths, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PatientInfo, ChartSuggestion } from "@/lib/types";

interface PatientSectionProps {
    patientInfo: PatientInfo;
    setPatientInfo: React.Dispatch<React.SetStateAction<PatientInfo>>;
    chartSuggestions: ChartSuggestion[];
    isSearching: boolean;
    loadStatus: string;
    handleLoadPatient: (key: string) => void;
    handleRrnChange: (value: string) => void;
    setChartSuggestions: React.Dispatch<React.SetStateAction<ChartSuggestion[]>>; // Added this to clear suggestions
}

export default function PatientSection({
    patientInfo,
    setPatientInfo,
    chartSuggestions,
    isSearching,
    loadStatus,
    handleLoadPatient,
    handleRrnChange,
    setChartSuggestions
}: PatientSectionProps) {

    const ageLabel = useMemo(() => {
        if (!patientInfo.birthDate) return "";
        const months = differenceInMonths(new Date(), parseISO(patientInfo.birthDate));
        if (!Number.isFinite(months) || months < 0) return "";
        const years = Math.floor(months / 12);
        const remaining = months % 12;
        if (years <= 0) return `${remaining}개월`;
        return remaining === 0 ? `${years}세` : `${years}세 ${remaining}개월`;
    }, [patientInfo.birthDate]);

    return (
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

                            // We should probably trigger load here.
                            // Parent's handleLoadPatient expects a key.
                            if (key) {
                                handleLoadPatient(key);
                            }
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
                                                handleLoadPatient(item.chartNumber);
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
        </div>
    );
}
