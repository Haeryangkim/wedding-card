/**
 * 픽셀 캐릭터 모듈 공개 계약. (world/, ui/ 가 이 시그니처에 의존 — 이름/시그니처 고정)
 * 모든 스프라이트는 코드로 직접 그리는 오리지널 도트(외부 에셋 없음).
 * 구현은 ./dims ./palette ./grid ./parts ./sprites ./canvas 로 분리.
 */
export { SPRITE_W, SPRITE_H } from './dims'
export type { Dir, Frame, SpriteKind, PartDef } from './dims'

export { PART_DEFS, randomAppearance, normalizeAppearance, buildBuffer } from './sprites'
export type { PixelBuffer } from './sprites'
export { getSprite } from './canvas'
