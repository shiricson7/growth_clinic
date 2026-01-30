import { useState, useRef, useMemo } from "react";
import { useMemo as useMemoReact } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
    BoneAgeRecord,
    LabPanelSummary,
    ParsedResult,
    NormalizedTestKey,
    PatientInfo,
    HormoneLevels
} from "@/lib/types";
import { LAB_KEY_TO_HORMONE, LAB_HORMONE_TO_KEY } from "@/lib/labs/constants";
import type { Session } from "@supabase/supabase-js";

export function useLabData(
    session: Session | null,
    patientInfo: PatientInfo,
    setPatientInfo: React.Dispatch<React.SetStateAction<PatientInfo>>
) {
    const supabase = useMemo(() => getSupabaseClient(), []);

    const [labPanels, setLabPanels] = useState<LabPanelSummary[]>([]);
    const [boneAgeRecords, setBoneAgeRecords] = useState<BoneAgeRecord[]>([]);

    // Lab Import State
    const [labFile, setLabFile] = useState<File | null>(null);
    const [labResults, setLabResults] = useState<Record<NormalizedTestKey, ParsedResult>>(
        {} as Record<NormalizedTestKey, ParsedResult>
    );
    const [labMethod, setLabMethod] = useState<"pdf-text" | "ocr" | null>(null);
    const [labRawText, setLabRawText] = useState("");
    const [labImportStatus, setLabImportStatus] = useState("");
    const [labSaveStatus, setLabSaveStatus] = useState("");
    const [saveRawText, setSaveRawText] = useState(false);

    // Form State
    const [boneAgeInput, setBoneAgeInput] = useState("");
    const [boneAgeDateInput, setBoneAgeDateInput] = useState("");
    const [hormoneTestDateInput, setHormoneTestDateInput] = useState("");
    const [hormoneInputValues, setHormoneInputValues] = useState<Record<string, string>>({});
    const [boneAgeSaveStatus, setBoneAgeSaveStatus] = useState("");

    const parseLabNumeric = (raw: string) => {
        const numeric = Number(raw.replace(/[<>≤≥＜＞]/g, "").trim());
        return Number.isFinite(numeric) ? numeric : null;
    };

    const fetchBoneAgeRecords = async (patientId: string) => {
        if (!supabase || !session) return;
        const { data, error } = await supabase
            .from("bone_age_records")
            .select("id, measured_at, bone_age")
            .eq("patient_id", patientId)
            .order("measured_at", { ascending: false });
        if (error || !data) {
            setBoneAgeRecords([]);
            return;
        }
        setBoneAgeRecords(
            data.map((item) => ({
                id: item.id,
                measuredAt: item.measured_at,
                boneAge: item.bone_age ?? "",
            }))
        );
    };

    const fetchLabPanels = async (patientId: string) => {
        if (!supabase || !session) return;
        const { data: panels, error: panelError } = await supabase
            .from("lab_panels")
            .select("id, collected_at")
            .eq("patient_id", patientId)
            .order("collected_at", { ascending: false });
        if (panelError || !panels) {
            setLabPanels([]);
            return;
        }

        const panelIds = panels.map((p) => p.id);
        if (panelIds.length === 0) {
            setLabPanels([]);
            return;
        }

        const { data: results, error: resultsError } = await supabase
            .from("lab_results")
            .select("panel_id, test_key, value_numeric, value_raw, unit")
            .in("panel_id", panelIds);

        if (resultsError || !results) {
            setLabPanels([]);
            return;
        }

        const summaryMap = new Map<string, LabPanelSummary>();
        panels.forEach((p) => {
            summaryMap.set(p.id, {
                id: p.id,
                collectedAt: p.collected_at,
                results: {} as Record<NormalizedTestKey, ParsedResult>,
            });
        });

        results.forEach((r) => {
            const summary = summaryMap.get(r.panel_id);
            if (summary) {
                summary.results[r.test_key as NormalizedTestKey] = {
                    testKey: r.test_key as NormalizedTestKey,
                    valueRaw: r.value_raw,
                    valueNumeric: r.value_numeric,
                    unit: r.unit,
                    sourceLine: "",
                    matchedBy: "db",
                };
            }
        });
        setLabPanels(Array.from(summaryMap.values()));
    };

    const handleSaveBoneAge = async () => {
        if (!session || !supabase) {
            setBoneAgeSaveStatus("로그인 후 저장할 수 있어요.");
            return;
        }
        if (!patientInfo.chartNumber.trim()) {
            setBoneAgeSaveStatus("차트번호를 입력해주세요.");
            return;
        }
        if (!boneAgeDateInput || !boneAgeInput.trim()) {
            setBoneAgeSaveStatus("검사일과 골연령을 입력해주세요.");
            return;
        }
        setBoneAgeSaveStatus("저장 중...");
        let patientId = "";

        // 1. Try to find patient
        const { data: existingPatient } = await supabase
            .from("patients")
            .select("id")
            .eq("chart_number", patientInfo.chartNumber.trim())
            .maybeSingle();

        if (existingPatient) {
            patientId = existingPatient.id;
        } else {
            // 2. Create if not found
            if (!patientInfo.name || !patientInfo.birthDate) {
                setBoneAgeSaveStatus("신규 환자입니다. 이름과 생년월일을 입력해주세요.");
                return;
            }

            const { data: newUser, error: createError } = await supabase
                .from("patients")
                .insert({
                    chart_number: patientInfo.chartNumber.trim(),
                    name: patientInfo.name,
                    birth_date: patientInfo.birthDate,
                    sex: patientInfo.sex,
                })
                .select("id")
                .single();

            if (createError || !newUser) {
                setBoneAgeSaveStatus("환자 생성 실패: " + createError?.message);
                return;
            }
            patientId = newUser.id;
        }

        const patient = { id: patientId }; // Compat with existing code usage if any, mostly used for ID
        const payload = {
            patient_id: patient.id,
            measured_at: boneAgeDateInput,
            bone_age: boneAgeInput.trim(),
        };
        const { error: upsertError } = await supabase
            .from("bone_age_records")
            .upsert(payload, { onConflict: "patient_id,measured_at" });

        if (upsertError?.message?.includes("no unique or exclusion constraint")) {
            const { error: insertError } = await supabase.from("bone_age_records").insert(payload);
            if (insertError) {
                setBoneAgeSaveStatus(insertError.message ?? "골연령 저장에 실패했습니다.");
                return;
            }
        } else if (upsertError) {
            setBoneAgeSaveStatus(upsertError.message ?? "골연령 저장에 실패했습니다.");
            return;
        }

        // Update Patient's latest bone age
        const { error: updatePatientError } = await supabase
            .from("patients")
            .update({
                bone_age: boneAgeInput.trim(),
                bone_age_date: boneAgeDateInput
            })
            .eq("id", patientId);

        if (updatePatientError) {
            console.error("Failed to update patient bone age summary", updatePatientError);
            // We don't block success message for this, but good to know
        }

        setPatientInfo((prev) => ({
            ...prev,
            boneAge: boneAgeInput.trim(),
            boneAgeDate: boneAgeDateInput,
        }));

        setBoneAgeRecords((prev) => {
            const next = [...prev];
            const existingIndex = next.findIndex(
                (item) => item.measuredAt === boneAgeDateInput
            );
            const record: BoneAgeRecord = {
                id: existingIndex >= 0 ? next[existingIndex].id : crypto.randomUUID(),
                measuredAt: boneAgeDateInput,
                boneAge: boneAgeInput.trim(),
            };
            if (existingIndex >= 0) {
                next[existingIndex] = record;
            } else {
                next.unshift(record);
            }
            return next;
        });
        setBoneAgeInput("");
        setBoneAgeDateInput("");
        setBoneAgeSaveStatus("저장 완료!");
    };

    const applyLabResultsToForm = (
        results: Record<NormalizedTestKey, ParsedResult>,
        collectedAtValue?: string | null
    ) => {
        const updates: Record<string, string> = {};
        Object.entries(results).forEach(([key, result]) => {
            const hormoneKey = LAB_KEY_TO_HORMONE[key as NormalizedTestKey];
            if (!hormoneKey) return;
            updates[hormoneKey] = result.valueRaw;
        });
        if (Object.keys(updates).length > 0) {
            setHormoneInputValues((prev) => ({
                ...prev,
                ...updates,
            }));
        }
        if (collectedAtValue) {
            setHormoneTestDateInput(collectedAtValue);
        }
    };

    const handleImportLabPdf = async () => {
        if (!session || !supabase) {
            setLabImportStatus("로그인 후 업로드할 수 있어요.");
            return;
        }
        if (!labFile) {
            setLabImportStatus("PDF 파일을 선택해주세요.");
            return;
        }

        setLabImportStatus("PDF를 분석하는 중...");
        try {
            const formData = new FormData();
            formData.append("file", labFile);
            const response = await fetch("/api/labs/import-pdf", {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: formData,
            });
            if (!response.ok) {
                throw new Error("import failed");
            }
            const data = (await response.json()) as {
                collectedAt: string | null;
                results: Record<NormalizedTestKey, ParsedResult>;
                method: "pdf-text" | "ocr";
                rawText: string;
            };
            setLabResults(data.results ?? ({} as Record<NormalizedTestKey, ParsedResult>));
            setLabMethod(data.method ?? null);
            setLabRawText(data.rawText ?? "");
            applyLabResultsToForm(data.results ?? {}, data.collectedAt);
            setLabImportStatus("추출 완료!");
            return true; // Signal success to parent to toggle views if needed
        } catch (error) {
            setLabImportStatus("추출 실패: PDF 내용을 확인해주세요.");
            return false;
        }
    };

    const hormoneFields = useMemo(() => [
        { key: "LH", label: "LH", unitCaption: "mIU/mL", summaryUnit: "mIU/mL" },
        { key: "FSH", label: "FSH", unitCaption: "mIU/mL", summaryUnit: "mIU/mL" },
        { key: "E2", label: "E2", unitCaption: "ng/mL", summaryUnit: "ng/mL" },
        { key: "Testosterone", label: "Testosterone", unitCaption: "ng/mL", summaryUnit: "ng/mL" },
        { key: "TSH", label: "TSH", unitCaption: "uIU/mL", summaryUnit: "uIU/mL" },
        { key: "fT4", label: "FreeT4", unitCaption: "ng/dL", summaryUnit: "ng/dL" },
        { key: "DHEA", label: "DHEA", unitCaption: "ng/mL", summaryUnit: "ng/mL" },
        { key: "IGF_BP3", label: "IGF-BP3", unitCaption: "ng/mL", summaryUnit: "ng/mL" },
        {
            key: "IGF_1",
            label: "IGF-1",
            summaryLabel: "Somatomedin-C",
            unitCaption: "Somatomedin-C ng/mL",
            summaryUnit: "ng/mL",
        },
        { key: "HbA1c", label: "HbA1c", unitCaption: "%", summaryUnit: "%" },
    ], []);

    const buildLabResultsForSave = () => {
        const results: Record<NormalizedTestKey, ParsedResult> = {} as Record<
            NormalizedTestKey,
            ParsedResult
        >;
        hormoneFields.forEach((field) => {
            const value = hormoneInputValues[field.key]?.trim();
            if (!value) return;
            const labKey = LAB_HORMONE_TO_KEY[field.key as keyof HormoneLevels];
            if (!labKey) return;
            const existing = labResults[labKey];
            results[labKey] = {
                testKey: labKey,
                valueRaw: value,
                valueNumeric: parseLabNumeric(value),
                unit: existing?.unit ?? field.unitCaption ?? null,
                sourceLine: existing?.sourceLine ?? "",
                matchedBy: existing?.matchedBy ?? "manual",
            };
        });
        return results;
    };

    const handleSaveLabResults = async () => {
        if (!session || !supabase) {
            setLabSaveStatus("로그인 후 저장할 수 있어요.");
            return;
        }
        if (!patientInfo.chartNumber) {
            setLabSaveStatus("차트번호를 입력해주세요.");
            return;
        }
        if (!hormoneTestDateInput) {
            setLabSaveStatus("검체접수일을 입력해주세요.");
            return;
        }
        setLabSaveStatus("저장 중...");
        try {
            const { data: patient, error: patientError } = await supabase
                .from("patients")
                .select("id, created_at")
                .eq("chart_number", patientInfo.chartNumber.trim())
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (patientError || !patient) {
                setLabSaveStatus(patientError?.message ?? "환자 정보를 찾을 수 없습니다.");
                return;
            }

            const resultsPayload = buildLabResultsForSave();
            if (Object.keys(resultsPayload).length === 0) {
                setLabSaveStatus("저장할 검사 수치를 입력해주세요.");
                return;
            }

            const response = await fetch("/api/labs/save", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    chartNumber: patientInfo.chartNumber,
                    collectedAt: hormoneTestDateInput,
                    results: resultsPayload,
                    extractionMethod: labMethod ?? "pdf-text",
                    rawText: saveRawText ? labRawText : null,
                }),
            });

            if (!response.ok) {
                let message = "저장에 실패했습니다.";
                try {
                    const data = (await response.json()) as { error?: string };
                    if (data?.error) {
                        message = `저장 실패: ${data.error}`;
                    }
                } catch {
                    // Ignore
                }
                setLabSaveStatus(message);
                return;
            }
            setLabSaveStatus("저장 완료!");

            // Update Patient Info
            const newHormones = {
                ...((typeof patientInfo.hormoneLevels === "object" && patientInfo.hormoneLevels)
                    ? patientInfo.hormoneLevels
                    : {}),
                ...Object.entries(resultsPayload).reduce((acc, [key, result]) => {
                    const hormoneKey = LAB_KEY_TO_HORMONE[key as NormalizedTestKey];
                    if (!hormoneKey) return acc;
                    acc[hormoneKey] = result.valueRaw;
                    return acc;
                }, {} as Record<keyof HormoneLevels, string>),
            };

            setPatientInfo((prev) => ({
                ...prev,
                hormoneTestDate: hormoneTestDateInput,
                hormoneLevels: newHormones,
            }));

            await fetchLabPanels(patient.id);
            setHormoneInputValues({});
            setHormoneTestDateInput("");
            setLabResults({} as Record<NormalizedTestKey, ParsedResult>);
            setLabMethod(null);
            setLabRawText("");
            setLabFile(null);
        } catch (error) {
            setLabSaveStatus("저장에 실패했습니다.");
        }
    };

    return {
        labPanels,
        boneAgeRecords,

        labFile, setLabFile,
        labResults, setLabResults,
        labMethod, setLabMethod,
        labRawText, setLabRawText,
        labImportStatus, setLabImportStatus,
        labSaveStatus, setLabSaveStatus,
        saveRawText, setSaveRawText,

        boneAgeInput, setBoneAgeInput,
        boneAgeDateInput, setBoneAgeDateInput,
        boneAgeSaveStatus, setBoneAgeSaveStatus,

        hormoneTestDateInput, setHormoneTestDateInput,
        hormoneInputValues, setHormoneInputValues,

        fetchBoneAgeRecords,
        fetchLabPanels,
        handleSaveBoneAge,
        handleSaveLabResults,
        handleImportLabPdf,
        hormoneFields
    };
}
