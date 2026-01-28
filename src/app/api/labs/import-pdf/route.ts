import { NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/labs/extract";
import { parseResultsFromText } from "@/lib/labs/parse";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "PDF 파일이 필요합니다." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractTextFromPdf(buffer);
    const parsed = parseResultsFromText(extracted.fullText);

    return NextResponse.json({
      collectedAt: parsed.collectedAt ?? null,
      results: parsed.results,
      method: extracted.method,
      rawText: extracted.fullText,
    });
  } catch (error) {
    return NextResponse.json({ error: "PDF 처리에 실패했습니다." }, { status: 500 });
  }
}
