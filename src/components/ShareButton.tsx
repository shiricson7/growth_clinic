"use client";

import { useMemo, useState } from "react";
import { Download, Link2 } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";

export type SharePayload = {
  chartNumber: string;
  name: string;
  birthDate: string;
  sex: "male" | "female" | "";
  measurementDate: string;
  heightCm: string;
  weightKg: string;
  metric: "height" | "weight";
  percentile: number;
};

interface ShareButtonProps {
  reportRef: React.RefObject<HTMLDivElement | null>;
  payload: SharePayload;
}

const STORAGE_KEY = "growth-report-share";
const EXPIRATION_DAYS = 7;

function savePayload(payload: SharePayload) {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
  const existing = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  const data = existing ? JSON.parse(existing) : {};
  data[token] = { payload, expiresAt };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return token;
}

export function getSharedPayload(token: string): SharePayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const data = JSON.parse(raw);
  const entry = data[token];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    delete data[token];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return null;
  }
  return entry.payload as SharePayload;
}

export default function ShareButton({ reportRef, payload }: ShareButtonProps) {
  const [shareUrl, setShareUrl] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const disabled = useMemo(() => !payload.name || !payload.birthDate, [payload]);

  const handleExport = async () => {
    if (!reportRef.current) return;
    setStatus("이미지로 저장 중...");
    try {
      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `growth-report-${payload.name || "child"}.png`;
      link.click();
      setStatus("저장 완료!");
    } catch (error) {
      setStatus("저장에 실패했어요. 다시 시도해주세요.");
    }
  };

  const handleShare = () => {
    const token = savePayload(payload);
    const url = `${window.location.origin}?share=${token}`;
    setShareUrl(url);
    setStatus("공유 링크를 만들었습니다.");
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleExport} disabled={disabled}>
          <Download className="mr-2 h-4 w-4" />
          사진처럼 저장하기
        </Button>
        <Button variant="outline" onClick={handleShare} disabled={disabled}>
          <Link2 className="mr-2 h-4 w-4" />
          공유 링크 만들기
        </Button>
      </div>
      {status && <p className="text-xs text-[#64748b]">{status}</p>}
      {shareUrl && (
        <div className="rounded-xl bg-white/80 p-3 text-xs text-[#1a1c24]">
          <p className="break-all">{shareUrl}</p>
          <p className="mt-2 text-[11px] text-[#64748b]">
            공유 링크에는 주민등록번호가 포함되지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}
