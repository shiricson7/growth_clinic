import React from 'react';
import { Audience, UI_COPY } from '@/lib/copy/uiCopy';

interface DoctorAdviceProps {
    audience: Audience;
}

export function DoctorAdvice({ audience }: DoctorAdviceProps) {
    const copy = UI_COPY.doctorAdvice;
    return (
        <div className="bg-gradient-to-br from-white to-blue-50 dark:from-[#2a1d30] dark:to-blue-900/10 rounded-2xl p-6 shadow-sm border border-blue-100 relative">
            <div className="absolute -top-3 left-6 bg-blue-100 text-blue-600 p-2 rounded-xl shadow-sm">
                <span className="material-symbols-outlined">stethoscope</span>
            </div>
            <div className="mt-4">
                <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-2">{copy.heading[audience]}</h4>
                <p className="text-[#170c1c] text-sm leading-relaxed">
                    {copy.body[audience]}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-blue-600/70 font-medium">
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    {copy.updatedAt[audience]}
                </div>
            </div>
        </div>
    );
}
