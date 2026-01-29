import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { NormalizedTestKey, ParsedResult } from "@/lib/labs/types";

export const runtime = "nodejs";

type SavePayload = {
  chartNumber: string;
  collectedAt: string;
  results: Record<NormalizedTestKey, ParsedResult>;
  extractionMethod: "pdf-text" | "ocr";
  rawText?: string | null;
  sourcePdfUrl?: string | null;
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    const accessToken = authHeader.replace("Bearer ", "").trim();

    const body = (await request.json()) as SavePayload;
    if (!body?.chartNumber || !body?.collectedAt) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    const supabase = createSupabaseServer(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "인증이 만료되었습니다." }, { status: 401 });
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id")
      .eq("chart_number", body.chartNumber)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: patientError?.message ?? "환자 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { data: existingPanel, error: existingPanelError } = await supabase
      .from("lab_panels")
      .select("id")
      .eq("patient_id", patient.id)
      .eq("collected_at", body.collectedAt)
      .maybeSingle();

    if (existingPanelError) {
      return NextResponse.json(
        { error: existingPanelError.message ?? "검사 패널 저장에 실패했습니다." },
        { status: 500 }
      );
    }

    const panelPayload = {
      patient_id: patient.id,
      collected_at: body.collectedAt,
      source_pdf_url: body.sourcePdfUrl ?? null,
      extraction_method: body.extractionMethod,
      raw_text: body.rawText ?? null,
    };

    let panelId = existingPanel?.id ?? null;
    if (panelId) {
      const { error: updateError } = await supabase
        .from("lab_panels")
        .update(panelPayload)
        .eq("id", panelId);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message ?? "검사 패널 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("lab_panels")
        .insert(panelPayload)
        .select("id")
        .single();

      if (insertError || !inserted) {
        return NextResponse.json(
          { error: insertError?.message ?? "검사 패널 저장에 실패했습니다." },
          { status: 500 }
        );
      }
      panelId = inserted.id;
    }

    const payload = Object.values(body.results ?? {})
      .filter((result) => result.valueRaw && result.valueRaw.trim() !== "")
      .map((result) => ({
      panel_id: panelId,
      test_key: result.testKey,
      value_raw: result.valueRaw,
      value_numeric: result.valueNumeric,
      unit: result.unit,
      source_line: result.sourceLine,
    }));

    if (payload.length > 0) {
      const { error: upsertError } = await supabase
        .from("lab_results")
        .upsert(payload, { onConflict: "panel_id,test_key" });

      if (upsertError?.message?.includes("no unique or exclusion constraint")) {
        await supabase.from("lab_results").insert(payload);
      } else if (upsertError) {
        return NextResponse.json(
          { error: upsertError.message ?? "검사 결과 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ panelId });
  } catch (error) {
    return NextResponse.json({ error: "서버 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
