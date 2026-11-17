/**
 * 얇은 캔버스 레이어: DOM 없는 코어(buildBuffer)를 원본 크기 캔버스로 굽고 캐시.
 * getSprite 는 항상 SPRITE_W×SPRITE_H 캔버스를 반환 (image smoothing 은 소비자가 off).
 */
import type { Dir, Frame, SpriteKind } from './dims'
import { SPRITE_H, SPRITE_W } from './dims'
import { buildBuffer, normalizeAppearance } from './sprites'

const cache = new Map<string, HTMLCanvasElement>()

function keyOf(kind: SpriteKind, dir: Dir, frame: Frame): string {
  if (kind === 'groom' || kind === 'bride') return `${kind}|${dir}|${frame}`
  const a = normalizeAppearance(kind)
  return `${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}|${dir}|${frame}`
}

/** 원본 크기(SPRITE_W×SPRITE_H) 스프라이트 캔버스. 내부 캐시됨. */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame): HTMLCanvasElement {
  const key = keyOf(kind, dir, frame)
  const hit = cache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_W
  canvas.height = SPRITE_H
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const { data } = buildBuffer(kind, dir, frame)
    const img = ctx.createImageData(SPRITE_W, SPRITE_H)
    img.data.set(data)
    ctx.putImageData(img, 0, 0)
  }
  cache.set(key, canvas)
  return canvas
}
