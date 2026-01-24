import React from 'react';
import { Patient } from '@/lib/data/mockData';
import { GrowthStatus } from '@/hooks/useGrowthAnalytics';
import { clsx } from 'clsx';

interface PatientCardProps {
    patient: Patient;
    latestStatus: GrowthStatus;
    latestHeight: number;
    latestAge: number;
    trendSummary: string;
}

export function PatientCard({ patient, latestStatus, latestHeight, latestAge, trendSummary }: PatientCardProps) {
    const statusConfig = {
        'Danger': { emoji: '🚨', color: 'border-red-500 bg-red-50 text-red-700', label: '위험' },
        'Warning': { emoji: '⚠️', color: 'border-yellow-400 bg-yellow-50 text-yellow-700', label: '주의' },
        'Normal': { emoji: '🟢', color: 'border-green-400 bg-green-50 text-green-700', label: '정상' }
    };

    const config = statusConfig[latestStatus];

    return (
        <div className={clsx("rounded-xl border-2 p-6 shadow-sm flex flex-col gap-4", config.color)}>
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-3xl">
                    {patient.sex === 1 ? '👦' : '👧'}
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{patient.name}</h2>
                    <p className="text-sm opacity-80">{patient.birthDate}생 ({latestAge}개월)</p>
                </div>
            </div>

            <div className="border-t border-black/10 pt-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">현재 상태</span>
                    <span className="text-2xl">{config.emoji}</span>
                </div>
                <div className="text-3xl font-bold mb-1">{latestHeight} cm</div>
                <div className="text-sm font-medium opacity-80">{trendSummary}</div>
            </div>
        </div>
    );
}
