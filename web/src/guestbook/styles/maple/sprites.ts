/**
 * 층 조립 → RGBA 버퍼 (DOM 없음). PART_DEFS / randomAppearance / normalizeAppearance 도 여기.
 *
 * 찍는 순서(뒤 → 앞):
 *   뒷머리 · 베일 → 먼 팔 → 다리+신발 → 몸통(+치마) → 가까운 팔 → 머리(얼굴) → 묶은 머리 → 앞머리 캡 → 액세서리
 * 뒷모습(up)은 얼굴 없이 캡이 머리를 덮고, 뒷머리가 맨 위에 온다.
 * 걷기 프레임에서는 다리를 뺀 상체 전체가 1px 내려간다.
 */
import type { Appearance, Dir, Frame, PartDef, SpriteKind, View } from './dims'
import { MAPLE_H, MAPLE_W } from './dims'
import { ACCESSORIES, type AccCtx, type AccDef } from './accessories'
import { CX, drawArm, drawFace, drawHead, drawLeg, makePose, type Pose } from './body'
import { HAIRS, drawCap, type HairCtx, type HairDef } from './hair'
import { GOWN, OUTFITS, TUXEDO, type OutfitDef } from './outfits'
import { FIX, HAIR_COLORS, OUTFIT_COLORS, SKINS, hex, lum, mix, tone, type RGB } from './palette'
import { Comp, Layer, flat, mat } from './raster'

export interface PixelBuffer {
  w: number
  h: number
  data: Uint8ClampedArray
}

const COUNTS: Record<keyof Appearance, number> = {
  skin: SKINS.length,
  hairStyle: HAIRS.length,
  hairColor: HAIR_COLORS.length,
  outfit: OUTFITS.length,
  outfitColor: OUTFIT_COLORS.length,
  accessory: ACCESSORIES.length,
}

export const PART_DEFS: PartDef[] = [
  { key: 'skin', label: '피부', options: SKINS.map((s) => ({ label: s.label, swatch: s.hex })) },
  { key: 'hairStyle', label: '머리 모양', options: HAIRS.map((h) => ({ label: h.label })) },
  { key: 'hairColor', label: '머리 색', options: HAIR_COLORS.map((s) => ({ label: s.label, swatch: s.hex })) },
  { key: 'outfit', label: '옷', options: OUTFITS.map((o) => ({ label: o.label })) },
  { key: 'outfitColor', label: '옷 색', options: OUTFIT_COLORS.map((s) => ({ label: s.label, swatch: s.hex })) },
  { key: 'accessory', label: '액세서리', options: ACCESSORIES.map((a) => ({ label: a.label })) },
]

const KEYS = Object.keys(COUNTS) as (keyof Appearance)[]

export function normalizeAppearance(a: Partial<Appearance> | null | undefined): Appearance {
  const out = { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0 }
  for (const k of KEYS) {
    const v = a?.[k]
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0
    out[k] = n >= 0 && n < COUNTS[k] ? n : 0
  }
  return out
}

export function randomAppearance(rnd: () => number = Math.random): Appearance {
  const pick = (n: number) => Math.min(n - 1, Math.floor(rnd() * n))
  return {
    skin: pick(COUNTS.skin),
    hairStyle: pick(COUNTS.hairStyle),
    hairColor: pick(COUNTS.hairColor),
    outfit: pick(COUNTS.outfit),
    outfitColor: pick(COUNTS.outfitColor),
    // 절반쯤은 액세서리 없이
    accessory: rnd() < 0.5 ? 0 : 1 + pick(COUNTS.accessory - 1),
  }
}

interface Spec {
  skin: RGB
  hair: HairDef
  hairColor: RGB
  outfit: OutfitDef
  color: RGB
  acc: AccDef
  special?: 'groom' | 'bride'
}

