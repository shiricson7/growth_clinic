"use client";

import { useMemo, useState } from "react";
import type { TherapyCourse } from "@/lib/types";
import { formatDisplayDate, isValidDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

interface TherapyPanelProps {
  courses: TherapyCourse[];
  onAdd: (course: TherapyCourse) => void;
  onUpdate: (course: TherapyCourse) => void;
  onDelete: (id: string) => void;
}

type FormState = {
  drug: "GH" | "GNRH";
  startDate: string;
  endDate: string;
  productName: string;
  doseNote: string;
  note: string;
};

export default function TherapyPanel({ courses, onAdd, onUpdate, onDelete }: TherapyPanelProps) {
  const [form, setForm] = useState<FormState>({
    drug: "GH",
    startDate: "",
    endDate: "",
    productName: "",
    doseNote: "",
    note: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const sorted = useMemo(
    () =>
      [...courses].sort((a, b) =>
        a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0
      ),
    [courses]
  );

  const resetForm = () => {
    setForm({
      drug: "GH",
      startDate: "",
      endDate: "",
      productName: "",
      doseNote: "",
      note: "",
    });
    setEditId(null);
    setError("");
  };

  const handleSubmit = () => {
    if (!form.startDate || !isValidDate(form.startDate)) {
      setError("시작일을 입력해주세요.");
      return;
    }
    if (form.endDate && !isValidDate(form.endDate)) {
      setError("종료일 형식이 올바르지 않습니다.");
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      setError("종료일은 시작일 이후여야 합니다.");
      return;
    }

    const payload: TherapyCourse = {
      id: editId ?? createId(),
      drug: form.drug,
      startDate: form.startDate,
      endDate: form.endDate ? form.endDate : null,
      productName: form.productName || undefined,
      doseNote: form.doseNote || undefined,
      note: form.note || undefined,
    };

    if (editId) {
      onUpdate(payload);
    } else {
      onAdd(payload);
    }
    resetForm();
  };

  const handleEdit = (course: TherapyCourse) => {
    setEditId(course.id);
    setForm({
      drug: course.drug,
      startDate: course.startDate,
      endDate: course.endDate ?? "",
      productName: course.productName ?? "",
      doseNote: course.doseNote ?? "",
      note: course.note ?? "",
    });
    setError("");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="drug">약물 종류</Label>
            <Select
              id="drug"
              value={form.drug}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  drug: event.target.value as "GH" | "GNRH",
                }))
              }
            >
              <option value="GH">Growth Hormone (GH)</option>
              <option value="GNRH">GnRH analog (GNRH)</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">시작일</Label>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, startDate: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">종료일 (선택)</Label>
            <Input
              id="endDate"
              type="date"
              value={form.endDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, endDate: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="productName">제품명</Label>
            <Input
              id="productName"
              placeholder="예: Genotropin"
              value={form.productName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, productName: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doseNote">용량 메모</Label>
            <Input
              id="doseNote"
              placeholder="예: 0.3mg/kg"
              value={form.doseNote}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, doseNote: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="note">추가 메모</Label>
            <Textarea
              id="note"
              rows={3}
              placeholder="진료 기록, 특이사항"
              value={form.note}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, note: event.target.value }))
              }
            />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleSubmit}>{editId ? "수정" : "추가"}</Button>
          {editId && (
            <Button variant="outline" onClick={resetForm}>
              취소
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <p className="text-sm text-[#94a3b8]">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((course) => (
              <div
                key={course.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-[#334155]"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#1a1c24]">
                    {course.drug} · {formatDisplayDate(course.startDate)}
                    {course.endDate ? ` → ${formatDisplayDate(course.endDate)}` : " (ongoing)"}
                  </p>
                  <p className="text-xs text-[#64748b]">
                    {course.productName ? `제품: ${course.productName}` : "제품: -"} · {course.doseNote ? `용량: ${course.doseNote}` : "용량: -"}
                  </p>
                  {course.note && (
                    <p className="text-xs text-[#94a3b8]">{course.note}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(course)}>
                    편집
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(course.id)}>
                    삭제
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
