/**
 * 스프라이트 치수 및 공개 타입. (index.ts 가 re-export, 내부 모듈은 여기서 import)
 * 인물은 약 16x32 (스타듀풍 키 큰 비율), 캔버스는 모자·베일·외곽선 여유를 둔 20x34.
 * 발바닥 외곽선이 맨 아래 행(y=33), 좌우 중심축은 x=9|10 사이.
 */
import type { Appearance, PartKey } from '../types'

/** 스프라이트 원본 픽셀 크기 (화면에는 정수배 확대, image smoothing off) */
export const SPRITE_W = 20
export const SPRITE_H = 36

export type Dir = 'down' | 'left' | 'right' | 'up'
/** 0 = 정지, 1·2 = 걷기 프레임 */
export type Frame = 0 | 1 | 2

/** 하객 외형 또는 고정 캐릭터(신랑/신부) */
export type SpriteKind = Appearance | 'groom' | 'bride'

export interface PartDef {
  key: PartKey
  label: string // 예: "피부", "머리 모양"
  /** swatch 가 있으면 색상칩으로, 없으면 미리보기 썸네일로 표시 */
  options: { label: string; swatch?: string }[]
}

/** 내부용: 실제로 그리는 3방향 (left 는 right 의 좌우반전) */
export type View = 'front' | 'side' | 'back'
