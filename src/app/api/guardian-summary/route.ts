import { NextResponse } from "next/server";
import { getAgeMonths, percentileFromValue } from "@/lib/percentileLogic";

type MeasurementInput = {
  measurementDate: string;
  heightCm?: number | null;
  weightKg?: number | null;
};

type TherapyCourseInput = {
  drug: "GH" | "GNRH";
  startDate: string;
  endDate?: string | null;
  productName?: string | null;
  doseNote?: string | null;
  note?: string | null;
};

type SummaryRequest = {
  birthDate: string;
  sex: "male" | "female" | "";
  measurements: MeasurementInput[];
  therapyCourses?: TherapyCourseInput[];
  boneAge?: string;
  hormoneLevels?: string;
};

type SummaryResult = {
  text: string;
  debugReason?: string;
};

const PROMPT = `당신은 소아 성장 상담을 담당하는 의사입니다.
IMPORTANT:
- 모든 출력은 한국어로 작성하세요.
- 어려운 의학 용어는 피하고 보호자가 이해하기 쉬운 표현을 사용하세요.
- 영어는 사용하지 마세요.
- 분량은 A4 한 장 요약 기준으로 10~14줄 이내로 간결하게 작성하세요.

추가 정보:
- 골연령이나 호르몬 수치가 제공되면 참고하되, 이해하기 쉬운 말로 설명하세요.

입력된 데이터는 아이의 성장 측정 기록과 치료 기간 정보입니다.
해야 할 일:
1) 현재 성장 흐름을 쉬운 말로 요약
2) 키와 몸무게의 균형을 간단히 설명
3) 치료가 있었다면 치료 전후 변화를 쉽게 설명
4) 보호자가 알아두면 좋은 다음 관찰 포인트를 2~3가지 제시

규칙:
- 진단하지 말 것
- 약 용량/처방을 말하지 말 것
- 확정적인 의학적 결론을 내리지 말 것
- 데이터가 부족하면 부족한 점을 분명히 말할 것

출력 형식:
[요약]
- ...

[변화 흐름]
- ...

[보호자 안내]
- ...

간결하고 따뜻한 톤으로 작성하세요.`;

const fallbackWithReason = (reason: string): SummaryResult => ({
  text:
    "[요약]\n- 성장 요약을 생성하기 위한 정보가 부족합니다.\n\n[변화 흐름]\n- 측정 기록이 더 필요합니다.\n\n[보호자 안내]\n- 키와 몸무게를 일정 간격으로 기록해 주세요.",
  debugReason: reason,
});

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function sanitizeMeasurements(birthDate: string, measurements: MeasurementInput[]) {
  return measurements
    .map((item) => {
      const height = parseNumber(item.heightCm);
      const weight = parseNumber(item.weightKg);
      if (!item.measurementDate || (height === null && weight === null)) return null;
      const ageMonths = getAgeMonths(birthDate, item.measurementDate);
      return {
        measurementDate: item.measurementDate,
        ageMonths,
        heightCm: height,
        weightKg: weight,
      };
    })
    .filter(
      (item): item is {
        measurementDate: string;
        ageMonths: number;
        heightCm: number | null;
        weightKg: number | null;
      } => Boolean(item)
    )
    .sort((a, b) => (a.measurementDate < b.measurementDate ? -1 : 1));
}

function normalizeTherapies(courses: TherapyCourseInput[] = []) {
  return courses
    .filter((course) => course.startDate)
    .map((course) => ({
      drug: course.drug,
      startDate: course.startDate,
      endDate: course.endDate ?? null,
      productName: course.productName ?? null,
      note: course.note ?? null,
    }))
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
}

function pickLatestWithMetric<T extends { heightCm: number | null; weightKg: number | null }>(
  points: T[],
  metric: "heightCm" | "weightKg"
) {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i][metric] !== null) return points[i];
  }
  return null;
}