function specOf(kind: SpriteKind): Spec {
  if (kind === 'groom')
    return {
      skin: hex(SKINS[1].hex),
      hair: HAIRS[1],
      hairColor: hex('#3a3442'),
      outfit: TUXEDO,
      color: hex('#3e3c4c'),
      acc: ACCESSORIES[0],
      special: 'groom',
    }
  if (kind === 'bride')
    return {
      skin: hex(SKINS[1].hex),
      hair: HAIRS[6],
      hairColor: hex('#6a4632'),
      outfit: GOWN,
      color: FIX.white,
      acc: ACCESSORIES[0],
      special: 'bride',
    }
  const a = normalizeAppearance(kind)
  return {
    skin: hex(SKINS[a.skin].hex),
    hair: HAIRS[a.hairStyle],
    hairColor: hex(HAIR_COLORS[a.hairColor].hex),
    outfit: OUTFITS[a.outfit],
    color: hex(OUTFIT_COLORS[a.outfitColor].hex),
    acc: ACCESSORIES[a.accessory],
  }
}

const VIEW: Record<Dir, View> = { right: 'side', left: 'side', down: 'front', up: 'back' }

function veil(L: Layer, p: Pose): void {
  // 베일은 외곽선을 연하게 (얇은 천 느낌)
  const line = hex('#9aa6c6')
  const base = flat(hex('#f3f6fc'), line)
  const fold = flat(hex('#dfe6f4'), line)
  if (p.view === 'back') {
    // 뒷모습: 올림머리 아래에서 시작해 퍼지는 베일 (머리카락이 위로 보인다)
    L.span(15, 54, CX, (t) => 6 + 11 * Math.pow(t, 0.6), base)
  } else {
    const cx = CX - (p.view === 'side' ? 3 : 0)
    L.span(11, 55, cx, (t) => 12 + 6 * Math.pow(t, 0.8), base)
  }
  L.rim(base, fold, 0, 1, 2)
  L.on(() => {
    for (let x = 7; x <= 41; x += 5) L.col(x, 34, 54, fold)
  })
}

function bouquet(L: Layer, p: Pose): void {
  const cx = CX + p.f * 2
  const leaf = mat(FIX.leaf)
  const a = mat(FIX.pink)
  const b = mat(FIX.white)
  const c = mat(hex('#f4788c'))
  L.rect(cx - 0.5, 49, cx + 0.5, 52, leaf.sh)
  L.ell(cx, 46, 4.6, 3.6, leaf.b)
  L.on(() => {
    L.rect(cx - 3.5, 44, cx - 1.5, 46, a.b)
    L.rect(cx + 0.5, 43, cx + 2.5, 45, b.b)
    L.rect(cx - 1.5, 46, cx + 0.5, 48, c.b)
    L.rect(cx + 2.5, 46, cx + 3.5, 47, a.b)
    L.set(cx - 2.5, 45, a.sh)
    L.set(cx + 1.5, 44, b.sh)
    L.set(cx - 0.5, 47, c.sh)
  })
}

function tiara(L: Layer, a: AccCtx): void {
  const g = mat(FIX.gold)
  const x = a.hx + (a.view === 'side' ? 2 : 0)
  L.row(a.top + 2, x - 4, x + 4, g.b)
  for (const k of [-3, 0, 3]) L.col(x + k, a.top + (k ? 0 : -1), a.top + 1, g.b)
  L.set(x, a.top - 1, mat(FIX.white).b)
  L.rim(g.b, g.sh, 1, 0, 1)
}

