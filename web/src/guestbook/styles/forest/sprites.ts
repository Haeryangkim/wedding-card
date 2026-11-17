/** 합성: 외형 → 층 순서대로 그리기, 스케일별 캔버스 캐시, 캐릭터 만들기용 파츠 정의. */
import type { Appearance } from '../../types'
import { ACCESSORIES, bow } from './accessories'
import { drawArms, drawHead, drawLegs, drawShadow, gait } from './body'
import type { Dir, Frame, PartDef, SpriteKind, View } from './dims'
import { DESIGN_PER_UNIT, DESIGN_W, FOREST_H, FOREST_W } from './dims'
import { ellipse, flat, flower, type C } from './draw'
import { drawHair, HAIRS } from './hair'
import { drawTorso, OUTFITS, paletteFor, suitFront, type OutfitDef } from './outfits'
import { HAIR_COLORS, OUTFIT_COLORS, SKINS } from './palette'

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

const TUXEDO: OutfitDef = {
  label: '턱시도',
  lower: 'pants',
  sleeve: 'long',
  pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: '#3a3a46', shoe: '#33292c', accent: '#3a3a46' }),
  detail: (ctx, v, p) => suitFront(ctx, v, p, true),
  trim(ctx, v) {
    if (v === 'front') {
      bow(ctx, 0, 68.4, 4.4, 0, '#3a3a46')
      flat(ctx, ellipse(10.4, 74.8, 2.6, 1.5, 0.7), '#7fae7a')
      flower(ctx, 8.4, 72.6, 3.2, '#fff6ee')
    } else if (v === 'side') {
      bow(ctx, 9.2, 68.4, 3, 0, '#3a3a46')
    }
  },
}
const GOWN: OutfitDef = {
  label: '웨딩드레스',
  lower: 'long',
  sleeve: 'none',
  pal: () => ({ top: '#fffaf1', bottom: '#fffaf1', sleeve: '#fffaf1', leg: null, shoe: '#fffaf1', accent: '#f6b9c2' }),
  detail(ctx) {
    ctx.strokeStyle = 'rgba(214,178,150,0.9)'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(-14, 76.4)
    ctx.lineTo(14, 76.4)
    ctx.stroke()
  },
}

function lookOf(kind: SpriteKind): Look {
  if (kind === 'groom') {
    return { skin: SKINS[1].hex, hairStyle: 10, hairColor: '#3d3134', outfit: TUXEDO, color: '#45454f', accessory: 0, special: 'groom' }
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

/* ── 신부 전용: 베일·부케·티아라 ───────────────────────── */
function veil(ctx: C, view: View, layer: 'under' | 'over'): void {
  const p = new Path2D()
  if (view === 'front' && layer === 'under') {
    p.moveTo(0, 6)
    p.bezierCurveTo(-30, 8, -36, 50, -31, 92)
    p.quadraticCurveTo(0, 98, 31, 92)
    p.bezierCurveTo(36, 50, 30, 8, 0, 6)
  } else if (view === 'back' && layer === 'over') {
    p.moveTo(0, 15)
    p.bezierCurveTo(-24, 15, -36, 50, -31, 92)
    p.quadraticCurveTo(0, 99, 31, 92)
    p.bezierCurveTo(36, 50, 24, 15, 0, 15)
  } else if (view === 'side' && layer === 'under') {
    p.moveTo(-6, 8)
    p.bezierCurveTo(-34, 6, -44, 50, -36, 93)
    p.quadraticCurveTo(-22, 97, -10, 92)
    p.bezierCurveTo(-10, 60, -8, 30, -6, 8)
  } else return
  p.closePath()
  const g = ctx.createLinearGradient(0, 8, 0, 96)
  g.addColorStop(0, layer === 'under' ? 'rgba(255,253,248,0.95)' : 'rgba(255,253,248,0.93)')
  g.addColorStop(1, layer === 'under' ? 'rgba(255,250,242,0.8)' : 'rgba(255,250,242,0.72)')
  ctx.fillStyle = g
  ctx.strokeStyle = 'rgba(190,160,150,0.55)'
  ctx.lineWidth = 1
  ctx.stroke(p)
  ctx.fill(p)
}
function bouquet(ctx: C, view: View): void {
  if (view === 'back') return
  const x = view === 'side' ? 12 : 0
  const k = view === 'side' ? 0.8 : 1
  for (const [dx, dy, r] of [[-6, 2, 3.4], [6, 2, 3.4], [0, 5, 3.6]]) flat(ctx, ellipse(x + dx * k, 80 + dy, r, r * 0.8, 0), '#7fae7a')
  const cols = ['#f7a9b5', '#fff6ee', '#f3c36a', '#fff6ee', '#f29a8a']
  const pts = [[-4.6, -1.6], [4.6, -1.6], [0, -4.2], [-2.6, 2.4], [2.6, 2.4]]
  pts.forEach(([dx, dy], i) => flower(ctx, x + dx * k, 80 + dy, 3.3, cols[i]))
}
function tiara(ctx: C, view: View): void {
  const xs = view === 'side' ? [2, 9, 15.5] : view === 'back' ? [] : [-7, 0, 7]
  xs.forEach((x, i) => flower(ctx, x, view === 'side' ? 17 + i * 1.6 : 19.5 + Math.abs(x) * 0.12, 3.2, i === 1 ? '#f7a9b5' : '#fff6ee'))
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
  drawLegs(ctx, view, frame, { leg: pal.leg, shoe: pal.shoe, skin: look.skin, wide: look.outfit.wideLegs })
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

/* ── 캐시된 캔버스 ─────────────────────────────────────── */
const cache = new Map<string, HTMLCanvasElement>()
/** 기본 배율: 명목 1단위 = 2px (56x72). 실제 사용 시 (화면 배율 x devicePixelRatio) 를 넘길 것 */
export const DEFAULT_SCALE = 2

function keyOf(kind: SpriteKind, dir: Dir, frame: Frame, scale: number): string {
  const tail = `|${dir}|${frame}|${scale}`
  if (kind === 'groom' || kind === 'bride') return kind + tail
  const a = normalizeAppearance(kind)
  return `${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}${tail}`
}

/**
 * 스프라이트 캔버스 (FOREST_W*scale x FOREST_H*scale 픽셀). 벡터라 어떤 scale 에서도 선명하다.
 * scale = 명목 1단위당 픽셀 수(소수 둘째 자리로 반올림해 캐시 키로 사용).
 */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame, scale: number = DEFAULT_SCALE): HTMLCanvasElement {
  const sc = Math.max(0.25, Math.round(scale * 100) / 100)
  const key = keyOf(kind, dir, frame, sc)
  const hit = cache.get(key)
  if (hit) return hit
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
  cache.set(key, canvas)
  return canvas
}
/** 배율이 바뀌었을 때(리사이즈 등) 이전 배율 캔버스를 비운다 */
export function clearSpriteCache(): void {
  cache.clear()
}

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
