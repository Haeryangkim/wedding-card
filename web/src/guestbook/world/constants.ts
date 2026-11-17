/**
 * 월드 튜닝 상수. 모두 "논리 픽셀"(logical px) 단위 — 화면에는 컨테이너 너비에
 * 맞춰 정수배에 가깝게 확대됩니다. (world 내부 전용)
 */

/** 장면의 고정 논리 너비. 화면 너비에 맞춰 스케일됩니다. */
export const LOGICAL_W = 192

/** 상단 배경 밴드(꽃 아치 / 무대 / 드레이프 / 전구) 높이 */
export const BACKDROP_H = 76

/** 바닥 가장자리 여백(발 기준) */
export const FLOOR_PAD_X = 12
export const FLOOR_PAD_BOTTOM = 14

/** 신랑·신부와 하객 영역 사이 간격 */
export const COUPLE_FLOOR_GAP = 16

/** 걷기 영역 높이: 기본값 + 하객 수 비례, 상한으로 한 덩어리 방지 */
export const WALK_H_MIN = 96
export const WALK_H_MAX = 520
export const WALK_H_PER_GUEST = 2.9

/** 시뮬레이션 고정 타임스텝(초) */
export const SIM_DT = 1 / 60
/** 한 프레임에 처리할 최대 스텝(스파이럴 방지) */
export const MAX_STEPS_PER_FRAME = 5

/** 하객 이동 속도(논리 px/초) 범위 */
export const SPEED_MIN = 9
export const SPEED_MAX = 15

/** 상태 지속시간(초) 범위 */
export const IDLE_MIN = 1.4
export const IDLE_MAX = 5.0
export const WALK_MIN = 1.2
export const WALK_MAX = 3.4

/** 이웃 분리(겹침 방지) 반경과 세기 */
export const SEPARATION_RADIUS = 16
export const SEPARATION_FORCE = 32

/** 목적지 도착 판정 거리 */
export const ARRIVE_DIST = 2.2

/** 등장(드롭인) 애니메이션 시간(초) */
export const SPAWN_FALL_TIME = 0.55
/** 퇴장(페이드아웃) 시간(초) */
export const DESPAWN_TIME = 0.5
/** 드롭인 시작 높이(논리 px, 위쪽) */
export const SPAWN_FALL_FROM = 60

/** 신랑/신부 라벨 */
export const COUPLE_LABEL_DY = 6
