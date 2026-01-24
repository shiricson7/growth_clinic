import React from 'react';
import { Audience, UI_COPY } from '@/lib/copy/uiCopy';

interface GrowthStatsProps {
    heightVelocity: number; // e.g., 2.1
    bmi: number; // e.g., 16.2
    audience: Audience;
}

export function GrowthStats({ heightVelocity, bmi, audience }: GrowthStatsProps) {
    const copy = UI_COPY.growthStats;
    return (
        <div className="flex flex-col gap-4">
            {/* Height Velocity Card */}
            <div className="bg-white dark:bg-[#2a1d30] rounded-2xl p-5 shadow-sm border-l-4 border-emerald-500 flex flex-col gap-1 relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[#170c1c] text-sm font-semibold opacity-70">{copy.heightLabel[audience]}</p>
                    <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-md">trending_up</span>
                </div>
                <p className="text-[#170c1c] text-2xl font-bold leading-tight">+{heightVelocity} cm</p>
                <p className="text-emerald-600 text-xs font-medium bg-emerald-50 w-fit px-2 py-0.5 rounded-full mt-1">{copy.heightBadge[audience]}</p>
            </div>

            {/* BMI Card */}
            <div className="bg-white dark:bg-[#2a1d30] rounded-2xl p-5 shadow-sm border-l-4 border-blue-500 flex flex-col gap-1">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[#170c1c] text-sm font-semibold opacity-70">{copy.bmiLabel[audience]}</p>
                    <span className="material-symbols-outlined text-blue-500 bg-blue-50 p-1 rounded-md">monitor_weight</span>
                </div>
                <p className="text-[#170c1c] text-2xl font-bold leading-tight">{bmi}</p>
                <p className="text-blue-600 text-xs font-medium bg-blue-50 w-fit px-2 py-0.5 rounded-full mt-1">{copy.bmiBadge[audience]}</p>
            </div>

            {/* Nutrition Check Card (Static for now as requested by user logic scope not covering nutrition fully yet) */}
            <div className="bg-white dark:bg-[#2a1d30] rounded-2xl p-5 shadow-sm border-l-4 border-amber-500 flex flex-col gap-1">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[#170c1c] text-sm font-semibold opacity-70">{copy.nutritionLabel[audience]}</p>
                    <span className="animate-pulse material-symbols-outlined text-amber-500 bg-amber-50 p-1 rounded-md">priority_high</span>
                </div>
                <p className="text-[#170c1c] text-lg font-bold leading-tight">{copy.nutritionMain[audience]}</p>
                <p className="text-amber-700 text-xs font-medium bg-amber-50 w-fit px-2 py-0.5 rounded-full mt-1">{copy.nutritionBadge[audience]}</p>
            </div>
        </div>
    );
}
