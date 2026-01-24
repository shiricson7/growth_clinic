export type Metric = "height" | "weight";

export type CommentSeverity = "calm" | "watch" | "encourage";

export function generateComment({
  metric,
  currentPercentile,
  prevPercentile,
  deltaValue,
  deltaMonths,
  ageMonths,
}: {
  metric: Metric;
  currentPercentile: number;
  prevPercentile?: number;
  deltaValue?: number;
  deltaMonths?: number;
  ageMonths: number;
}) {
  const isLow = currentPercentile < 10;
  const isHigh = currentPercentile > 90;
  const shifted =
    prevPercentile !== undefined
      ? currentPercentile - prevPercentile
      : 0;

  let severity: CommentSeverity = "calm";
  if (isLow || isHigh) severity = "watch";
  if (Math.abs(shifted) >= 10) severity = "encourage";

  const metricLabel = metric === "height" ? "키" : "몸무게";

  const title =
    severity === "watch"
      ? "괜찮아요, 함께 살펴볼게요"
      : severity === "encourage"
      ? "좋은 흐름이에요"
      : "오늘도 잘 크고 있어요";

  const trendSentence =
    prevPercentile !== undefined
      ? `최근 ${deltaMonths ?? 3}개월 동안 ${metricLabel} 위치가 ${Math.abs(
          shifted
        ).toFixed(0)}%p ${shifted >= 0 ? "올라갔어요" : "내려갔어요"}.`
      : `현재 ${metricLabel} 위치가 또래 기준 상위 ${(100 - currentPercentile).toFixed(
          0
        )}%예요.`;

  const reassurance =
    severity === "watch"
      ? "갑작스럽게 걱정하기보다는 다음 기록을 함께 확인해보면 좋아요."
      : "꾸준한 식사와 수면이 가장 큰 힘이 된답니다.";

  const ageNote = ageMonths > 0 ? `지금은 ${ageMonths.toFixed(0)}개월이에요.` : "";

  return {
    title,
    message: [trendSentence, reassurance, ageNote].filter(Boolean).join(" "),
    severity,
  };
}
