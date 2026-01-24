export interface Patient {
    id: string;
    name: string;
    birthDate: string; // ISO Date
    sex: 1 | 2;
    imageUrl?: string;
}

export interface Visit {
    id: string;
    patientId: string;
    date: string; // ISO Date
    ageMonth: number;
    heightCm: number;
    weightKg?: number;
}

export const MOCK_PATIENT: Patient = {
    id: 'p1',
    name: '김지안',
    birthDate: '2024-01-15', // Approx 2 years ago
    sex: 1, // Male
};

export const MOCK_VISITS: Visit[] = [
    { id: 'v1', patientId: 'p1', date: '2024-01-15', ageMonth: 0, heightCm: 50.0 }, // Birth
    { id: 'v2', patientId: 'p1', date: '2024-07-15', ageMonth: 6, heightCm: 68.0 },
    { id: 'v3', patientId: 'p1', date: '2025-01-15', ageMonth: 12, heightCm: 76.0 },
    { id: 'v4', patientId: 'p1', date: '2025-07-15', ageMonth: 18, heightCm: 82.5 },
    { id: 'v5', patientId: 'p1', date: '2026-01-15', ageMonth: 24, heightCm: 87.5 }, // Recent
];
