/**
 * "메이플" 스타일 (2D 횡스크롤 SD 아바타풍) — 치수와 공개 타입.
 * 프로토타입: 앱에 연결되어 있지 않다. 기존 character/ 모듈과 같은 계약을 따르되 독립적으로 동작한다.
 * 머리(머리카락 포함)가 전체 키의 절반, 짧은 팔다리, 어두운 1px 외곽선, 평면 셀 셰이딩.
 */

/** guestbook/types.ts 의 Appearance 와 구조가 같다 (다른 작업과 충돌하지 않도록 이 폴더 안에 사본을 둔다) */
export interface Appearance {
  skin: number
  hairStyle: number
  hairColor: number
  outfit: number
  outfitColor: number
  accessory: number // 0 = 없음
}

/** 스프라이트 원본 픽셀 크기. 발바닥은 FOOT_Y 행, 좌우 중심축은 x = 23|24 사이 */
export const MAPLE_W = 48
export const MAPLE_H = 64
/** 발바닥(신발 맨 아래 색칠 행). 그 아래 1행은 외곽선 */
export const FOOT_Y = 61
/** 앱에서 권장하는 표시 배율: 원본 1px = CSS 1px (430px 폭 캔버스 기준) */
export const MAPLE_APP_SCALE = 1

export type Dir = 'down' | 'left' | 'right' | 'up'
/** 0 = 정지, 1·2 = 걷기 */
export type Frame = 0 | 1 | 2
export type SpriteKind = Appearance | 'groom' | 'bride'

export interface PartDef {
  key: keyof Appearance
  label: string
  options: { label: string; swatch?: string }[]
}

/**
 * 내부 시점. side = 오른쪽을 보는 3/4 측면 (left 는 좌우 반전),
 * front = 정면(down), back = 뒷모습(up).
 */
export type View = 'side' | 'front' | 'back'
