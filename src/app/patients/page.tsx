"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { loadPatientDirectory, type PatientDirectoryEntry } from "@/lib/storage";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PatientRow = {
  id: string;
  chart_number: string;
  name: string;
  birth_date: string;
  sex: "male" | "female" | "";
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const formatSex = (sex: PatientRow["sex"]) =>
  sex === "male" ? "남아" : sex === "female" ? "여아" : "-";

export default function PatientsPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [localRows, setLocalRows] = useState<PatientDirectoryEntry[]>([]);
  const useLocal = !supabase || !session;

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!supabase || !session) {
      const entries = loadPatientDirectory();
      const filtered = trimmed
        ? entries.filter((item) => {
            const haystack = `${item.name} ${item.chartNumber} ${item.birthDate}`.toLowerCase();
            return haystack.includes(trimmed.toLowerCase());
          })
        : entries;
      setLocalRows(filtered);
      return;
    }

    setLoading(true);
    setStatus("");
    const handle = setTimeout(async () => {
      let request = supabase
        .from("patients")
        .select("id, chart_number, name, birth_date, sex")
        .order("chart_number", { ascending: true })
        .limit(200);

      if (trimmed) {
        if (datePattern.test(trimmed)) {
          request = request.or(
            `name.ilike.%${trimmed}%,chart_number.ilike.%${trimmed}%,birth_date.eq.${trimmed}`
          );
        } else {
          request = request.or(
            `name.ilike.%${trimmed}%,chart_number.ilike.%${trimmed}%,birth_date.ilike.%${trimmed}%`
          );
        }
      }

      const { data, error } = await request;
      if (error) {
        setStatus(error.message ?? "환자 목록을 불러오지 못했습니다.");
        setRows([]);
      } else {
        setRows((data ?? []) as PatientRow[]);
      }
      setLoading(false);
    }, 250);

    return () => clearTimeout(handle);
  }, [supabase, session, query]);

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 pb-16 pt-10 text-[#1a1c24]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#94a3b8]">
              환자 목록
            </p>
            <h1 className="text-3xl font-bold">환자 리스트</h1>
            <p className="text-sm text-[#64748b]">
              이름, 차트번호, 생년월일로 검색할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-sm font-semibold text-[#475569] underline-offset-4 hover:underline"
            >
              돌아가기
            </Link>
          </div>
        </header>

        {authLoading ? (
          <Card>
            <CardContent>
              <p className="text-sm text-[#64748b]">로그인 상태 확인 중...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {useLocal && (
              <Card>
                <CardContent>
                  <p className="text-sm text-[#64748b]">
                    현재는 로컬에 저장된 환자 목록을 보여줍니다.
                    {supabase ? " 로그인하면 전체 목록을 확인할 수 있습니다." : ""}
                  </p>
                  {!session && supabase && (
                    <div className="mt-3">
                      <Link href="/">
                        <Button variant="outline">로그인 화면으로</Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-bold">검색</h2>
              </CardHeader>
              <CardContent>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="이름, 차트번호, 생년월일(YYYY-MM-DD)"
                />
                <div className="mt-2 text-xs text-[#94a3b8]">
                  {loading ? "검색 중..." : `총 ${useLocal ? localRows.length : rows.length}명`}
                </div>
                {status && <p className="mt-2 text-xs text-rose-500">{status}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-bold">환자 목록</h2>
              </CardHeader>
              <CardContent>
                {useLocal ? (
                  localRows.length === 0 ? (
                    <p className="text-sm text-[#94a3b8]">표시할 환자가 없습니다.</p>
                  ) : (
                    <div className="divide-y divide-[#e2e8f0]">
                      {localRows.map((row) => (
                        <Link
                          key={row.id}
                          href={`/?patient=${encodeURIComponent(row.chartNumber || row.id)}`}
                          className="flex flex-wrap items-center justify-between gap-4 py-3 text-sm transition hover:bg-[#f1f5f9]/60"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-[#1a1c24]">
                              {row.name || "미입력"} · {row.chartNumber || "-"}
                            </p>
                            <p className="text-xs text-[#64748b]">
                              생년월일 {row.birthDate || "-"} · {formatSex(row.sex)}
                            </p>
                            <p className="text-xs text-[#94a3b8]">
                              측정 {row.measurementCount}건 · 치료 {row.therapyCount}건
                              {row.lastMeasurementDate
                                ? ` · 최근 ${row.lastMeasurementDate}`
                                : ""}
                            </p>
                          </div>
                          <div className="text-xs text-[#94a3b8]">ID {row.id}</div>
                        </Link>
                      ))}
                    </div>
                  )
                ) : rows.length === 0 ? (
                  <p className="text-sm text-[#94a3b8]">표시할 환자가 없습니다.</p>
                ) : (
                  <div className="divide-y divide-[#e2e8f0]">
                    {rows.map((row) => (
                      <Link
                        key={row.id}
                        href={`/?patient=${encodeURIComponent(row.chart_number)}`}
                        className="flex flex-wrap items-center justify-between gap-4 py-3 text-sm transition hover:bg-[#f1f5f9]/60"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-[#1a1c24]">
                            {row.name || "미입력"} · {row.chart_number}
                          </p>
                          <p className="text-xs text-[#64748b]">
                            생년월일 {row.birth_date || "-"} · {formatSex(row.sex)}
                          </p>
                        </div>
                        <div className="text-xs text-[#94a3b8]">ID {row.id}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
