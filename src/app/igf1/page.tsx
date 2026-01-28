"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Info,
  Calculator,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface ReferenceRange {
  minAge: number;
  maxAge: number;
  low: number;
  high: number;
}

interface ReferenceData {
  male: ReferenceRange[];
  female: ReferenceRange[];
}

const IGF1_DATA: ReferenceData = {
  male: [
    { minAge: 0, maxAge: 1, low: 18, high: 79 },
    { minAge: 1, maxAge: 2, low: 20, high: 135 },
    { minAge: 3, maxAge: 5, low: 28, high: 196 },
    { minAge: 6, maxAge: 8, low: 43, high: 275 },
    { minAge: 9, maxAge: 11, low: 67, high: 423 },
    { minAge: 12, maxAge: 15, low: 87, high: 760 },
    { minAge: 16, maxAge: 20, low: 116, high: 748 },
    { minAge: 21, maxAge: 25, low: 109, high: 353 },
    { minAge: 26, maxAge: 30, low: 101, high: 307 },
    { minAge: 31, maxAge: 35, low: 95, high: 290 },
    { minAge: 36, maxAge: 40, low: 90, high: 278 },
    { minAge: 41, maxAge: 45, low: 84, high: 270 },
    { minAge: 46, maxAge: 50, low: 81, high: 263 },
    { minAge: 51, maxAge: 55, low: 74, high: 255 },
    { minAge: 56, maxAge: 60, low: 68, high: 247 },
    { minAge: 61, maxAge: 65, low: 64, high: 240 },
    { minAge: 66, maxAge: 70, low: 59, high: 230 },
    { minAge: 71, maxAge: 75, low: 53, high: 222 },
    { minAge: 76, maxAge: 80, low: 45, high: 207 },
    { minAge: 81, maxAge: 120, low: 33, high: 194 },
  ],
  female: [
    { minAge: 0, maxAge: 1, low: 14, high: 106 },
    { minAge: 1, maxAge: 2, low: 23, high: 163 },
    { minAge: 3, maxAge: 5, low: 34, high: 243 },
    { minAge: 6, maxAge: 8, low: 56, high: 337 },
    { minAge: 9, maxAge: 11, low: 81, high: 610 },
    { minAge: 12, maxAge: 15, low: 110, high: 678 },
    { minAge: 16, maxAge: 20, low: 108, high: 517 },
    { minAge: 21, maxAge: 25, low: 101, high: 347 },
    { minAge: 26, maxAge: 30, low: 91, high: 308 },
    { minAge: 31, maxAge: 35, low: 84, high: 281 },
    { minAge: 36, maxAge: 40, low: 79, high: 259 },
    { minAge: 41, maxAge: 45, low: 74, high: 239 },
    { minAge: 46, maxAge: 50, low: 70, high: 225 },
    { minAge: 51, maxAge: 55, low: 65, high: 216 },
    { minAge: 56, maxAge: 60, low: 60, high: 207 },
    { minAge: 61, maxAge: 65, low: 57, high: 202 },
    { minAge: 66, maxAge: 70, low: 52, high: 196 },
    { minAge: 71, maxAge: 75, low: 48, high: 191 },
    { minAge: 76, maxAge: 80, low: 42, high: 185 },
    { minAge: 81, maxAge: 120, low: 34, high: 177 },
  ],
};

const erf = (x: number) => {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-absX * absX);

  return sign * y;
};

const standardNormalCDF = (z: number) => 0.5 * (1 + erf(z / Math.sqrt(2)));

