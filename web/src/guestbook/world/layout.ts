/**
 * 장면 레이아웃 계산 — DOM 없이 순수 함수. 시뮬레이션(경계)과 렌더러(배치)가 공유.
 * (world 내부 전용)
 */
import {
  BACKDROP_H,
  COUPLE_FLOOR_GAP,
  FLOOR_PAD_BOTTOM,
  FLOOR_PAD_X,
  LOGICAL_W,
  SEPARATION_RADIUS,
  WALK_H_MAX,
  WALK_H_MIN,
  WALK_H_PER_GUEST,
} from './constants'

/** 가구/장식 — 하객이 피해 다니고, y정렬로 앞뒤가 겹치는 오브젝트 */
export type DecorKind = 'flowerStand' | 'cakeTable' | 'roundTable' | 'sign'

export interface Decor {
  kind: DecorKind
  /** 바닥 접점(발) 좌표 — y정렬 기준 */
  x: number
  y: number
  /** 회피 반경(중심에서) */
  avoid: number
}

export interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface WorldLayout {
  W: number
  H: number
  backdropH: number
  /** 신랑/신부 발 좌표 */
  coupleY: number
  groomX: number
  brideX: number
  /** 신랑·신부 주변 회피 반경 */
  coupleAvoid: number
  /** 하객 걷기 영역(발 기준) */
  walk: Bounds
  /** 아일 카펫 중심 x와 반너비 */
  aisleX: number
  aisleHalf: number
  decor: Decor[]
  guestCount: number
  /** 벽(상단 밴드)이 시작하는 y — 스테이지 모드에서 상단 HUD 만큼 장면을 내린다 (기본 0) */
  wallTop: number
  /** 이웃 분리 반경 — 스테이지 모드에서 바닥이 좁으면 간격을 줄인다 (기본 SEPARATION_RADIUS) */
  separation: number
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 하객 수에 따라 바닥 높이가 자라는 장면 레이아웃을 만든다 (결정적) */
export function computeLayout(guestCount: number): WorldLayout {
  const walkH = clamp(WALK_H_MIN + guestCount * WALK_H_PER_GUEST, WALK_H_MIN, WALK_H_MAX)
  return buildLayout(LOGICAL_W, 0, walkH, FLOOR_PAD_BOTTOM, guestCount, SEPARATION_RADIUS)
}

/** 스테이지(전체 화면) 모드에서 장면이 가져야 하는 최소 논리 크기 */
export const STAGE_MIN_W = 150
export const STAGE_MIN_H = 236
/** 스테이지 모드에서 화면에 동시에 돌아다니는 하객 수 상한 */
export const STAGE_MAX_GUESTS = 60
/** 하객 한 명에게 필요한 최소 바닥 넓이(논리 px²) — 화면이 작으면 상한을 더 낮춘다 */
const STAGE_AREA_PER_GUEST = 520

export interface StageSpec {
  /** 장면의 논리 크기 (컨테이너 크기 ÷ 확대 배율) */
  W: number
  H: number
  /** 위/아래 HUD 가 가리는 높이(논리 px) — 벽은 그만큼 내려오고, 걷기 영역은 그 위에서 끝난다 */
  insetTop: number
  insetBottom: number
}

/** 스테이지 모드에서 한 화면에 세울 수 있는 하객 수 (화면이 클수록 많이, 최대 STAGE_MAX_GUESTS) */
export function stageCapacity(spec: StageSpec): number {
  const { walk } = computeStageLayout(spec, 0)
  const area = (walk.maxX - walk.minX) * (walk.maxY - walk.minY)
  return clamp(Math.floor(area / STAGE_AREA_PER_GUEST), 8, STAGE_MAX_GUESTS)
}

/**
 * 스테이지 모드 레이아웃: 장면 크기가 하객 수가 아니라 컨테이너(화면)로 정해진다.
 * 하객이 많으면 바닥을 늘리는 대신 서로의 간격(분리 반경)을 줄인다. (결정적)
 */
export function computeStageLayout(spec: StageSpec, guestCount: number): WorldLayout {
  const W = Math.max(STAGE_MIN_W, Math.round(spec.W))
  const H = Math.max(STAGE_MIN_H, Math.round(spec.H))
  const wallTop = Math.max(0, Math.round(spec.insetTop))
  const walkMinY = wallTop + BACKDROP_H + 14 + COUPLE_FLOOR_GAP
  const padBottom = Math.max(0, Math.round(spec.insetBottom)) + 8
  // 화면이 아주 낮아도 걷기 영역이 뒤집히지 않게 최소 높이를 보장한다
  const walkH = Math.max(40, H - padBottom - walkMinY)
  const area = (W - FLOOR_PAD_X * 2) * walkH
  const separation =
    guestCount > 0 ? clamp(Math.sqrt(area / guestCount) * 0.82, 10, SEPARATION_RADIUS) : SEPARATION_RADIUS
  const layout = buildLayout(W, wallTop, walkH, H - walkMinY - walkH, guestCount, separation)
  // 좁은 바닥에서는 가구가 길을 막지 않게 회피 반경을 줄인다
  if (walkH < 110) for (const d of layout.decor) d.avoid = Math.min(d.avoid, 15)
  return layout
}

function buildLayout(
  W: number,
  wallTop: number,
  walkH: number,
  padBottom: number,
  guestCount: number,
  separation: number,
): WorldLayout {
  const backdropH = wallTop + BACKDROP_H
  const coupleY = backdropH + 14
  const walkMinY = coupleY + COUPLE_FLOOR_GAP
  const walkMaxY = walkMinY + walkH
  const H = Math.round(walkMaxY + padBottom)

  const aisleX = W / 2
  const aisleHalf = 20

  const groomX = Math.round(W / 2 - 15)
  const brideX = Math.round(W / 2 + 15)

  const decor: Decor[] = [
    // 무대 양옆 꽃 스탠드
    { kind: 'flowerStand', x: 24, y: coupleY + 4, avoid: 13 },
    { kind: 'flowerStand', x: W - 24, y: coupleY + 4, avoid: 13 },
    // 아일 아래쪽 케이크 테이블
    { kind: 'cakeTable', x: aisleX, y: walkMaxY - 8, avoid: 21 },
    // 좌우 라운드 테이블(장식 + 분산)
    { kind: 'roundTable', x: 32, y: walkMinY + walkH * 0.45, avoid: 21 },
    { kind: 'roundTable', x: W - 32, y: walkMinY + walkH * 0.6, avoid: 21 },
  ]

  return {
    W,
    H,
    backdropH,
    coupleY,
    groomX,
    brideX,
    coupleAvoid: 34,
    walk: {
      minX: FLOOR_PAD_X,
      maxX: W - FLOOR_PAD_X,
      minY: walkMinY,
      maxY: walkMaxY,
    },
    aisleX,
    aisleHalf,
    decor,
    guestCount,
    wallTop,
    separation,
  }
}
