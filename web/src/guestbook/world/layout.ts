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
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 하객 수에 따라 바닥 높이가 자라는 장면 레이아웃을 만든다 (결정적) */
export function computeLayout(guestCount: number): WorldLayout {
  const W = LOGICAL_W
  const walkH = clamp(WALK_H_MIN + guestCount * WALK_H_PER_GUEST, WALK_H_MIN, WALK_H_MAX)

  const coupleY = BACKDROP_H + 14
  const walkMinY = coupleY + COUPLE_FLOOR_GAP
  const walkMaxY = walkMinY + walkH
  const H = Math.round(walkMaxY + FLOOR_PAD_BOTTOM)

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
    backdropH: BACKDROP_H,
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
  }
}
