export type Audience = "guardian" | "clinician";

export const AUDIENCE_LABELS: Record<Audience, string> = {
  guardian: "보호자용",
  clinician: "의료진용",
};

export const UI_COPY = {
  dashboard: {
    noData: {
      guardian: "데이터가 없습니다.",
      clinician: "데이터가 없습니다.",
    },
  },
  growthStats: {
    heightLabel: {
      guardian: "최근 키 변화",
      clinician: "키 성장 변화(최근 방문)",
    },
    heightBadge: {
      guardian: "최근 방문 대비",
      clinician: "최근 방문 대비",
    },
    bmiLabel: {
      guardian: "BMI (체질량지수)",
      clinician: "BMI",
    },
    bmiBadge: {
      guardian: "정상 범위 (58백분위)",
      clinician: "정상 (58백분위)",
    },
    nutritionLabel: {
      guardian: "영양 점검",
      clinician: "영양 상태 체크",
    },
    nutritionMain: {
      guardian: "철분 섭취 여부 확인",
      clinician: "철분 섭취 확인 권장",
    },
    nutritionBadge: {
      guardian: "점검 필요",
      clinician: "모니터링 필요",
    },
  },
  growthChart: {
    title: {
      guardian: "또래 대비 키 위치",
      clinician: "연령별 신장 백분위",
    },
    ageLabel: {
      guardian: "현재 월령",
      clinician: "현재 월령",
    },
    percentileLabel: {
      guardian: "또래 중 위치",
      clinician: "백분위수",
    },
    legendTrend: {
      guardian: "아이의 성장 추세",
      clinician: "환아 성장 추세",
    },
    tabs: {
      growth: "성장 곡선",
      bmi: "BMI 추세",
      velocity: "성장 속도",
    },
  },
  doctorAdvice: {
    heading: {
      guardian: "의사 선생님의 조언",
      clinician: "의료진 소견",
    },
    body: {
      guardian:
        "지난 6개월 동안 키 성장 속도가 또래 평균보다 빠른 편이에요. 다음 방문까지 단백질 섭취와 하루 9시간 수면을 꾸준히 유지해주세요.",
      clinician:
        "최근 6개월 성장 속도는 또래 상위 30%이며, 다음 내원까지 단백질 섭취와 9시간 수면 유지를 권장합니다.",
    },
    updatedAt: {
      guardian: "2시간 전 업데이트",
      clinician: "2시간 전 업데이트",
    },
  },
} as const;

export const TREND_SUMMARY = {
  noStandard: {
    guardian: "기준 데이터가 부족해요",
    clinician: "기준 데이터 없음",
  },
  insufficient: {
    guardian: "비교할 이전 기록이 부족해요",
    clinician: "이전 방문 데이터 부족",
  },
  faster: {
    guardian: "최근 성장 속도가 빨라졌어요",
    clinician: "최근 성장 속도 증가",
  },
  slower: {
    guardian: "최근 성장 속도가 느려졌어요",
    clinician: "최근 성장 속도 감소",
  },
  stable: {
    guardian: "성장 흐름이 안정적이에요",
    clinician: "성장 추세 안정",
  },
} as const;
