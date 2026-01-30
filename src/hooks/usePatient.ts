import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { PatientInfo, ChartSuggestion, HormoneLevels } from "@/lib/types";
import {
    loadPatientDirectory,
    savePatientInfo,
} from "@/lib/storage";
import { deriveRrnInfo, normalizeRrn } from "@/lib/rrn";
import type { Session } from "@supabase/supabase-js";

export function usePatient(hydrated: boolean, session: Session | null) {
    const searchParams = useSearchParams();
    const supabase = useMemo(() => getSupabaseClient(), []);

    const [patientInfo, setPatientInfo] = useState<PatientInfo>({
        name: "",
        chartNumber: "",
        rrn: "",
        sex: "",
        birthDate: "",
        boneAge: "",
        boneAgeDate: "",
        hormoneLevels: {},
        hormoneTestDate: "",
    });

    const [chartSuggestions, setChartSuggestions] = useState<ChartSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [loadStatus, setLoadStatus] = useState("");

    // Autosave patientInfo to local storage (partial)
    useEffect(() => {
        if (!hydrated) return;
        savePatientInfo(patientInfo);
    }, [patientInfo, hydrated]);

    // Search logic
    useEffect(() => {
        if (!hydrated) return;
        const query = patientInfo.chartNumber.trim();
        if (query.length < 1) {
            setChartSuggestions([]);
            setIsSearching(false);
            return;
        }

        if (supabase && session) {
            setIsSearching(true);
            const handle = setTimeout(async () => {
                const { data, error } = await supabase
                    .from("patients")
                    .select("chart_number, name, birth_date, sex")
                    .ilike("chart_number", `${query}%`)
                    .order("chart_number", { ascending: true })
                    .limit(6);

                if (error) {
                    setChartSuggestions([]);
                    setIsSearching(false);
                    return;
                }

                setChartSuggestions(
                    (data ?? []).map((item) => ({
                        chartNumber: item.chart_number,
                        name: item.name ?? "",
                        birthDate: item.birth_date ?? "",
                        sex: item.sex ?? "",
                    }))
                );
                setIsSearching(false);
            }, 250);

            return () => clearTimeout(handle);
        }

        // Local fallback
        const local = loadPatientDirectory()
            .filter((item) => item.chartNumber?.startsWith(query))
            .slice(0, 6)
            .map((item) => ({
                chartNumber: item.chartNumber,
                name: item.name,
                birthDate: item.birthDate,
                sex: item.sex,
            }));
        setChartSuggestions(local);
        setIsSearching(false);
    }, [hydrated, patientInfo.chartNumber, session, supabase]);

    const handleRrnChange = (value: string) => {
        const normalized = normalizeRrn(value);
        const derived = deriveRrnInfo(normalized);
        setPatientInfo((prev) => ({
            ...prev,
            rrn: normalized,
            ...(derived.birthDate ? { birthDate: derived.birthDate } : {}),
            ...(derived.sex ? { sex: derived.sex } : {}),
        }));
    };

    return {
        patientInfo,
        setPatientInfo,
        chartSuggestions,
        setChartSuggestions,
        isSearching,
        loadStatus,
        setLoadStatus,
        handleRrnChange,
    };
}
