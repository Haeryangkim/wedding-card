/** 합성: 외형 → 층 순서대로 그리기, 스케일별 캔버스 캐시, 캐릭터 만들기용 파츠 정의. */
import type { Appearance } from '../../types'
import { ACCESSORIES } from './accessories'
import { drawArms, drawHead, drawLegs, drawShadow, gait } from './body'
import type { Dir, Frame, PartDef, SpriteKind, View } from './dims'
import { DESIGN_PER_UNIT, DESIGN_W, FOREST_FOOT_Y, FOREST_H, FOREST_W } from './dims'
import { ellipse, flat, type C } from './draw'
import { drawHair, HAIRS } from './hair'
import { drawTorso, OUTFITS, paletteFor, type OutfitDef } from './outfits'
import { HAIR_COLORS, OUTFIT_COLORS, SKINS } from './palette'
import { bouquet, GOWN, tiara, TUXEDO, veil } from './special'

const COUNTS: Record<keyof Appearance, number> = {
  skin: SKINS.length,
  hairStyle: HAIRS.length,
  hairColor: HAIR_COLORS.length,
  outfit: OUTFITS.length,
  outfitColor: OUTFIT_COLORS.length,
  accessory: ACCESSORIES.length,
}

interface Look {
  skin: string
  hairStyle: number
  hairColor: string
  outfit: OutfitDef
  color: string
  accessory: number
  special?: 'groom' | 'bride'
}

function lookOf(kind: SpriteKind): Look {
  if (kind === 'groom') {
    return { skin: SKINS[1].hex, hairStyle: 10, hairColor: '#3d3134', outfit: TUXEDO, color: '#3d3f54', accessory: 0, special: 'groom' }
  }
  if (kind === 'bride') {
    return { skin: SKINS[0].hex, hairStyle: 6, hairColor: '#5b4034', outfit: GOWN, color: '#fffaf1', accessory: 0, special: 'bride' }
  }
  const a = normalizeAppearance(kind)
  return {
    skin: SKINS[a.skin].hex,
    hairStyle: a.hairStyle,
    hairColor: HAIR_COLORS[a.hairColor].hex,
    outfit: OUTFITS[a.outfit],
    color: OUTFIT_COLORS[a.outfitColor].hex,
    accessory: a.accessory,
  }
}

function render(ctx: C, look: Look, view: View, frame: Frame): void {
  const g = gait(view, frame)
  const pal = paletteFor(look.outfit, look.color)
  const bride = look.special === 'bride'
  const armLook = {
    sleeve: look.outfit.sleeve,
    color: pal.sleeve,
    skin: look.skin,
    width: look.outfit.sleeveW,
    cuff: look.outfit.cuff?.(pal),
  }
  /** 상체(머리 포함)는 걷기 흔들림/기울기를 함께 받는다. 발은 고정 */
  const upper = (fn: () => void) => {
    ctx.save()
    ctx.translate(0, 92 + g.bob)
    ctx.rotate(g.tilt)
    ctx.translate(0, -92)
    fn()
    ctx.restore()
  }
  const lower = look.outfit.lower
  drawShadow(ctx, lower === 'chima' || lower === 'long' ? 25 : 21)
  upper(() => {
    if (bride) veil(ctx, view, 'under')
    drawHair(ctx, 'under', view, look.hairStyle, look.hairColor, look.skin)
    look.outfit.under?.(ctx, view, pal)
    if (view === 'side') drawArms(ctx, view, frame, armLook, 'far', bride)
  })
  drawLegs(ctx, view, frame, { leg: pal.leg, shoe: pal.shoe, skin: look.skin, wide: look.outfit.wideLegs, shine: look.special === 'groom' })
  upper(() => {
    const top = drawTorso(ctx, view, frame, look.outfit, pal)
    // 큰 머리가 몸통에 드리우는 그림자
    ctx.save()
    ctx.clip(top)
    flat(ctx, ellipse(0, 63, 17, 6.5), '#3b2434', 0.16)
    ctx.restore()
    drawArms(ctx, view, frame, armLook, view === 'side' ? 'near' : 'both', bride)
    if (bride) bouquet(ctx, view)
    drawHead(ctx, view, look.skin)
    drawHair(ctx, 'over', view, look.hairStyle, look.hairColor, look.skin)
    ACCESSORIES[look.accessory].draw(ctx, view, pal.accent)
    if (bride) {
      veil(ctx, view, 'over')
      tiara(ctx, view)
    }
  })
}

/* ── 캐시된 캔버스 (LRU) ───────────────────────────────── */
/** 기본 배율: 명목 1단위 = 2px (56x72). 실제 사용 시 spriteScale(화면 배율) 을 넘길 것 */
export const DEFAULT_SCALE = 2
/** 이보다 큰 devicePixelRatio 는 2로 취급 (3x 폰에서 캔버스 메모리가 2.25배로 느는 것을 막음) */
export const MAX_DPR = 2
/** getSprite 가 실제로 굽는 배율 상한 (명목 1단위당 픽셀) */
export const MAX_SCALE = 12
/** 캐시 상한: 개수와 총 픽셀 수(메모리) 둘 다 지킨다. 넘치면 가장 오래 안 쓴 것부터 버림 */
export const CACHE_MAX_ENTRIES = 900
export const CACHE_MAX_PIXELS = 16_000_000

interface Entry {
  canvas: HTMLCanvasElement
  px: number
}
const cache = new Map<string, Entry>()
let cachePixels = 0

/**
 * 화면 배율(명목 1단위당 CSS px) → getSprite 에 넘길 배율. devicePixelRatio 는 MAX_DPR 로 제한한다.
 * 예) 높이 80 CSS px 로 그릴 때: getSprite(a, dir, f, spriteScale(80 / FOREST_H))
 */
