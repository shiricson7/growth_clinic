export const normalizeHormoneLevels = (value: unknown): Record<string, string> => {
    if (!value) return {};
    if (typeof value === "object") {
        return value as Record<string, string>;
    }
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === "object") {
                return parsed as Record<string, string>;
            }
        } catch (error) {
            return {};
        }
    }
    return {};
};