function pickPrevWithMetric<T extends { heightCm: number | null; weightKg: number | null }>(
  points: T[],
  metric: "heightCm" | "weightKg"
) {
  let foundCurrent = false;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i][metric] !== null) {
      if (!foundCurrent) {
        foundCurrent = true;
      } else {
        return points[i];
      }
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(fallbackWithReason("api_key_missing"), { status: 500 });
    }

    const body = (await request.json()) as SummaryRequest;
    if (!body?.birthDate || !Array.isArray(body.measurements)) {
      return NextResponse.json(fallbackWithReason("invalid_payload"), { status: 400 });
    }

    const points = sanitizeMeasurements(body.birthDate, body.measurements);
    if (points.length === 0) {
      return NextResponse.json(fallbackWithReason("no_measurements"));
    }

    const latest = points[points.length - 1];
    const latestHeight = pickLatestWithMetric(points, "heightCm");
    const prevHeight = pickPrevWithMetric(points, "heightCm");
    const latestWeight = pickLatestWithMetric(points, "weightKg");
    const prevWeight = pickPrevWithMetric(points, "weightKg");

    const heightDelta =
      latestHeight && prevHeight
        ? {
            deltaCm: Number((latestHeight.heightCm! - prevHeight.heightCm!).toFixed(2)),
            deltaMonths: Number((latestHeight.ageMonths - prevHeight.ageMonths).toFixed(1)),
          }
        : null;

    const weightDelta =
      latestWeight && prevWeight
        ? {
            deltaKg: Number((latestWeight.weightKg! - prevWeight.weightKg!).toFixed(2)),
            deltaMonths: Number((latestWeight.ageMonths - prevWeight.ageMonths).toFixed(1)),
          }
        : null;

    const heightPercentile =
      latestHeight && latestHeight.heightCm !== null
        ? percentileFromValue("height", body.sex, latestHeight.ageMonths, latestHeight.heightCm)
        : null;
    const weightPercentile =
      latestWeight && latestWeight.weightKg !== null
        ? percentileFromValue("weight", body.sex, latestWeight.ageMonths, latestWeight.weightKg)
        : null;

    const therapyCourses = normalizeTherapies(body.therapyCourses ?? []);

    let hormonePayload: string | Record<string, string> | null = null;
    if (typeof body.hormoneLevels === "string") {
      hormonePayload = body.hormoneLevels.trim() ? body.hormoneLevels.trim() : null;
    } else if (body.hormoneLevels && typeof body.hormoneLevels === "object") {
      const mapped: Record<string, string> = {};
      Object.entries(body.hormoneLevels).forEach(([key, value]) => {
        if (!value || !value.trim()) return;
        const label =
          key === "IGF_BP3"
            ? "IGF-BP3"
            : key === "IGF_1"
            ? "IGF-1"
            : key;
        mapped[label] = value.trim();
      });
      hormonePayload = Object.keys(mapped).length ? mapped : null;
    }

    const promptPayload = {
      birthDate: body.birthDate,
      sex: body.sex,
      boneAge: body.boneAge ?? null,
      hormoneLevels: hormonePayload,
      latest,
      heightPercentile,
      weightPercentile,
      heightDelta,
      weightDelta,
      measurements: points,
      therapyCourses,
    };

    const requestBody = {
      model: "gpt-5-mini",
      max_output_tokens: 450,
      reasoning: { effort: "minimal" },
      instructions: PROMPT,
      input: JSON.stringify(promptPayload),
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let detail = "";
      try {
        const errorBody = await response.json();
        const errorMsg = errorBody?.error?.message;
        const errorCode = errorBody?.error?.code;
        detail = errorMsg ? `:${errorMsg}${errorCode ? `(${errorCode})` : ""}` : "";
      } catch (error) {
        detail = "";
      }
      return NextResponse.json(fallbackWithReason(`openai_http_${response.status}${detail}`));
    }

    const extractOutput = (payload: any) => {
      const direct = typeof payload?.output_text === "string" ? payload.output_text : null;
      const outputs = Array.isArray(payload?.output) ? payload.output : [];
      let refusal: string | null = null;
      let extracted: string | null = null;
      for (const item of outputs) {
        const contents = Array.isArray(item?.content) ? item.content : [];
        for (const part of contents) {
          if (part?.type === "output_text" && typeof part.text === "string") {
            extracted = part.text;
          }
          if (part?.type === "refusal" && typeof part.refusal === "string") {
            refusal = part.refusal;
          }
        }
      }
      const outputCount = outputs.length;
      const outputTypes = outputs.map((item: { type?: string }) => item?.type ?? "unknown").join(",");
      return {
        outputText: direct ?? extracted,
        refusal,
        outputCount,
        outputTypes: outputTypes || "none",
        status: typeof payload?.status === "string" ? payload.status : null,
        id: typeof payload?.id === "string" ? payload.id : null,
      };
    };

    let data = await response.json();
    let extracted = extractOutput(data);
    let outputText = extracted.outputText;

    if (!outputText && extracted.id && extracted.status === "incomplete") {
      const maxAttempts = 30;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const followUp = await fetch(`https://api.openai.com/v1/responses/${extracted.id}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });
        if (!followUp.ok) continue;
        data = await followUp.json();
        extracted = extractOutput(data);
        outputText = extracted.outputText;
        if (outputText || extracted.status !== "incomplete") break;
      }
    }

    if (!outputText) {
      const status = extracted.status ? `;status=${extracted.status}` : "";
      return NextResponse.json(
        fallbackWithReason(
          `openai_empty_response:output_count=${extracted.outputCount};types=${extracted.outputTypes}${status}`
        )
      );
    }
    if (extracted.refusal) {
      return NextResponse.json(fallbackWithReason(`openai_refusal:${extracted.refusal}`));
    }

    return NextResponse.json({ text: outputText });
  } catch (error) {
    return NextResponse.json(fallbackWithReason("exception"));
  }
}
