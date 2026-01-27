"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HormoneLevels } from "@/lib/types";

export type ChildInfo = {
  chartNumber: string;
  name: string;
  rrn: string;
  birthDate: string;
  sex: "male" | "female" | "";
  measurementDate: string;
  heightCm: string;
  weightKg: string;
  boneAge: string;
  hormoneLevels: HormoneLevels;
};

interface ChildInfoFormProps {
  data: ChildInfo;
  rrnError?: string | null;
  maskedRrn?: string | null;
  isPristine?: boolean;
  chartSuggestions?: Array<{
    chartNumber: string;
    name: string;
    birthDate: string;
    sex: "male" | "female";
  }>;
  isSearching?: boolean;
  onChartSelect?: (chartNumber: string) => void;
  onFieldChange: (field: keyof ChildInfo, value: string) => void;
  onRrnChange: (value: string) => void;
  onHormoneChange?: (key: keyof HormoneLevels, value: string) => void;
  csvStatus?: string;
  csvInputRef?: RefObject<HTMLInputElement | null>;
  onCsvFileChange?: (file: File | null) => void;
  onCsvUpload?: () => void;
  showMeasurementDate?: boolean;
  onShowMeasurementDate?: () => void;
}

export default function ChildInfoForm({
  data,
  rrnError,
  maskedRrn,
  isPristine = false,
  chartSuggestions = [],
  isSearching = false,
  onChartSelect,
  onFieldChange,
  onRrnChange,
  csvStatus,
  csvInputRef,
  onCsvFileChange,
  onCsvUpload,
  showMeasurementDate = true,
  onShowMeasurementDate,
}: ChildInfoFormProps) {
  const inputTone = isPristine ? "text-[#94a3b8]" : "";
  const [showBoneAge, setShowBoneAge] = useState(false);
  const [showHormoneLevels, setShowHormoneLevels] = useState(false);

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
    if (data.boneAge && !showBoneAge) {
      setShowBoneAge(true);
    }
    const hasHormone = Object.values(data.hormoneLevels ?? {}).some(
      (value) => value && value.trim() !== ""
    );
    if (hasHormone && !showHormoneLevels) {
      setShowHormoneLevels(true);
    }
  }, [data.boneAge, data.hormoneLevels, showBoneAge, showHormoneLevels]);

  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="text-lg font-bold text-[#1a1c24]">아이 기본 정보</h2>
        <p className="text-sm text-[#6b7280]">
          주민등록번호는 자동 입력에만 사용되며 저장하지 않습니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative space-y-2">
            <Label htmlFor="chartNumber">차트번호</Label>
            <Input
              id="chartNumber"
              value={data.chartNumber}
              onChange={(e) => onFieldChange("chartNumber", e.target.value)}
              placeholder="예: 12345"
              autoComplete="off"
              className={inputTone}
            />
            {(isSearching || chartSuggestions.length > 0) && (
              <div className="absolute left-0 right-0 top-[72px] z-20 rounded-2xl border border-white/70 bg-white/90 p-2 text-sm shadow-lg backdrop-blur-xl">
                {isSearching && (
                  <p className="px-3 py-2 text-xs text-[#94a3b8]">검색 중...</p>
                )}
                {!isSearching && chartSuggestions.length === 0 && (
                  <p className="px-3 py-2 text-xs text-[#94a3b8]">검색 결과가 없습니다.</p>
                )}
                <ul className="space-y-1">
                  {chartSuggestions.map((item) => (
                    <li key={item.chartNumber}>
                      <button
                        type="button"
                        className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white"
                        onClick={() => onChartSelect?.(item.chartNumber)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#1a1c24]">{item.chartNumber}</span>
                          <span className="text-xs text-[#94a3b8]">
                            {item.sex === "male" ? "남아" : "여아"}
                          </span>
                        </div>
                        <p className="text-xs text-[#64748b]">
                          {item.name} · {item.birthDate}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={data.name}
              onChange={(e) => onFieldChange("name", e.target.value)}
              placeholder="예: 서윤"
              className={inputTone}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rrn">주민등록번호</Label>
          <Input
            id="rrn"
            value={data.rrn}
            onChange={(e) => onRrnChange(e.target.value)}
            placeholder="13자리 (예: 230101-1234567)"
            inputMode="numeric"
            className={inputTone}
          />
          {maskedRrn && !rrnError && (
            <p className="text-xs text-[#64748b]">확인됨: {maskedRrn}</p>
          )}
          {rrnError && (
            <p className="text-xs text-rose-500">{rrnError}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-[#64748b]">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>RRN은 브라우저에만 보관되고 외부로 저장되지 않습니다.</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="birthDate">생년월일</Label>
            <div className="relative">
              <Input
                id="birthDate"
                value={data.birthDate}
                readOnly
                placeholder="YYYY-MM-DD"
                className={["pr-10", inputTone].filter(Boolean).join(" ")}
              />
              <Lock className="absolute right-3 top-3.5 h-4 w-4 text-[#94a3b8]" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sex">성별</Label>
            <div className="relative">
              <Input
                id="sex"
                value={data.sex === "male" ? "남아" : data.sex === "female" ? "여아" : ""}
                readOnly
                placeholder="자동 입력"
                className={["pr-10", inputTone].filter(Boolean).join(" ")}
              />
              <Lock className="absolute right-3 top-3.5 h-4 w-4 text-[#94a3b8]" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[#64748b]">
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
            ê³¨ì°ë ¹ ìë ¥
            í¸ë¥´ëª¬ ìì¹ ìë ¥
        </div>
        {showBoneAge && (
          <div className="space-y-2">
            <Label htmlFor="boneAge">ê³¨ì°ë ¹</Label>
            <Input
              id="boneAge"
              value={data.boneAge}
              onChange={(e) => onFieldChange("boneAge", e.target.value)}
              placeholder="ì: 7ì¸ 3ê°ì"
              className={inputTone}
            />
          </div>
        )}
        {showHormoneLevels && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#1a1c24]">í¸ë¥´ëª¬ ìì¹</p>
            <div className="grid gap-3 md:grid-cols-2">
              {hormoneFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`hormone-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`hormone-${field.key}`}
                    value={data.hormoneLevels?.[field.key as keyof HormoneLevels] ?? ""}
                    onChange={(e) => onHormoneChange?.(field.key as keyof HormoneLevels, e.target.value)}
                    placeholder="ìì¹ ìë ¥"
                    className={inputTone}
                  />
                </div>
              ))}
            </div>
          </div>
        )}


        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-3 md:col-span-1">
            {showMeasurementDate && (
              <div className="space-y-2">
                <Label htmlFor="measurementDate">최근 측정일</Label>
                <Input
                  id="measurementDate"
                  type="date"
                  value={data.measurementDate}
                  onChange={(e) => onFieldChange("measurementDate", e.target.value)}
                  className={inputTone}
                />
              </div>
            )}
            {onCsvUpload && onCsvFileChange && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="csvUpload">이전 기록 CSV</Label>
                  {!showMeasurementDate && onShowMeasurementDate && (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-[#64748b] hover:text-[#1a1c24]"
                      onClick={onShowMeasurementDate}
                    >
                      최근 측정일 다시 보기
                    </button>
                  )}
                </div>
                <Input
                  id="csvUpload"
                  type="file"
                  accept=".csv,text/csv"
                  ref={csvInputRef}
                  onChange={(e) => onCsvFileChange(e.target.files?.[0] ?? null)}
                />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={onCsvUpload}>
                    CSV 업로드
                  </Button>
                  <span className="text-[11px] text-[#94a3b8]">최근 측정일 이전</span>
                </div>
                {csvStatus && <p className="text-xs text-[#64748b]">{csvStatus}</p>}
                <p className="text-[11px] text-[#94a3b8]">
                  date, height_cm, weight_kg 컬럼만 처리합니다.
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="height">키 (cm)</Label>
            <Input
              id="height"
              type="number"
              inputMode="decimal"
              value={data.heightCm}
              onChange={(e) => onFieldChange("heightCm", e.target.value)}
              placeholder="예: 88.3"
              className={inputTone}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">몸무게 (kg)</Label>
            <Input
              id="weight"
              type="number"
              inputMode="decimal"
              value={data.weightKg}
              onChange={(e) => onFieldChange("weightKg", e.target.value)}
              placeholder="예: 12.4"
              className={inputTone}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
