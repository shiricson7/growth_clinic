'use client';

import React, { useMemo } from 'react';
import {
    ComposedChart,
    Line,
    Area,
    XAxis,
    Tooltip,
    ResponsiveContainer,
    YAxis
} from 'recharts';
import { GrowthStandard } from '@/lib/data/standards';
import { Visit } from '@/lib/data/mockData';
import { Audience, UI_COPY } from '@/lib/copy/uiCopy';

const formatAgeLabel = (rawMonths: number) => {
    const months = Math.round(rawMonths);
    if (months >= 60) {
        const years = Math.floor(months / 12);
        const remainder = months % 12;
        return remainder === 0 ? `${years}세` : `${years}세 ${remainder}개월`;
    }
    return `${months}개월`;
};

const buildAgeTicks = (maxAge: number) => {
    const step = 6;
    const end = Math.max(0, Math.round(maxAge));
    const ticks: number[] = [];
    for (let m = 0; m <= end; m += step) {
        ticks.push(m);
    }
    if (ticks[ticks.length - 1] !== end) {
        ticks.push(end);
    }
    return ticks;
};

interface GrowthChartProps {
    standards: GrowthStandard[];
    visits: Visit[];
    latestHeight: number;
    latestPercentile: number;
    latestAgeMonth: number;
    audience: Audience;
}

export function GrowthChart({ standards, visits, latestHeight, latestPercentile, latestAgeMonth, audience }: GrowthChartProps) {
    const copy = UI_COPY.growthChart;
    const maxAge = standards.length ? standards[standards.length - 1].age_month : 0;
    const ageTicks = buildAgeTicks(maxAge);
    const chartData = useMemo(() => {
        return standards.map((std) => {
            // Find visit for this month (approx) to plot the dots
            const visit = visits.find((v) => Math.round(v.ageMonth) === std.age_month);
            return {
                ...std,
                patientHeight: visit ? visit.heightCm : null,
            };
        });
    }, [standards, visits]);

    return (
        <div className="bg-white dark:bg-[#2a1d30] rounded-2xl shadow-sm border border-[#efe6f4] p-6 h-full flex flex-col">
            {/* Tabs */}
            <div className="flex justify-center mb-8">
                <div className="inline-flex bg-[#efe6f4] p-1.5 rounded-xl">
                    <button className="px-4 py-2 text-sm font-semibold rounded-lg bg-white text-primary shadow-sm transition-all">{copy.tabs.growth}</button>
                    <button className="px-4 py-2 text-sm font-medium rounded-lg text-[#8046a0] hover:text-[#170c1c] transition-all">{copy.tabs.bmi}</button>
                    <button className="px-4 py-2 text-sm font-medium rounded-lg text-[#8046a0] hover:text-[#170c1c] transition-all">{copy.tabs.velocity}</button>
                </div>
            </div>

            {/* Header Info */}
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                    <p className="text-sm font-medium text-gray-500">{copy.title[audience]}</p>
                    <h2 className="text-3xl font-bold text-[#170c1c]">{latestHeight} cm</h2>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <p className="text-xs text-gray-400 font-medium uppercase">{copy.ageLabel[audience]}</p>
                        <p className="text-sm font-bold text-primary">{formatAgeLabel(latestAgeMonth)}</p>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400 font-medium uppercase">{copy.percentileLabel[audience]}</p>
                        <p className="text-sm font-bold text-primary">상위 {100 - latestPercentile}%</p>
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            {/* Aspect Ratio container from design: aspect-[16/10] md:aspect-[2/1] */}
            <div className="relative w-full aspect-[16/10] md:aspect-[2/1] bg-white rounded-xl overflow-hidden mb-6 border border-gray-50">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 10, right: 0, left: 0, bottom: 0 }} // Minimal margins to fill container
                    >
                        <defs>
                            <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f3e8f7" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#f3e8f7" stopOpacity={0.4} />
                            </linearGradient>
                        </defs>

                        {/* Hidden YAxis to scale correctly but cleaner UI */}
                        <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />

                        <XAxis
                            dataKey="age_month"
                            tick={{ fontSize: 12, fill: '#9ca3af' }}
                            tickLine={false}
                            axisLine={false}
                            ticks={ageTicks}
                            interval={0}
                            minTickGap={14}
                            padding={{ left: 20, right: 20 }}
                            tickFormatter={formatAgeLabel}
                        />

                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const pHeight = data.patientHeight;
                                    // Custom Tooltip styling matching the design's floating badge
                                    return (
                                        <div className="bg-[#170c1c] text-white text-xs py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap z-10 relative">
                                            {formatAgeLabel(Number(label))}: {pHeight ? `${pHeight}cm` : '데이터 없음'}
                                            {/* Triangle arrow at bottom */}
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#170c1c] rotate-45"></div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                            cursor={{ stroke: '#d8b4fe', strokeWidth: 2, strokeDasharray: '4 4' }}
                        />

                        {/* P3-P97 Band */}
                        {/* 
                We want to shade between P97 and P3. 
                Recharts Area 'fill' goes from line to baseline (0). 
                To act as a band, we can stack or use `stackId` quirks, but easier: 
                Draw area for P97 (Grey), then draw area for P3 (White) on top? 
                Or better: P97 area with a 'baseValue' if possible? 
                Actually, standard trick: Area for P97 filled. Area for P3 filled with WHITE (bg color) to mask the bottom.
            */}
                        <Area
                            type="monotone"
                            dataKey="p97"
                            stroke="none"
                            fill="url(#bandGradient)"
                            isAnimationActive={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="p3"
                            stroke="none"
                            fill="#ffffff"
                            isAnimationActive={false}
                        />

                        {/* Median Line */}
                        <Line
                            type="monotone"
                            dataKey="p50"
                            stroke="#d8b4fe"
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            dot={false}
                            activeDot={false}
                        />

                        {/* Patient Data Line */}
                        <Line
                            type="monotone"
                            dataKey="patientHeight"
                            stroke="#8702cf"
                            strokeWidth={3}
                            dot={{ r: 4, fill: "white", stroke: "#8702cf", strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: "#8702cf", stroke: "white", strokeWidth: 2 }}
                            connectNulls
                            animationDuration={1500}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Legend / Status Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-auto">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="text-sm text-gray-600">정상</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    <span className="text-sm text-gray-600">주의</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                    <span className="text-sm text-gray-600">위험</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-1 rounded-full bg-primary"></span>
                    <span className="text-sm font-medium text-primary">{copy.legendTrend[audience]}</span>
                </div>
            </div>
        </div>
    );
}
