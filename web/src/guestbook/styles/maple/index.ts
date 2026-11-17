/**
 * "메이플" 캐릭터 스타일 — 공개 계약 (기존 character/ 모듈과 같은 모양).
 * 모든 스프라이트는 코드로 직접 그리는 오리지널 도트이며 외부 에셋을 쓰지 않는다.
 *
 * 프로토타입 → 제품 품질로 다듬은 버전. 통합은 STYLE_INFO 로 등록한다.
 * 방향: right = 3/4 측면(기본), left = 좌우 반전, down = 정면, up = 뒷모습. 프레임 0 = 정지, 1·2 = 걷기.
 */
import type { Dir, Frame, SpriteKind } from './dims'
import { MAPLE_H, MAPLE_W } from './dims'
import { buildBuffer, normalizeAppearance } from './sprites'

export { MAPLE_W, MAPLE_H, FOOT_Y, MAPLE_APP_SCALE } from './dims'
export type { Appearance, Dir, Frame, SpriteKind, PartDef } from './dims'
export { PART_DEFS, randomAppearance, normalizeAppearance, buildBuffer } from './sprites'
export type { PixelBuffer } from './sprites'

/** 스타일 등록 정보 (통합 쪽에서 스타일 목록에 넣을 때 쓴다) */
export const STYLE_INFO = {
  id: 'maple',
  label: '메이플',
  nominalW: MAPLE_W,
  nominalH: MAPLE_H,
  /** 발바닥 행 (스프라이트 위에서부터, 원본 px) */
  footY: 61,
  pixelated: true,
  /** 20×36 기본 픽셀 캐릭터(2.2배 ≈ 80px)와 키가 맞는 표시 높이 = 원본의 1.375배 (인물 실제 키 ≈ 73px) */
  recommendedCssHeight: 88,
} as const

const cache = new Map<string, HTMLCanvasElement>()

function keyOf(kind: SpriteKind, dir: Dir, frame: Frame): string {
  if (kind === 'groom' || kind === 'bride') return `${kind}|${dir}|${frame}`
  const a = normalizeAppearance(kind)
  return `${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}|${dir}|${frame}`
}

/**
 * 스프라이트 캔버스 (캐시됨). scale = 1 이면 MAPLE_W×MAPLE_H 원본,
 * 정수 scale 을 주면 최근접 이웃으로 미리 확대한 캔버스를 돌려준다.
 */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame, scale = 1): HTMLCanvasElement {
  const sc = Math.max(1, Math.round(scale))
  const key = `${keyOf(kind, dir, frame)}@${sc}`
  const hit = cache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = MAPLE_W * sc
  canvas.height = MAPLE_H * sc
  const ctx = canvas.getContext('2d')
  if (ctx) {
    if (sc === 1) {
      const { data } = buildBuffer(kind, dir, frame)
      const img = ctx.createImageData(MAPLE_W, MAPLE_H)
      img.data.set(data)
      ctx.putImageData(img, 0, 0)
    } else {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(getSprite(kind, dir, frame, 1), 0, 0, canvas.width, canvas.height)
    }
  }
  cache.set(key, canvas)
  return canvas
}