export function buildBuffer(kind: SpriteKind, dir: Dir, frame: Frame): PixelBuffer {
  const s = specOf(kind)
  const view = VIEW[dir]
  const p = makePose(view, frame)
  if (s.special === 'bride' && view !== 'back') {
    // 부케를 두 손으로 모아 든다
    p.armL = { dx: 4 + p.f, dy: 0 }
    p.armR = { dx: -4 + p.f, dy: 0 }
  }
  const skin = mat(s.skin)
  const hairM = mat(s.hairColor)
  const C = mat(s.color)
  const W = mat(FIX.white)
  const o = s.outfit
  const sleeveM = mat(o.sleeveMat(s.color))
  const cuff = o.cuff ? mat(o.cuff(s.color)).b : undefined
  const legM = o.legs ? mat(o.legs(s.color)) : skin
  const shoeM = mat(o.shoe(s.color))
  const hx = CX - p.f
  const hctx: HairCtx = { view, f: p.f, hx, m: hairM, tie: mat(s.special === 'bride' ? FIX.white : FIX.red) }
  const actx: AccCtx = { view, f: p.f, hx, top: s.hair.top, fc: CX + 2 * p.f, hair: hairM }

  const out = new Comp()
  const bob = p.bob
  const layer = (fn: (L: Layer) => void, dy = bob, outline = true) => {
    const L = new Layer()
    fn(L)
    out.stamp(L, 0, dy, outline)
  }
  const hairBack = () => {
    if (s.hair.back) layer((L) => s.hair.back?.(L, hctx))
  }

  if (view !== 'back') {
    hairBack()
    if (s.special === 'bride') layer((L) => veil(L, p))
  }
  if (view === 'side') layer((L) => drawArm(L, 'R', p, o.sleeve, sleeveM, skin, cuff))
  layer((L) => drawLeg(L, 'B', p, legM, shoeM, o.wideLegs), 0)
  layer((L) => drawLeg(L, 'A', p, legM, shoeM, o.wideLegs), 0)
  layer((L) => o.draw({ L, view, cx: CX + p.f, C, base: s.color, skin, W }))
  layer((L) => drawArm(L, 'L', p, o.sleeve, sleeveM, skin, cuff))
  if (view !== 'side') layer((L) => drawArm(L, 'R', p, o.sleeve, sleeveM, skin, cuff))
  if (s.special === 'bride' && view !== 'back') layer((L) => bouquet(L, p))

  // 머리 + 앞머리: 앞머리 그림자를 얼굴에 드리우기 위해 두 층을 먼저 만든다
  const head = new Layer()
  drawHead(head, skin, p)
  const cap = new Layer()
  drawCap(cap, s.hair, hctx)
  if (view !== 'back') {
    for (let y = 2; y < MAPLE_H; y++)
      for (let x = 0; x < MAPLE_W; x++)
        if (head.get(x, y) === skin.b && cap.get(x, y - 2) && !cap.get(x, y) && !cap.get(x, y - 1)) head.set(x, y, skin.sh)
    drawFace(head, p, {
      eye: flat(hex('#2e2636')),
      // 어두운 피부에서는 홍채를 밝혀 눈이 묻히지 않게
      iris: flat(mix(mix(s.hairColor, hex('#5a4038'), 0.75), hex('#ffe8c8'), lum(s.skin) < 0.55 ? 0.38 : 0.08)),
      white: flat(hex('#ffffff')),
      brow: flat(mix(tone(s.hairColor, 0.8), s.skin, 0.25)),
      mouth: flat(mix(s.skin, hex('#b03848'), 0.62)),
      blush: flat(mix(s.skin, hex('#ff7890'), 0.4)),
    })
  }
  out.stamp(head, 0, bob)
  if (s.acc.neck) layer((L) => s.acc.neck?.(L, actx))
  if (s.hair.extra) layer((L) => s.hair.extra?.(L, hctx))
  out.stamp(cap, 0, bob)
  if (view === 'back') {
    hairBack()
    if (s.special === 'bride') layer((L) => veil(L, p))
  }
  if (s.acc.face) layer((L) => s.acc.face?.(L, actx), bob, false)
  if (s.acc.over) layer((L) => s.acc.over?.(L, actx))
  if (s.special === 'bride') layer((L) => tiara(L, actx))

  return { w: MAPLE_W, h: MAPLE_H, data: out.toRGBA(dir === 'left') }
}
