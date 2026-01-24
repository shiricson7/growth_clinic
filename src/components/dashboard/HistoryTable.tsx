import React from 'react';
import { Visit } from '@/lib/data/mockData';
import { Download } from 'lucide-react';

interface HistoryTableProps {
    visits: Visit[];
}

export function HistoryTable({ visits }: HistoryTableProps) {
    // Sort by date desc
    const sortedVisits = [...visits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-800">방문 이력</h3>
                <button className="flex items-center gap-2 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors font-medium">
                    <Download size={16} />
                    PDF 다운로드
                </button>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0">
                        <tr>
                            <th className="px-4 py-3">방문일</th>
                            <th className="px-4 py-3">월령</th>
                            <th className="px-4 py-3 text-right">신장(cm)</th>
                            <th className="px-4 py-3 text-right">체중(kg)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {sortedVisits.map((visit) => (
                            <tr key={visit.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-gray-900">{visit.date}</td>
                                <td className="px-4 py-3 text-gray-600">{visit.ageMonth}개월</td>
                                <td className="px-4 py-3 text-right font-medium">{visit.heightCm}</td>
                                <td className="px-4 py-3 text-right text-gray-400">-</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