export function spriteScale(cssPxPerUnit: number, dpr?: number): number {
  const d = dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1) ?? 1
  return quantize(cssPxPerUnit * Math.min(Math.max(d, 1), MAX_DPR))
}
/** 캐시 키가 잘게 쪼개지지 않도록 0.05 단위로 맞추고 상·하한을 건다 */
function quantize(scale: number): number {
  const s = Number.isFinite(scale) ? scale : DEFAULT_SCALE
  return Math.min(MAX_SCALE, Math.max(0.25, Math.round(s * 20) / 20))
}

function keyOf(kind: SpriteKind, dir: Dir, frame: Frame, scale: number): string {
  const tail = `|${dir}|${frame}|${scale}`
  if (kind === 'groom' || kind === 'bride') return kind + tail
  const a = normalizeAppearance(kind)
  return `${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}${tail}`
}

/**
 * 스프라이트 캔버스 (FOREST_W*scale x FOREST_H*scale 픽셀, 올림). 벡터라 어떤 scale 에서도 선명하다.
 * scale = 명목 1단위당 픽셀 수 — 보통 spriteScale(cssPxPerUnit). 0.05 단위로 반올림, MAX_SCALE 로 제한.
 * (외형, 방향, 프레임, 배율)별로 LRU 캐시되므로 매 프레임 호출해도 된다.
 * 'left' 는 'right' 의 좌우 반전이다.
 */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame, scale: number = DEFAULT_SCALE): HTMLCanvasElement {
  const sc = quantize(scale)
  const key = keyOf(kind, dir, frame, sc)
  const hit = cache.get(key)
  if (hit) {
    // 최근 사용으로 갱신 (Map 은 삽입 순서를 유지)
    cache.delete(key)
    cache.set(key, hit)
    return hit.canvas
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(FOREST_W * sc)
  canvas.height = Math.ceil(FOREST_H * sc)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const s = sc / DESIGN_PER_UNIT
    const mirror = dir === 'left' ? -1 : 1
    ctx.setTransform(s * mirror, 0, 0, s, (DESIGN_W / 2) * s, 0)
    const view: View = dir === 'down' ? 'front' : dir === 'up' ? 'back' : 'side'
    render(ctx, lookOf(kind), view, frame)
  }
  const px = canvas.width * canvas.height
  cache.set(key, { canvas, px })
  cachePixels += px
  for (const [k, e] of cache) {
    if (cache.size <= CACHE_MAX_ENTRIES && cachePixels <= CACHE_MAX_PIXELS) break
    if (k === key) break
    cache.delete(k)
    cachePixels -= e.px
  }
  return canvas
}
/** 배율이 바뀌었을 때(리사이즈 등) 이전 배율 캔버스를 비운다 */
export function clearSpriteCache(): void {
  cache.clear()
  cachePixels = 0
}
/** 캐시 상태 (개발·테스트용) */
export function spriteCacheStats(): { entries: number; pixels: number } {
  return { entries: cache.size, pixels: cachePixels }
}

/** 스타일 등록 정보 (통합 측이 스타일 목록에 올릴 때 사용) */
export const STYLE_INFO = {
  id: 'forest',
  label: '숲속 주민',
  nominalW: FOREST_W,
  nominalH: FOREST_H,
  footY: FOREST_FOOT_Y,
  pixelated: false,
  recommendedCssHeight: 80,
} as const

/* ── 랜덤 / 보정 ─────────────────────────────────────── */
function randInt(rand: () => number, n: number): number {
  return Math.floor(rand() * n) % n
}
export function randomAppearance(rand: () => number = Math.random): Appearance {
  const accessory = rand() < 0.4 ? 0 : randInt(rand, COUNTS.accessory - 1) + 1
  return {
    skin: randInt(rand, COUNTS.skin),
    hairStyle: randInt(rand, COUNTS.hairStyle),
    hairColor: randInt(rand, COUNTS.hairColor),
    outfit: randInt(rand, COUNTS.outfit),
    outfitColor: randInt(rand, COUNTS.outfitColor),
    accessory,
  }
}
function clampIndex(v: unknown, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (Number.isNaN(n)) return 0
  const i = Math.round(n)
  if (!(i >= 0)) return 0
  if (i > max - 1) return max - 1
  return i
}
export function normalizeAppearance(input: unknown): Appearance {
  const o = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  return {
    skin: clampIndex(o.skin, COUNTS.skin),
    hairStyle: clampIndex(o.hairStyle, COUNTS.hairStyle),
    hairColor: clampIndex(o.hairColor, COUNTS.hairColor),
    outfit: clampIndex(o.outfit, COUNTS.outfit),
    outfitColor: clampIndex(o.outfitColor, COUNTS.outfitColor),
    accessory: clampIndex(o.accessory, COUNTS.accessory),
  }
}

export const PART_DEFS: PartDef[] = [
  { key: 'hairStyle', label: '머리 모양', options: HAIRS.map((h) => ({ label: h.label })) },
  { key: 'hairColor', label: '머리 색', options: HAIR_COLORS.map((c) => ({ label: c.label, swatch: c.hex })) },
  { key: 'outfit', label: '의상', options: OUTFITS.map((o) => ({ label: o.label })) },
  { key: 'outfitColor', label: '의상 색', options: OUTFIT_COLORS.map((c) => ({ label: c.label, swatch: c.hex })) },
  { key: 'accessory', label: '액세서리', options: ACCESSORIES.map((a) => ({ label: a.label })) },
  { key: 'skin', label: '피부', options: SKINS.map((c) => ({ label: c.label, swatch: c.hex })) },
]
