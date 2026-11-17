/**
 * "위치 보기" 스크롤 계산 (순수 함수).
 * 캐릭터의 뷰포트 기준 Y 가 화면 안쪽(위아래 여백 제외)에 있으면 null(스크롤 불필요),
 * 아니면 캐릭터가 화면 세로 중앙에 오도록 하는 window.scrollTo 의 top 값을 돌려준다.
 */
export function scrollTopForAgent(
  agentViewportY: number,
  scrollY: number,
  viewportH: number,
  margin = 72,
): number | null {
  const m = Math.min(margin, viewportH / 4)
  if (agentViewportY >= m && agentViewportY <= viewportH - m) return null
  return Math.max(0, scrollY + agentViewportY - viewportH / 2)
}
