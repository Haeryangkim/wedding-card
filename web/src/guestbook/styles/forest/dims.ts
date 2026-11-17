/**
 * "동숲풍" 벡터 캐릭터 스타일 — 치수와 공개 타입.
 * 모든 그림은 Canvas 2D 경로로 직접 그리는 오리지널 아트(외부 에셋 없음).
 *
 * 좌표계: 내부 "디자인 단위"는 84 x 108 (명목 크기의 3배). 가로 중심 x = 42, 발바닥 y = 104.
 * 명목 크기(FOREST_W x FOREST_H)는 기존 픽셀 스타일의 논리 픽셀과 같은 단위라
 * 월드 렌더러가 같은 높이(36)로 배치할 수 있다.
 */
import type { Appearance, PartKey } from '../../types'

/** 명목(논리) 크기. getSprite 캔버스는 이 크기 x scale 픽셀 */
export const FOREST_W = 28
export const FOREST_H = 36
/** 명목 단위 기준 발바닥(접지) y, 가로 중심 x — 월드 배치 앵커 */
export const FOREST_FOOT_Y = 104 / 3
export const FOREST_CENTER_X = 14
/** 명목 1단위당 디자인 단위 */
export const DESIGN_PER_UNIT = 3
export const DESIGN_W = FOREST_W * DESIGN_PER_UNIT
export const DESIGN_H = FOREST_H * DESIGN_PER_UNIT

export type Dir = 'down' | 'left' | 'right' | 'up'
/** 0 = 정지, 1·2 = 걷기 프레임 */
export type Frame = 0 | 1 | 2
export type SpriteKind = Appearance | 'groom' | 'bride'
/** 실제로 그리는 3방향 (left 는 right 의 좌우반전) */
export type View = 'front' | 'side' | 'back'

export interface PartDef {
  key: PartKey
  label: string
  options: { label: string; swatch?: string }[]
}
