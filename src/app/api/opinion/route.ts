import { NextResponse } from "next/server";
import { getAgeMonths, percentileFromValue } from "@/lib/percentileLogic";

type MeasurementInput = {
  measurementDate: string;
  heightCm?: number | null;
  weightKg?: number | null;
};

type OpinionRequest = {
  birthDate: string;
  sex: "male" | "female" | "";
  measurements: MeasurementInput[];
};

type OpinionResult = {
  title: string;
  message: string;
  severity: "calm" | "watch" | "encourage";
  debugReason?: string;
};

const FALLBACK: OpinionResult = {
  title: "기록을 함께 살펴보세요",
  message:
    "현재 입력된 성장 기록을 바탕으로 분석 중입니다. 추적 가능한 기록이 더 쌓이면 더 정확한 의견을 드릴게요.",
  severity: "calm",
};

const fallbackWithReason = (reason: string) => ({
  ...FALLBACK,
  debugReason: reason,
});

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function sanitizeMeasurements(
  birthDate: string,
  measurements: MeasurementInput[]
) {
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

    const body = (await request.json()) as OpinionRequest;
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
            deltaMonths: Number(
              (latestHeight.ageMonths - prevHeight.ageMonths).toFixed(1)
            ),
          }
        : null;

    const weightDelta =
      latestWeight && prevWeight
        ? {
            deltaKg: Number((latestWeight.weightKg! - prevWeight.weightKg!).toFixed(2)),
            deltaMonths: Number(
              (latestWeight.ageMonths - prevWeight.ageMonths).toFixed(1)
            ),
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

    const promptPayload = {
      birthDate: body.birthDate,
      sex: body.sex,
      latest,
      heightPercentile,
      weightPercentile,
      heightDelta,
      weightDelta,
      measurements: points,
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        max_output_tokens: 220,
        instructions:
          "너는 소아 성장전문가다. 제공된 데이터만 사용해서 보호자에게 전달하듯 짧고 정확하게 한국어로 설명한다. 진단이나 단정 대신 관찰과 다음 확인 포인트를 제안한다. 2~4문장으로 작성하고, 반드시 JSON 형식으로만 응답한다.",
        input: `다음 성장 기록을 분석해 주세요. JSON 형식: {\"title\":\"...\",\"message\":\"...\",\"severity\":\"calm|watch|encourage\"}. 데이터: ${JSON.stringify(
          promptPayload
        )}`,
        text: { format: { type: "json_object" } },
      }),
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
      return NextResponse.json(
        fallbackWithReason(`openai_http_${response.status}${detail}`)
      );
    }

    const data = await response.json();
    const directOutput =
      typeof data?.output_text === "string" ? data.output_text : null;
    const extracted = (() => {
      const outputs = Array.isArray(data?.output) ? data.output : [];
      for (const item of outputs) {
        const contents = Array.isArray(item?.content) ? item.content : [];
        for (const part of contents) {
          if (part?.type === "output_text" && typeof part.text === "string") {
            return part.text;
          }
          if (part?.type === "refusal" && typeof part.refusal === "string") {
            return `__REFUSAL__:${part.refusal}`;
          }
        }
      }
      return null;
    })();

    const outputText = directOutput ?? extracted;
    if (!outputText) {
      const outputCount = Array.isArray(data?.output) ? data.output.length : 0;
      const outputTypes = Array.isArray(data?.output)
        ? data.output.map((item: { type?: string }) => item?.type ?? "unknown").join(",")
        : "none";
      return NextResponse.json(
        fallbackWithReason(
          `openai_empty_response:output_count=${outputCount};types=${outputTypes}`
        )
      );
    }
    if (outputText.startsWith("__REFUSAL__:")) {
      return NextResponse.json(
        fallbackWithReason(`openai_refusal:${outputText.replace("__REFUSAL__:", "")}`)
      );
    }

    let parsed: OpinionResult;
    try {
      parsed = JSON.parse(outputText) as OpinionResult;
    } catch (error) {
      return NextResponse.json(fallbackWithReason("openai_invalid_json"));
    }
    if (!parsed?.title || !parsed?.message || !parsed?.severity) {
      return NextResponse.json(fallbackWithReason("openai_invalid_fields"));
    }

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(fallbackWithReason("exception"));
  }
}
