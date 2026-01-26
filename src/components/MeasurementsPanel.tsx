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
  onImport: (items: Measurement[]) => { added: number; updated: number; skipped: number };
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
  onImport,
}: MeasurementsPanelProps) {
  const [form, setForm] = useState<FormState>({
    date: "",
    heightCm: "",
    weightKg: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [csvStatus, setCsvStatus] = useState<string>("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

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

  const splitCsvLine = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    result.push(current);
    return result;
  };

  const parseCsv = (content: string) => {
    const trimmed = content.replace(/^\uFEFF/, "").trim();
    if (!trimmed) {
      return { rows: [], skipped: 0, error: "빈 CSV 파일입니다." } as const;
    }
    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) {
      return { rows: [], skipped: 0, error: "CSV 데이터를 찾을 수 없습니다." } as const;
    }

    let startIndex = 0;
    let columnIndex = { date: 0, height: 1, weight: 2 };
    const headerCells = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
    const dateIndex = headerCells.findIndex((cell) => cell === "date" || cell === "measurement_date");
    const heightIndex = headerCells.findIndex((cell) => cell === "height_cm" || cell === "height");
    const weightIndex = headerCells.findIndex((cell) => cell === "weight_kg" || cell === "weight");
    if (dateIndex !== -1 && heightIndex !== -1 && weightIndex !== -1) {
      columnIndex = { date: dateIndex, height: heightIndex, weight: weightIndex };
      startIndex = 1;
    }

    let skipped = 0;
    const rows: Measurement[] = [];
    for (let i = startIndex; i < lines.length; i += 1) {
      const cells = splitCsvLine(lines[i]);
      const date = (cells[columnIndex.date] ?? "").trim();
      if (!date || !isValidDate(date)) {
        skipped += 1;
        continue;
      }
      const heightRaw = (cells[columnIndex.height] ?? "").trim();
      const weightRaw = (cells[columnIndex.weight] ?? "").trim();
      const height = heightRaw ? Number(heightRaw) : null;
      const weight = weightRaw ? Number(weightRaw) : null;
      if ((height === null || Number.isNaN(height)) && (weight === null || Number.isNaN(weight))) {
        skipped += 1;
        continue;
      }
      rows.push({
        id: createId(),
        date,
        heightCm: height === null || Number.isNaN(height) ? undefined : height,
        weightKg: weight === null || Number.isNaN(weight) ? undefined : weight,
      });
    }

    return { rows, skipped } as const;
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

  const handleCsvUpload = async () => {
    if (!csvFile) {
      setCsvStatus("CSV 파일을 선택해주세요.");
      return;
    }
    setCsvStatus("CSV를 읽는 중...");
    try {
      const content = await csvFile.text();
      const parsed = parseCsv(content);
      if ("error" in parsed && parsed.error) {
        setCsvStatus(parsed.error);
        return;
      }
      const result = onImport(parsed.rows);
      const summary = [
        `${result.added}건 추가`,
        result.updated ? `${result.updated}건 갱신` : null,
        parsed.skipped ? `${parsed.skipped}건 제외` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      setCsvStatus(`CSV 업로드 완료! ${summary}`);
      setCsvFile(null);
    } catch (error) {
      setCsvStatus("CSV 파일을 읽을 수 없습니다.");
    }
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

      <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1a1c24]">CSV 업로드</p>
            <p className="text-xs text-[#94a3b8]">date, height_cm, weight_kg</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleCsvUpload}>
            업로드
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setCsvFile(event.target.files?.[0] ?? null);
              setCsvStatus("");
            }}
          />
          {csvStatus && <p className="text-xs text-[#64748b]">{csvStatus}</p>}
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
