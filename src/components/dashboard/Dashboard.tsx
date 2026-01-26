'use client';

import React, { useState, useEffect } from 'react';
import { MOCK_PATIENT } from '@/lib/data/mockData';
import { Visit } from '@/lib/data/mockData';
import { GROWTH_STANDARDS } from '@/lib/data/standards';
import { useGrowthAnalytics } from '@/hooks/useGrowthAnalytics';
import { Audience, UI_COPY } from '@/lib/copy/uiCopy';

// Components
import { Header } from '@/components/layout/Header';
import { PatientProfile } from '@/components/dashboard/PatientProfile';
import { GrowthStats } from '@/components/dashboard/GrowthStats';
import { GrowthChart } from '@/components/dashboard/GrowthChart';
import { DoctorAdvice } from '@/components/dashboard/DoctorAdvice';
import { VisitHistory } from '@/components/dashboard/VisitHistory';

interface DashboardProps {
    initialVisits: Visit[];
}

export default function Dashboard({ initialVisits }: DashboardProps) {
    const { analyzeGrowth } = useGrowthAnalytics();
    const [audience, setAudience] = useState<Audience>('guardian');

    // Local state to handle updates without full page refresh if we want, 
    // though Next.js revalidatePath handles it mostly. 
    // We'll sync with props.
    const [visits, setVisits] = useState<Visit[]>(initialVisits);

    useEffect(() => {
        setVisits(initialVisits);
    }, [initialVisits]);

    // Data Preparation
    const sortedVisits = [...visits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latestVisit = sortedVisits[0];
    const previousVisit = sortedVisits[1];

    // Logic
    const analysis = latestVisit
        ? analyzeGrowth(latestVisit, sortedVisits, MOCK_PATIENT.sex, audience)
        : null;

    // Placeholder calculations
    const heightParams = {
        velocity: previousVisit ? (latestVisit.heightCm - previousVisit.heightCm).toFixed(1) : '0.0',
        bmi: latestVisit.weightKg ? (latestVisit.weightKg / Math.pow(latestVisit.heightCm / 100, 2)).toFixed(1) : '16.2'
    };

    if (!latestVisit || !analysis) {
        return (
            <div className="p-8 text-sm text-gray-500">
                {UI_COPY.dashboard.noData[audience]}
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen text-[#170c1c] font-display">
            <Header audience={audience} onAudienceChange={setAudience} />

            <main className="layout-container flex flex-col max-w-[1400px] mx-auto p-4 lg:p-6 gap-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* Left Column */}
                    <div className="lg:col-span-3 flex flex-col gap-6">
                        <PatientProfile
                            patient={MOCK_PATIENT}
                            ageMonth={Math.round(latestVisit.ageMonth)}
                        />
                        <GrowthStats
                            heightVelocity={Number(heightParams.velocity)}
                            bmi={Number(heightParams.bmi)}
                            audience={audience}
                        />
                    </div>

                    {/* Center Column */}
                    <div className="lg:col-span-6 flex flex-col gap-6 h-full">
                        <GrowthChart
                            standards={GROWTH_STANDARDS.height}
                            visits={visits}
                            latestHeight={latestVisit.heightCm}
                            latestPercentile={analysis.percentile || 50}
                            latestAgeMonth={Math.round(latestVisit.ageMonth)}
                            audience={audience}
                        />
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-3 flex flex-col gap-6">
                        <DoctorAdvice audience={audience} />
                        <VisitHistory visits={visits} />
                    </div>

                </div>
            </main>
        </div>
    );
}
