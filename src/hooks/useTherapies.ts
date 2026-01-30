import { useState, useEffect } from "react";
import { TherapyCourse } from "@/lib/types";
import { saveTherapyCourses } from "@/lib/storage";
import { buildDemoTherapies } from "@/lib/demoData";

export const sortTherapies = (items: TherapyCourse[]) =>
    [...items].sort((a, b) =>
        a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0
    );

export function useTherapies(hydrated: boolean) {
    const [therapyCourses, setTherapyCourses] = useState<TherapyCourse[]>([]);

    useEffect(() => {
        if (!hydrated) return;
        saveTherapyCourses(therapyCourses);
    }, [therapyCourses, hydrated]);

    const handleAddTherapy = (course: TherapyCourse) => {
        setTherapyCourses((prev) => sortTherapies([...prev, course]));
    };

    const handleUpdateTherapy = (course: TherapyCourse) => {
        setTherapyCourses((prev) =>
            sortTherapies(prev.map((item) => (item.id === course.id ? course : item)))
        );
    };

    const handleDeleteTherapy = (id: string) => {
        setTherapyCourses((prev) => prev.filter((item) => item.id !== id));
    };

    return {
        therapyCourses,
        setTherapyCourses,
        handleAddTherapy,
        handleUpdateTherapy,
        handleDeleteTherapy,
    };
}
