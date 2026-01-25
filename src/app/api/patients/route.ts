import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

type Sex = "male" | "female";

type SavePayload = {
  chartNumber: string;
  name: string;
  birthDate: string;
  sex: Sex;
  measurementDate: string;
  heightCm?: string | number | null;
  weightKg?: string | number | null;
};

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SavePayload;
    const { chartNumber, name, birthDate, sex, measurementDate, heightCm, weightKg } = body;

    if (!chartNumber || !name || !birthDate || !sex || !measurementDate) {
      return NextResponse.json(
        { error: "필수 항목이 누락되었습니다." },
        { status: 400 }
      );
    }

    if (!isValidDate(birthDate) || !isValidDate(measurementDate)) {
      return NextResponse.json(
        { error: "날짜 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .upsert(
        {
          chart_number: chartNumber,
          name,
          birth_date: birthDate,
          sex,
        },
        { onConflict: "chart_number" }
      )
      .select("id")
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: patientError?.message ?? "환자 저장에 실패했습니다." },
        { status: 500 }
      );
    }

    const measurementPayload = {
      patient_id: patient.id,
      measurement_date: measurementDate,
      height_cm: heightCm !== undefined && heightCm !== null && heightCm !== "" ? Number(heightCm) : null,
      weight_kg: weightKg !== undefined && weightKg !== null && weightKg !== "" ? Number(weightKg) : null,
    };

    const { data: measurement, error: measurementError } = await supabase
      .from("measurements")
      .insert(measurementPayload)
      .select("*")
      .single();

    if (measurementError) {
      return NextResponse.json(
        { error: measurementError.message ?? "측정값 저장에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ patientId: patient.id, measurement });
  } catch (error) {
    return NextResponse.json(
      { error: "서버 요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chartNumber = searchParams.get("chartNumber");

  if (!chartNumber) {
    return NextResponse.json({ error: "chartNumber가 필요합니다." }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, chart_number, name, birth_date, sex")
    .eq("chart_number", chartNumber)
    .single();

  if (patientError || !patient) {
    return NextResponse.json(
      { error: "환자 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const { data: measurement, error: measurementError } = await supabase
    .from("measurements")
    .select("measurement_date, height_cm, weight_kg")
    .eq("patient_id", patient.id)
    .order("measurement_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (measurementError) {
    return NextResponse.json(
      { error: "측정 데이터를 불러올 수 없습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    patient: {
      chartNumber: patient.chart_number,
      name: patient.name,
      birthDate: patient.birth_date,
      sex: patient.sex,
    },
    measurement: measurement
      ? {
          measurementDate: measurement.measurement_date,
          heightCm: measurement.height_cm,
          weightKg: measurement.weight_kg,
        }
      : null,
  });
}
