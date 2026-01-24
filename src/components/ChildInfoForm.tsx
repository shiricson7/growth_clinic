"use client";

import { Lock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ChildInfo = {
  chartNumber: string;
  name: string;
  rrn: string;
  birthDate: string;
  sex: "male" | "female" | "";
  measurementDate: string;
  heightCm: string;
  weightKg: string;
};

interface ChildInfoFormProps {
  data: ChildInfo;
  rrnError?: string | null;
  maskedRrn?: string | null;
  onFieldChange: (field: keyof ChildInfo, value: string) => void;
  onRrnChange: (value: string) => void;
}

export default function ChildInfoForm({
  data,
  rrnError,
  maskedRrn,
  onFieldChange,
  onRrnChange,
}: ChildInfoFormProps) {
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
          <div className="space-y-2">
            <Label htmlFor="chartNumber">차트번호</Label>
            <Input
              id="chartNumber"
              value={data.chartNumber}
              onChange={(e) => onFieldChange("chartNumber", e.target.value)}
              placeholder="예: A-2026-001"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={data.name}
              onChange={(e) => onFieldChange("name", e.target.value)}
              placeholder="예: 서윤"
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
                className="pr-10"
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
                className="pr-10"
              />
              <Lock className="absolute right-3 top-3.5 h-4 w-4 text-[#94a3b8]" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="measurementDate">최근 측정일</Label>
            <Input
              id="measurementDate"
              type="date"
              value={data.measurementDate}
              onChange={(e) => onFieldChange("measurementDate", e.target.value)}
            />
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
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