export default function Igf1AnalyzerPage() {
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [igfValue, setIgfValue] = useState<number | "">("");

  const result = useMemo(() => {
    if (age === "" || igfValue === "") return null;

    const dataset = IGF1_DATA[gender];
    const range = dataset.find((item) => age >= item.minAge && age <= item.maxAge);

    if (!range) return { error: "해당 연령대의 데이터가 없습니다." };

    const mean = (range.high + range.low) / 2;
    const sdApprox = (range.high - range.low) / 3.92;
    const zScore = (igfValue - mean) / sdApprox;

    let percentile = standardNormalCDF(zScore) * 100;
    percentile = Math.min(Math.max(percentile, 0.1), 99.9);

    let status: "Low" | "Normal" | "High" = "Normal";
    if (igfValue < range.low) status = "Low";
    if (igfValue > range.high) status = "High";

    return {
      range,
      percentile,
      zScore,
      status,
    };
  }, [age, gender, igfValue]);

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-slate-800">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              IGF-1 Analyzer
            </p>
            <h1 className="text-2xl font-bold">IGF-1 분석기</h1>
            <p className="text-sm text-slate-500">Roche Elecsys® 참고치 기준</p>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold text-slate-500 underline-offset-4 hover:underline"
          >
            대시보드로
          </Link>
        </header>

        <div className="w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
          <div className="bg-blue-600 p-6 text-white">
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6" />
              <h2 className="text-xl font-bold">IGF-1 분석기</h2>
            </div>
            <p className="mt-1 text-sm text-blue-100">Roche Elecsys® 참고치 기준</p>
          </div>

          <div className="space-y-6 p-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">성별</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGender("male")}
                  className={`rounded-lg border px-4 py-2 font-medium transition-all ${
                    gender === "male"
                      ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  남성 (Male)
                </button>
                <button
                  type="button"
                  onClick={() => setGender("female")}
                  className={`rounded-lg border px-4 py-2 font-medium transition-all ${
                    gender === "female"
                      ? "border-pink-500 bg-pink-50 text-pink-700 ring-1 ring-pink-500"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  여성 (Female)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">나이 (만)</label>
                <input
                  type="number"
                  value={age}
                  onChange={(event) =>
                    setAge(event.target.value === "" ? "" : Number(event.target.value))
                  }
                  placeholder="예: 35"
                  className="w-full rounded-lg border border-gray-300 p-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">IGF-1 수치</label>
                <div className="relative">
                  <input
                    type="number"
                    value={igfValue}
                    onChange={(event) =>
                      setIgfValue(event.target.value === "" ? "" : Number(event.target.value))
                    }
                    placeholder="예: 180"
                    className="w-full rounded-lg border border-gray-300 p-2 pr-12 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-medium text-gray-400">
                    ng/mL
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              {result && !("error" in result) ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        결과 분석
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        {result.status === "Normal" && (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        {result.status !== "Normal" && (
                          <AlertTriangle
                            className={`h-5 w-5 ${
                              result.status === "High" ? "text-orange-500" : "text-blue-500"
                            }`}
                          />
                        )}
                        <span
                          className={`text-xl font-bold ${
                            result.status === "Normal"
                              ? "text-green-700"
                              : result.status === "High"
                              ? "text-orange-600"
                              : "text-blue-600"
                          }`}
                        >
                          {result.status === "Normal"
                            ? "정상 범위 (Normal)"
                            : result.status === "High"
                            ? "수치 높음 (High)"
                            : "수치 낮음 (Low)"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">추정 백분위수</div>
                      <div className="text-2xl font-bold text-gray-800">
                        {result.percentile.toFixed(1)}
                        <span className="text-sm text-gray-500">%ile</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    <span>참고 정상 범위 (Age {age}):</span>
                    <span className="font-mono font-medium text-gray-900">
                      {result.range.low} - {result.range.high} ng/mL
                    </span>
                  </div>

                  <div className="relative pb-2 pt-6">
                    <div className="h-4 w-full overflow-hidden rounded-full bg-gradient-to-r from-blue-200 via-green-200 to-orange-200">
                      <div className="absolute left-[2.5%] right-[2.5%] top-0 h-4 border-x-2 border-white/50 bg-white/10" />
                    </div>
                    <div
                      className="absolute top-0 flex -translate-x-1/2 flex-col items-center transition-all duration-700 ease-out"
                      style={{ left: `${result.percentile}%` }}
                    >
                      <div className="mb-1 rounded border bg-white px-1.5 py-0.5 text-xs font-bold text-gray-800 shadow-sm">
                        {igfValue}
                      </div>
                      <div className="h-6 w-0.5 bg-gray-800" />
                    </div>
                    <div className="mt-1 flex justify-between px-1 text-[10px] font-medium text-gray-400">
                      <span>Low (2.5%)</span>
                      <span>Median (50%)</span>
                      <span>High (97.5%)</span>
                    </div>
                  </div>

                  <div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-xs text-gray-500">
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                    <p>
                      이 백분위수는 Roche Elecsys 키트의 연령별 참고 범위(2.5th-97.5th)를
                      기준으로 정규분포를 가정하여 추산한 값입니다. 실제 임상적 판단은
                      의사와 상담하세요.
                    </p>
                  </div>
                </div>
              ) : result && "error" in result ? (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-500">
                  <AlertCircle className="h-5 w-5" />
                  {result.error}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center text-gray-400">
                  <Calculator className="mb-2 h-12 w-12 opacity-20" />
                  <p>나이와 수치를 입력하면 분석 결과가 표시됩니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
