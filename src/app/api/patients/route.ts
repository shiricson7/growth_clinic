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
  boneAge?: string | null;
  hormoneLevels?: Record<string, string> | string | null;
};

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    const accessToken = authHeader.replace("Bearer ", "").trim();

    const body = (await request.json()) as SavePayload;
    const {
      chartNumber,
      name,
      birthDate,
      sex,
      measurementDate,
      heightCm,
      weightKg,
      boneAge,
      hormoneLevels,
    } = body;

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

    const supabase = createSupabaseServer(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "인증이 만료되었습니다." }, { status: 401 });
    }
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .upsert(
        {
          chart_number: chartNumber,
          name,
          birth_date: birthDate,
          sex,
          bone_age: boneAge ?? null,
          hormone_levels: hormoneLevels ?? null,
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
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const accessToken = authHeader.replace("Bearer ", "").trim();
  const { searchParams } = new URL(request.url);
  const chartNumber = searchParams.get("chartNumber");

  if (!chartNumber) {
    return NextResponse.json({ error: "chartNumber가 필요합니다." }, { status: 400 });
  }

  const supabase = createSupabaseServer(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "인증이 만료되었습니다." }, { status: 401 });
  }
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, chart_number, name, birth_date, sex, bone_age, hormone_levels")
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
      boneAge: patient.bone_age ?? null,
      hormoneLevels: patient.hormone_levels ?? null,
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
