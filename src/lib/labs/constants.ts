import { HormoneLevels } from "@/lib/types";
import { NormalizedTestKey } from "./types";

export const LAB_KEY_TO_HORMONE: Record<NormalizedTestKey, keyof HormoneLevels> = {
    hba1c: "HbA1c",
    ft4: "fT4",
    tsh: "TSH",
    lh: "LH",
    fsh: "FSH",
    testosterone: "Testosterone",
    estradiol: "E2",
    igfbp3: "IGF_BP3",
    igf1: "IGF_1",
    dhea: "DHEA",
};

export const LAB_HORMONE_TO_KEY: Partial<Record<keyof HormoneLevels, NormalizedTestKey>> = {
    HbA1c: "hba1c",
    fT4: "ft4",
    TSH: "tsh",
    LH: "lh",
    FSH: "fsh",
    Testosterone: "testosterone",
    E2: "estradiol",
    IGF_BP3: "igfbp3",
    IGF_1: "igf1",
    DHEA: "dhea",
};

export const LAB_SUMMARY_META: Record<NormalizedTestKey, { label: string; unit: string }> = {
    lh: { label: "LH", unit: "mIU/mL" },
    fsh: { label: "FSH", unit: "mIU/mL" },
    tsh: { label: "TSH", unit: "uIU/mL" },
    ft4: { label: "FreeT4", unit: "ng/dL" },
    testosterone: { label: "Testosterone", unit: "ng/mL" },
    estradiol: { label: "E2", unit: "ng/mL" },
    igfbp3: { label: "IGF-BP3", unit: "ng/mL" },
    igf1: { label: "Somatomedin-C", unit: "ng/mL" },
    dhea: { label: "DHEA", unit: "ng/mL" },
    hba1c: { label: "HbA1c", unit: "%" },
};

export const LAB_SUMMARY_ORDER: NormalizedTestKey[] = [
    "lh",
    "fsh",
    "tsh",
    "ft4",
    "testosterone",
    "estradiol",
    "igfbp3",
    "igf1",
    "dhea",
    "hba1c",
];
