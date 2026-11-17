/**
 * "동숲풍" 벡터 캐릭터 스타일 — 공개 계약. (프로토타입: 앱에 아직 연결되지 않음)
 * 픽셀 스타일(../../character)과 같은 모양: PART_DEFS / randomAppearance / normalizeAppearance / getSprite.
 * 차이: getSprite 에 scale(명목 1단위당 픽셀)을 넘기며, 캔버스는 FOREST_W*scale x FOREST_H*scale.
 * 모든 그림은 Canvas 2D 경로로 직접 그린 오리지널 아트(외부 에셋 없음).
 */
export { FOREST_W, FOREST_H, FOREST_FOOT_Y, FOREST_CENTER_X } from './dims'
export type { Dir, Frame, SpriteKind, PartDef } from './dims'
export { PART_DEFS, randomAppearance, normalizeAppearance, getSprite, clearSpriteCache, DEFAULT_SCALE } from './sprites'
