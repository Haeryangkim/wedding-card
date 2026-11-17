/**
 * "동숲풍" 벡터 캐릭터 스타일 — 공개 계약. (STYLE_INFO 로 스타일 목록에 등록)
 * 픽셀 스타일(../../character)과 같은 모양: PART_DEFS / randomAppearance / normalizeAppearance / getSprite.
 * 차이: getSprite 에 scale(명목 1단위당 픽셀, 보통 spriteScale(cssPxPerUnit))을 넘기며,
 * 캔버스는 FOREST_W*scale x FOREST_H*scale. 옆 방향(left/right)은 두 눈이 보이는 3/4 뷰다.
 * 모든 그림은 Canvas 2D 경로로 직접 그린 오리지널 아트(외부 에셋 없음).
 */
export { FOREST_W, FOREST_H, FOREST_FOOT_Y, FOREST_CENTER_X } from './dims'
export type { Dir, Frame, SpriteKind, PartDef } from './dims'
export {
  PART_DEFS,
  randomAppearance,
  normalizeAppearance,
  getSprite,
  clearSpriteCache,
  spriteCacheStats,
  spriteScale,
  STYLE_INFO,
  DEFAULT_SCALE,
  MAX_DPR,
  MAX_SCALE,
} from './sprites'
