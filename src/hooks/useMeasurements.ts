import { useState, useEffect } from "react";
import { Measurement } from "@/lib/types";
import { saveMeasurements } from "@/lib/storage";
import { buildDemoMeasurements } from "@/lib/demoData";

export const sortMeasurements = (items: Measurement[]) =>
    [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

export function useMeasurements(hydrated: boolean) {
    const [measurements, setMeasurements] = useState<Measurement[]>([]);

    useEffect(() => {
        if (!hydrated) return;
        saveMeasurements(measurements);
    }, [measurements, hydrated]);

    const handleAddMeasurement = (measurement: Measurement) => {
        setMeasurements((prev) => sortMeasurements([...prev, measurement]));
    };

    const handleUpdateMeasurement = (measurement: Measurement) => {
        setMeasurements((prev) =>
            sortMeasurements(prev.map((item) => (item.id === measurement.id ? measurement : item)))
        );
    };

    const handleDeleteMeasurement = (id: string) => {
        setMeasurements((prev) => prev.filter((item) => item.id !== id));
    };

    const handleCsvImport = (items: Measurement[]) => {
        let added = 0;
        let updated = 0;
        const byDate = new Map<string, Measurement>();
        measurements.forEach((item) => byDate.set(item.date, item));
        items.forEach((item) => {
            const existing = byDate.get(item.date);
            if (existing) {
                byDate.set(item.date, {
                    ...existing,
                    heightCm: item.heightCm ?? existing.heightCm,
                    weightKg: item.weightKg ?? existing.weightKg,
                });
                updated += 1;
            } else {
                byDate.set(item.date, item);
                added += 1;
            }
        });
        setMeasurements(sortMeasurements(Array.from(byDate.values())));
        return { added, updated, skipped: items.length - added - updated };
    };

    return {
        measurements,
        setMeasurements,
        handleAddMeasurement,
        handleUpdateMeasurement,
        handleDeleteMeasurement,
        handleCsvImport,
    };
}
