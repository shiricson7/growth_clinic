import React from 'react';
import { Patient } from '@/lib/data/mockData';

interface PatientProfileProps {
    patient: Patient;
    ageMonth: number;
}

export function PatientProfile({ patient, ageMonth }: PatientProfileProps) {
    return (
        <div className="bg-white dark:bg-[#2a1d30] rounded-2xl p-6 shadow-sm flex flex-col items-center border border-[#efe6f4]">
            <div className="relative group cursor-pointer">
                <div
                    className="bg-center bg-no-repeat bg-cover rounded-full size-32 shadow-md mb-4"
                    style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBGsJSYYDRDKkMwOZYlnMTWvUvjuJmox6v4-1KRZoqEDJ5ElkqATk1JELgapWbufATGrvF_ZNw8sj8PBnafWG95LeSdbWCHvUPxyCU3sz-eUAKiB93tFk0ni433pbXV1fQpZKcJ7HhIowjryVXisveouULBHMpOnKTVZdjBetETW-uUxh6Fb9HzDesX0F72wZ04gUWau6jw-BoExBc007ockOV7h2hrjrUpHDFQsz9n54L0_lo4-EGjjt1pHL0C3Ot38NhwxTkYag")' }}
                ></div>
                <div className="absolute bottom-4 right-2 bg-white rounded-full p-1.5 shadow-md flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-sm">edit</span>
                </div>
            </div>
            <h3 className="text-xl font-bold text-[#170c1c] mb-1">{patient.name}</h3>
            <p className="text-[#8046a0] font-medium bg-[#efe6f4] px-3 py-1 rounded-full text-sm mb-6">
                {patient.sex === 1 ? '남아' : '여아'}, {ageMonth}개월
            </p>
            <button className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-transparent border border-[#efe6f4] hover:bg-[#faf8fc] hover:border-primary/30 text-[#170c1c] text-sm font-semibold rounded-xl transition-all">
                <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                프로필 수정
            </button>
        </div>
    );
}
