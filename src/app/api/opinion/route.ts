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

type OpinionRequest = {
  birthDate: string;
  sex: "male" | "female" | "";
  measurements: MeasurementInput[];
  therapyCourses?: TherapyCourseInput[];
};

type OpinionResult = {
  text: string;
  debugReason?: string;
};

const PROMPT = `You are a pediatric endocrinologist specializing in growth disorders.
IMPORTANT:
- All outputs MUST be written in Korean.
- Do NOT use English in the output.
- Use clear, natural Korean suitable for medical reports in Korea.

You are given longitudinal growth data of a child, including:
- Measurement dates
- Height (cm)
- Weight (kg)
- Optional: growth hormone (GH) treatment start date and duration

Your task is to analyze the data and explain:

1. Overall growth status
   - Is the child growing appropriately for age?
   - Is height increasing steadily over time?
   - Is weight gain appropriate relative to height?

2. Growth velocity
   - Evaluate height velocity before and after growth hormone treatment (if applicable)
   - Comment on whether the growth velocity is adequate, improved, or insufficient

3. Effect of growth hormone treatment (if used)
   - Compare growth pattern before vs after treatment
   - State whether the response to growth hormone appears good, suboptimal, or unclear
   - Mention expected patterns of response in early vs later phases of treatment

4. Balance between height and weight
   - Assess whether weight gain is proportional to height gain
   - Comment on risks of underweight or overweight if applicable

5. Clinical interpretation
   - Summarize whether current growth is reassuring or needs closer monitoring
   - Mention possible reasons if growth response is slower than expected
   - Clearly state if continuation of current management is reasonable

6. Parent-friendly explanation
   - Explain the findings in simple, reassuring language
   - Avoid medical jargon
   - Use short sentences suitable for parents
   - Focus on “trend over time” rather than single measurements

Important rules:
- Do NOT diagnose diseases
- Do NOT provide medication dosage
- Do NOT make definitive medical decisions
- Base all explanations strictly on the provided data
- If data is insufficient, clearly state what is missing
- The last sentence MUST be complete and end with proper Korean punctuation (e.g., "입니다.", "하세요.").
- Keep the total length concise (about 10–14 lines) to avoid cut-off.

Output format:

[Doctor’s Summary]
- (Concise, clinical interpretation in professional tone)

[Growth Trend Analysis]
- Height trend:
- Weight trend:
- Growth velocity:

[Growth Hormone Treatment Assessment] (only if applicable)
- Pre-treatment growth:
- Post-treatment growth:
- Overall response:

[Parent Explanation]
- (Warm, easy-to-understand explanation in plain language)

Use a calm, professional, and reassuring tone.`;

const buildFallbackText = (hasGh: boolean) => {
  const sections = [
    "[Doctor’s Summary]",
    "- 현재 제공된 정보로는 성장 추이를 일부만 해석할 수 있습니다.",
    "",
    "[Growth Trend Analysis]",
    "- Height trend: 입력된 키 측정값의 변화가 필요합니다.",
    "- Weight trend: 입력된 몸무게 측정값의 변화가 필요합니다.",
    "- Growth velocity: 측정 간격과 연속 데이터가 더 필요합니다.",
  ];

  if (hasGh) {
    sections.push(
      "",
      "[Growth Hormone Treatment Assessment]",
      "- Pre-treatment growth: 치료 전 데이터가 충분하지 않습니다.",
      "- Post-treatment growth: 치료 후 데이터가 충분하지 않습니다.",
      "- Overall response: 현재 정보로는 판단이 어렵습니다."
    );
  }

  sections.push(
    "",
    "[Parent Explanation]",
    "- 아직 기록이 적어 성장 흐름을 정확히 보기 어렵습니다.",
    "- 키와 몸무게를 일정 간격으로 추가 기록해 주세요.",
    "- 데이터가 모이면 더 명확한 설명을 드릴 수 있습니다."
  );

  return sections.join("\n");
};

const fallbackWithReason = (reason: string, hasGh: boolean): OpinionResult => ({
  text: buildFallbackText(hasGh),
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
      doseNote: course.doseNote ?? null,
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

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(fallbackWithReason("api_key_missing", false), { status: 500 });
    }

    const body = (await request.json()) as OpinionRequest;
    const hasGh = Array.isArray(body?.therapyCourses)
      ? body.therapyCourses.some((course) => course.drug === "GH")
      : false;

    if (!body?.birthDate || !Array.isArray(body.measurements)) {
      return NextResponse.json(fallbackWithReason("invalid_payload", hasGh), { status: 400 });
    }

    const points = sanitizeMeasurements(body.birthDate, body.measurements);
    if (points.length === 0) {
      return NextResponse.json(fallbackWithReason("no_measurements", hasGh));
    }

    const latest = points[points.length - 1];
    const latestHeight = pickLatestWithMetric(points, "heightCm");
    const latestWeight = pickLatestWithMetric(points, "weightKg");

    const heightPercentile =
      latestHeight && latestHeight.heightCm !== null
        ? percentileFromValue("height", body.sex, latestHeight.ageMonths, latestHeight.heightCm)
        : null;
    const weightPercentile =
      latestWeight && latestWeight.weightKg !== null
        ? percentileFromValue("weight", body.sex, latestWeight.ageMonths, latestWeight.weightKg)
        : null;

    const therapyCourses = normalizeTherapies(body.therapyCourses ?? []);

    const promptPayload = {
      birthDate: body.birthDate,
      sex: body.sex,
      latest,
      heightPercentile,
      weightPercentile,
      measurements: points,
      therapyCourses,
    };

    const requestBody = {
      model: "gpt-5-mini",
      max_output_tokens: 1200,
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
      return NextResponse.json(
        fallbackWithReason(`openai_http_${response.status}${detail}`, hasGh)
      );
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
          `openai_empty_response:output_count=${extracted.outputCount};types=${extracted.outputTypes}${status}`,
          hasGh
        )
      );
    }
    if (extracted.refusal) {
      return NextResponse.json(fallbackWithReason(`openai_refusal:${extracted.refusal}`, hasGh));
    }

    return NextResponse.json({ text: outputText });
  } catch (error) {
    return NextResponse.json(fallbackWithReason("exception", false));
  }
}
