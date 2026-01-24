import React from 'react';
import { AUDIENCE_LABELS, Audience } from '@/lib/copy/uiCopy';

interface HeaderProps {
    audience: Audience;
    onAudienceChange: (audience: Audience) => void;
}

export function Header({ audience, onAudienceChange }: HeaderProps) {
    return (
        <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-solid border-[#efe6f4] bg-[#faf8fc]/80 backdrop-blur-md px-6 py-3 lg:px-10">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-4 text-[#170c1c]">
                    <div className="size-8 text-primary flex items-center justify-center bg-primary/10 rounded-lg">
                        <span className="material-symbols-outlined text-2xl">child_care</span>
                    </div>
                    <h2 className="text-[#170c1c] text-lg font-bold leading-tight tracking-[-0.015em] hidden sm:block">소아 성장 분석</h2>
                </div>
                <nav className="hidden md:flex items-center gap-6">
                    <a className="text-primary font-semibold text-sm leading-normal" href="#">대시보드</a>
                    <a className="text-[#170c1c]/70 hover:text-primary transition-colors text-sm font-medium leading-normal" href="#">환자 관리</a>
                    <a className="text-[#170c1c]/70 hover:text-primary transition-colors text-sm font-medium leading-normal" href="#">예약 관리</a>
                    <a className="text-[#170c1c]/70 hover:text-primary transition-colors text-sm font-medium leading-normal" href="#">설정</a>
                </nav>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center rounded-full bg-[#efe6f4] p-1">
                    {(["guardian", "clinician"] as Audience[]).map((key) => (
                        <button
                            key={key}
                            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${audience === key
                                ? "bg-white text-primary shadow-sm"
                                : "text-[#8046a0] hover:text-[#170c1c]"
                                }`}
                            onClick={() => onAudienceChange(key)}
                            type="button"
                            aria-pressed={audience === key}
                        >
                            {AUDIENCE_LABELS[key]}
                        </button>
                    ))}
                </div>
                <div className="hidden sm:flex items-center bg-[#efe6f4] rounded-xl px-3 h-10 w-64 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <span className="material-symbols-outlined text-[#8046a0]">search</span>
                    <input className="bg-transparent border-none focus:ring-0 text-sm w-full text-[#170c1c] placeholder-[#8046a0]/70" placeholder="환자 검색..." />
                </div>
                <div
                    className="bg-center bg-no-repeat bg-cover rounded-full size-10 ring-2 ring-white shadow-sm"
                    style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAeRvcKfRAUCGV2rAjiMWBGE3-DO5_i_EygCZrI6F7qF-LKxNVB2kYl3Mvpr5k1GiSBIYIM3W55GpUXtPLTxkyYgdWvLFaFlxw2MhrlJX1zx_tn3sxYbRPNMlVGMv5Th4znbrya4bozf3lhD8xts6y9aqDZqIWX79hWFwG0_iqKH0aBrCYeCFMGgjeDioc-BE4pLx_lOEzYc4J0ZMYtluyxyJYyr3c6b3t1hbkHQFzI9nocfWgo-ivFJ3gZxRsPTeGLy0L0hXuvVg")' }}
                ></div>
            </div>
        </header>
    );
}
