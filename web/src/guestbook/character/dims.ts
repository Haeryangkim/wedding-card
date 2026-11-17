/**
 * 스프라이트 치수 및 공개 타입. (index.ts 가 re-export, 내부 모듈은 여기서 import)
 * 다른 모듈은 상수를 읽어 레이아웃을 맞추므로 값은 자유롭게 바꿔도 되지만 이름/의미는 고정.
 */
import type { Appearance } from '../types'

/** 스프라이트 원본 픽셀 크기 (화면에는 정수배 확대, image smoothing off) */
export const SPRITE_W = 20
export const SPRITE_H = 28

export type Dir = 'down' | 'left' | 'right' | 'up'
/** 0 = 정지, 1·2 = 걷기 프레임 */
export type Frame = 0 | 1 | 2

/** 하객 외형 또는 고정 캐릭터(신랑/신부) */
export type SpriteKind = Appearance | 'groom' | 'bride'

export interface PartDef {
  key: keyof Appearance
  label: string // 예: "피부", "머리 모양"
  /** swatch 가 있으면 색상칩으로, 없으면 미리보기 썸네일로 표시 */
  options: { label: string; swatch?: string }[]
}
