import React, { useState } from 'react';
import { Visit } from '@/lib/data/mockData';
import { DataEntryModal } from './DataEntryModal';

interface VisitHistoryProps {
    visits: Visit[];
}

export function VisitHistory({ visits }: VisitHistoryProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const sortedVisits = [...visits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3); // Show top 3

    return (
        <>
            <div className="bg-white dark:bg-[#2a1d30] rounded-2xl shadow-sm border border-[#efe6f4] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[#efe6f4] flex justify-between items-center bg-[#faf8fc]">
                    <h4 className="font-bold text-[#170c1c]">방문 기록</h4>
                    <button className="text-primary text-xs font-bold hover:underline">전체 보기</button>
                </div>
                <div className="flex flex-col">
                    <div className="grid grid-cols-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        <div>날짜</div>
                        <div className="text-center">키</div>
                        <div className="text-right">체중</div>
                    </div>
                    {sortedVisits.map((visit) => (
                        <div key={visit.id} className="grid grid-cols-3 px-4 py-3 border-t border-gray-50 items-center hover:bg-gray-50 transition-colors">
                            <div className="text-sm font-medium text-[#170c1c]">
                                {new Date(visit.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                            </div>
                            <div className="text-sm text-center text-gray-600">{visit.heightCm}cm</div>
                            <div className="text-sm text-right text-gray-600">{visit.weightKg || '-'}kg</div>
                        </div>
                    ))}
                </div>

                {/* Add Button - Layout specific location */}
            </div>
            <button
                onClick={() => setIsModalOpen(true)}
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-4 px-6 flex items-center justify-center gap-3 shadow-lg shadow-primary/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-6"
            >
                <span className="material-symbols-outlined">add_circle</span>
                <span className="font-bold text-lg">+ 데이터 추가하기</span>
            </button>

            {isModalOpen && <DataEntryModal onClose={() => setIsModalOpen(false)} />}
        </>
    );
}
