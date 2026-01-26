"use client";

import { useMemo, useState } from "react";
import type { Measurement } from "@/lib/types";
import { formatDisplayDate, isValidDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

interface MeasurementsPanelProps {
  measurements: Measurement[];
  onAdd: (measurement: Measurement) => void;
  onUpdate: (measurement: Measurement) => void;
  onDelete: (id: string) => void;
}

type FormState = {
  date: string;
  heightCm: string;
  weightKg: string;
};

export default function MeasurementsPanel({
  measurements,
  onAdd,
  onUpdate,
  onDelete,
}: MeasurementsPanelProps) {
  const [form, setForm] = useState<FormState>({
    date: "",
    heightCm: "",
    weightKg: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const sorted = useMemo(
    () =>
      [...measurements].sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : 0
      ),
    [measurements]
  );

  const resetForm = () => {
    setForm({ date: "", heightCm: "", weightKg: "" });
    setEditId(null);
    setError("");
  };

  const handleSubmit = () => {
    if (!form.date || !isValidDate(form.date)) {
      setError("날짜를 입력해주세요.");
      return;
    }
    const height = form.heightCm ? Number(form.heightCm) : null;
    const weight = form.weightKg ? Number(form.weightKg) : null;
    if ((height === null || Number.isNaN(height)) && (weight === null || Number.isNaN(weight))) {
      setError("키 또는 몸무게 중 하나는 입력해야 해요.");
      return;
    }

    const payload: Measurement = {
      id: editId ?? createId(),
      date: form.date,
      heightCm: height === null || Number.isNaN(height) ? undefined : height,
      weightKg: weight === null || Number.isNaN(weight) ? undefined : weight,
    };

    if (editId) {
      onUpdate(payload);
    } else {
      onAdd(payload);
    }
    resetForm();
  };

  const handleEdit = (measurement: Measurement) => {
    setEditId(measurement.id);
    setForm({
      date: measurement.date,
      heightCm: measurement.heightCm?.toString() ?? "",
      weightKg: measurement.weightKg?.toString() ?? "",
    });
    setError("");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="measurementDate">측정일</Label>
            <Input
              id="measurementDate"
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, date: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heightCm">키 (cm)</Label>
            <Input
              id="heightCm"
              type="number"
              inputMode="decimal"
              placeholder="예: 112.4"
              value={form.heightCm}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, heightCm: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weightKg">몸무게 (kg)</Label>
            <Input
              id="weightKg"
              type="number"
              inputMode="decimal"
              placeholder="예: 21.3"
              value={form.weightKg}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, weightKg: event.target.value }))
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
            {sorted.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-[#334155]"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#1a1c24]">
                    {formatDisplayDate(item.date)}
                  </p>
                  <p className="text-xs text-[#64748b]">
                    키 {item.heightCm ?? "-"}cm · 몸무게 {item.weightKg ?? "-"}kg
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                    편집
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(item.id)}
                  >
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
