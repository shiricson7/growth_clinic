import React, { useState } from 'react';
import { addVisit } from '@/app/actions';

interface DataEntryModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export function DataEntryModal({ onClose, onSuccess }: DataEntryModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);

        try {
            const result = await addVisit(formData);
            if (result.success) {
                if (onSuccess) onSuccess();
                onClose();
            } else {
                alert('저장 실패');
            }
        } catch (err) {
            console.error(err);
            alert('오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
            <div className="relative w-full max-w-[600px] flex flex-col rounded-2xl bg-white dark:bg-slate-800 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden transform transition-all scale-100 opacity-100">

                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700">
                    <div>
                        <h2 className="text-[#0c171c] dark:text-white text-[24px] font-bold leading-tight tracking-tight">성장 데이터 추가하기</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">아이의 키와 몸무게를 기록해주세요.</p>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="group flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <span className="material-symbols-outlined text-slate-500 dark:text-slate-300 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" style={{ fontSize: '24px' }}>close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1">
                    <div className="flex-1 overflow-y-auto max-h-[70vh] px-6 py-6 scrollbar-hide">
                        <div className="flex flex-col gap-6">

                            {/* Date Input */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[#0c171c] dark:text-slate-200 text-base font-medium leading-normal flex items-center gap-2">
                                    측정 날짜
                                </label>
                                <div className="relative flex w-full items-center">
                                    <input
                                        name="date"
                                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#0c171c] dark:text-white dark:bg-slate-900 focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-[#cddfe9] dark:border-slate-600 bg-slate-50 focus:border-primary h-14 placeholder:text-[#4680a0] px-[15px] text-base font-normal leading-normal transition-shadow"
                                        type="date"
                                        defaultValue={new Date().toISOString().split('T')[0]}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Visual Input Group: Height & Weight */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {/* Height Input */}
                                <div className="relative group/height p-1">
                                    <div className="absolute right-0 top-0 -mt-2 -mr-2 opacity-10 dark:opacity-20 pointer-events-none">
                                        <span className="material-symbols-outlined text-primary text-[80px] select-none">height</span>
                                    </div>
                                    <label className="relative z-10 text-[#0c171c] dark:text-slate-200 text-base font-medium leading-normal mb-2 block">
                                        키 (Height)
                                    </label>
                                    <div className="relative z-10 flex w-full items-center rounded-xl shadow-sm">
                                        <input
                                            name="height"
                                            className="form-input flex w-full min-w-0 flex-1 rounded-xl text-[#0c171c] dark:text-white dark:bg-slate-900 focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-[#cddfe9] dark:border-slate-600 bg-slate-50 focus:border-primary h-16 pl-[20px] pr-[50px] text-xl font-semibold leading-normal placeholder:text-slate-300 transition-all"
                                            placeholder="00.0"
                                            step="0.1"
                                            type="number"
                                            required
                                        />
                                        <div className="absolute right-0 top-0 h-full flex items-center justify-center px-4 rounded-r-xl bg-transparent">
                                            <span className="text-slate-500 dark:text-slate-400 font-medium select-none">cm</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Weight Input */}
                                <div className="relative group/weight p-1">
                                    <div className="absolute right-0 top-0 -mt-2 -mr-2 opacity-10 dark:opacity-20 pointer-events-none">
                                        <span className="material-symbols-outlined text-primary text-[70px] select-none">monitor_weight</span>
                                    </div>
                                    <label className="relative z-10 text-[#0c171c] dark:text-slate-200 text-base font-medium leading-normal mb-2 block">
                                        체중 (Weight)
                                    </label>
                                    <div className="relative z-10 flex w-full items-center rounded-xl shadow-sm">
                                        <input
                                            name="weight"
                                            className="form-input flex w-full min-w-0 flex-1 rounded-xl text-[#0c171c] dark:text-white dark:bg-slate-900 focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-[#cddfe9] dark:border-slate-600 bg-slate-50 focus:border-primary h-16 pl-[20px] pr-[50px] text-xl font-semibold leading-normal placeholder:text-slate-300 transition-all"
                                            placeholder="00.0"
                                            step="0.1"
                                            type="number"
                                        />
                                        <div className="absolute right-0 top-0 h-full flex items-center justify-center px-4 rounded-r-xl bg-transparent">
                                            <span className="text-slate-500 dark:text-slate-400 font-medium select-none">kg</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notes Input */}
                            <div className="flex flex-col min-w-40 flex-1">
                                <label className="text-[#0c171c] dark:text-slate-200 text-base font-medium leading-normal pb-2 flex items-center justify-between">
                                    메모
                                    <span className="text-xs text-slate-400 font-normal">선택사항</span>
                                </label>
                                <textarea
                                    name="note"
                                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#0c171c] dark:text-white dark:bg-slate-900 focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-[#cddfe9] dark:border-slate-600 bg-slate-50 focus:border-primary min-h-[120px] placeholder:text-[#4680a0]/60 p-[15px] text-base font-normal leading-normal transition-shadow"
                                    placeholder="특이사항이나 증상을 입력해주세요."
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-6 py-5 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-end items-center gap-3">
                        <button
                            onClick={onClose}
                            type="button"
                            className="px-6 py-3 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-8 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold shadow-lg shadow-primary/30 active:translate-y-0.5 transition-all focus:outline-none focus:ring-4 focus:ring-primary/20 flex items-center gap-2 disabled:opacity-70"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>check</span>
                            {isSubmitting ? '저장 중...' : '저장하기'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
