'use server';

import fs from 'fs/promises';
import path from 'path';
import { Visit } from '@/lib/data/mockData';
import { revalidatePath } from 'next/cache';

const DB_PATH = path.join(process.cwd(), 'src/lib/data/visits.json');

export async function getVisits(): Promise<Visit[]> {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to read visits:', error);
        return [];
    }
}

export async function addVisit(formData: FormData) {
    const date = formData.get('date') as string;
    const height = parseFloat(formData.get('height') as string);
    const weight = parseFloat(formData.get('weight') as string);
    const note = formData.get('note') as string;

    if (!date || isNaN(height)) {
        throw new Error('Invalid input');
    }

    // Calculate Age Month based on Birth Date (2024-01-15)
    // Hardcoded patient P1 for now
    const birthDate = new Date('2024-01-15');
    const visitDate = new Date(date);

    // Calculate months diff
    let ageMonth = (visitDate.getFullYear() - birthDate.getFullYear()) * 12;
    ageMonth -= birthDate.getMonth();
    ageMonth += visitDate.getMonth();

    // Adjust for days (simplified)
    if (visitDate.getDate() < birthDate.getDate()) {
        ageMonth--;
    }
    // Allow decimal months roughly
    const dayDiff = (visitDate.getDate() - birthDate.getDate()) / 30;
    ageMonth += dayDiff;

    const newVisit: Visit = {
        id: `v${Date.now()}`,
        patientId: 'p1',
        date,
        ageMonth: Number(ageMonth.toFixed(1)),
        heightCm: height,
        weightKg: isNaN(weight) ? undefined : weight,
    };

    try {
        const visits = await getVisits();
        visits.push(newVisit);
        await fs.writeFile(DB_PATH, JSON.stringify(visits, null, 2));
        revalidatePath('/');
        return { success: true, visit: newVisit };
    } catch (error) {
        console.error('Failed to save visit:', error);
        return { success: false, error: 'Failed to save data' };
    }
}
