import { GROWTH_STANDARDS, GrowthStandard } from '@/lib/data/standards';
import type { Metric } from '@/lib/percentileLogic';
import { Visit } from '@/lib/data/mockData';
import { Audience, TREND_SUMMARY } from '@/lib/copy/uiCopy';

export type GrowthStatus = 'Danger' | 'Warning' | 'Normal';

export interface AnalyticResult {
    zScore: number | null;
    percentile: number | null;
    status: GrowthStatus;
    trendSummary: string;
}

export function useGrowthAnalytics() {
    const getStandard = (metric: Metric, sex: 1 | 2, ageMonth: number): GrowthStandard | undefined => {
        // Find exact match or interpolate? For this task, we'll try exact match or nearest.
        // Assuming monthly data is available. Round ageMonth to nearest integer?
        // User data might have decimals (e.g. 12.5 months).
        // The CSV typically has monthly rows.
        const roundedAge = Math.round(ageMonth);
        return GROWTH_STANDARDS[metric].find((s) => s.sex === sex && s.age_month === roundedAge);
    };

    const calculateZScore = (value: number, L: number, M: number, S: number): number => {
        if (L === 0) {
            return Math.log(value / M) / S;
        }
        return (Math.pow(value / M, L) - 1) / (L * S);
    };

    const getStatus = (zScore: number): GrowthStatus => {
        if (zScore < -2.0 || zScore > 2.0) return 'Danger';
        if ((zScore >= -2.0 && zScore < -1.0) || (zScore > 1.0 && zScore <= 2.0)) return 'Warning';
        return 'Normal';
    };

    const analyzeGrowth = (
        currentVisit: Visit,
        visits: Visit[],
        sex: 1 | 2,
        audience: Audience = 'guardian',
        metric: Metric = 'height'
    ): AnalyticResult => {
        const std = getStandard(metric, sex, currentVisit.ageMonth);
        if (!std) {
            return { zScore: null, percentile: null, status: 'Normal', trendSummary: TREND_SUMMARY.noStandard[audience] };
        }

        const value = metric === 'height' ? currentVisit.heightCm : currentVisit.weightKg;
        if (value === undefined || value === null) {
            return { zScore: null, percentile: null, status: 'Normal', trendSummary: TREND_SUMMARY.noStandard[audience] };
        }
        const z = calculateZScore(value, std.L, std.M, std.S);
        const status = getStatus(z);

        // Percentile approximation from Z-score (standard normal distribution)
        // Using a simple approximation or just not returning it if not requested strictly.
        // User requirement: "p3, p50, p97" are in CSV for *chart background*.
        // Requirement 2.1: "Z-score formula".
        // Requirement 3.B: Tooltip "88cm (상위 75%)". 
        // We can use a library or a helper for Z -> Percentile.
        const percentile = zScoreToPercentile(z);

        // Trend Analysis
        // Compare with data ~3 months ago.
        const threeMonthsAgo = currentVisit.ageMonth - 3;
        // Find visit closest to 3 months ago
        const pastVisit = visits.reduce((prev, curr) => {
            if (curr.id === currentVisit.id) return prev; // Skip current
            const prevDiff = Math.abs(prev.ageMonth - threeMonthsAgo);
            const currDiff = Math.abs(curr.ageMonth - threeMonthsAgo);
            return currDiff < prevDiff ? curr : prev;
        }, visits[0] === currentVisit && visits.length > 1 ? visits[1] : visits[0]);

        let trendSummary: string = TREND_SUMMARY.insufficient[audience];

        if (pastVisit && pastVisit.id !== currentVisit.id) {
            const pastStd = getStandard(metric, sex, pastVisit.ageMonth);
            if (pastStd) {
                const pastValue = metric === 'height' ? pastVisit.heightCm : pastVisit.weightKg;
                if (pastValue !== undefined && pastValue !== null) {
                    const pastZ = calculateZScore(pastValue, pastStd.L, pastStd.M, pastStd.S);
                    const zDiff = z - pastZ;

                    // Logic for "Acceleration", "Stagnation", "Decreasing"
                    // If Z-score distinctively increases -> Acceleration (catching up or overgrowing)
                    // If Z-score is stable -> Maintaining
                    // If Z-score drops -> "Stagnation" relative to curve (slowing down)

                    // Let's interpret the requested keywords:
                    // "가속" (Acceleration): Growth rate > standard (Z increases)
                    // "정체" (Stagnation): Growth rate < standard (Z decreases)
                    // "감소" (Decrease): Absolute height decreases (rare) or significant Z drop?
                    // "가속", "정체", "감소" keys.
                    // Usually "Stagnation" = Height didn't grow much, Z-score drops.

                    if (zDiff > 0.5) trendSummary = TREND_SUMMARY.faster[audience];
                    else if (zDiff < -0.5) trendSummary = TREND_SUMMARY.slower[audience];
                    else trendSummary = TREND_SUMMARY.stable[audience];
                }
            }
        }

        return {
            zScore: Number(z.toFixed(2)),
            percentile: Number(percentile.toFixed(1)),
            status,
            trendSummary
        };
    };

    return { analyzeGrowth };
}

function zScoreToPercentile(z: number): number {
    // Approximation of CDF of Normal Distribution
    if (z < -6.5) return 0.0;
    if (z > 6.5) return 100.0;

    const factK = 1;
    const sum = 0;
    const term = 1;
    const k = 0;

    // Error function approximation
    // Using a simpler one or `erf`.
    // Let's use a standard approximation.
    return (0.5 * (1 + erf(z / Math.sqrt(2)))) * 100;
}

function erf(x: number): number {
    // Save the sign of x
    var sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);

    // Constants
    var a1 = 0.254829592;
    var a2 = -0.284496736;
    var a3 = 1.421413741;
    var a4 = -1.453152027;
    var a5 = 1.061405429;
    var p = 0.3275911;

    // A&S formula 7.1.26
    var t = 1.0 / (1.0 + p * x);
    var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
}
