import pdf from "pdf-parse";
import type { TextExtractionResult } from "./types";

const MIN_TEXT_LENGTH = 40;

async function extractTextWithOcr(buffer: Buffer): Promise<TextExtractionResult> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const { createWorker } = await import("tesseract.js");

  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdfDoc = await loadingTask.promise;
  const pages: string[] = [];
  const worker = (await createWorker()) as {
    recognize: (image: Buffer) => Promise<{ data: { text: string } }>;
    terminate: () => Promise<void>;
    loadLanguage?: (lang: string) => Promise<void>;
    initialize?: (lang: string) => Promise<void>;
  };
  if (worker.loadLanguage) {
    await worker.loadLanguage("eng+kor");
  }
  if (worker.initialize) {
    await worker.initialize("eng+kor");
  }

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context as any, viewport }).promise;
    const image = canvas.toBuffer("image/png");
    const {
      data: { text },
    } = await worker.recognize(image);
    pages.push(text.trim());
  }

  await worker.terminate();
  return {
    pages,
    fullText: pages.join("\n"),
    method: "ocr",
  };
}

export async function extractTextFromPdf(buffer: Buffer): Promise<TextExtractionResult> {
  const parsed = await pdf(buffer);
  const text = (parsed.text ?? "").trim();
  if (text.length >= MIN_TEXT_LENGTH) {
    const pages = text.split(/\f/).map((page) => page.trim()).filter(Boolean);
    return {
      pages: pages.length ? pages : [text],
      fullText: text,
      method: "pdf-text",
    };
  }

  return extractTextWithOcr(buffer);
}
