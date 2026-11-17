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
import { FIX, HAIR_COLORS, OUTFIT_COLORS, SKINS, hex, lum, mix, ramp, tone, type RGB } from './palette'
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

const VEIL = { line: hex('#98a2c4'), base: hex('#f6f8fd'), fold: hex('#dbe2f2'), lace: hex('#ffffff') }

function veil(L: Layer, p: Pose): void {
  // 베일은 외곽선을 연하게 (얇은 천 느낌). 주름은 머리에서 밑단으로 퍼지고, 밑단은 레이스 물결
  const base = flat(VEIL.base, VEIL.line)
  const fold = flat(VEIL.fold, VEIL.line)
  const lace = flat(VEIL.lace, VEIL.line)
  const back = p.view === 'back'
  const cx = CX - (p.view === 'side' ? 3 : 0)
  const y0 = back ? 15 : 11
  const y1 = back ? 56 : 55
  const n = y1 - y0
  const at = (y: number) => {
    const t = (y - y0) / n
    return {
      c: cx + Math.round(p.sway * 1.5 * t * t),
      hw: back ? 5.5 + 9 * Math.pow(t, 0.45) + 5 * t * t : 12 + 6.5 * Math.pow(t, 0.8),
      t,
    }
  }
  for (let y = y0; y <= y1; y++) {
    const { c, hw } = at(y)
    L.row(y, Math.ceil(c - hw), Math.floor(c + hw), base)
  }
  const end = at(y1)
  for (let x = Math.ceil(end.c - end.hw); x <= end.c + end.hw; x++) if (((x % 4) + 4) % 4 === 0) L.erase(x, y1)
  L.on(() => {
    for (const q of back ? [-0.86, -0.6, -0.3, 0.02, 0.34, 0.62, 0.88] : [-0.9, -0.72, 0.72, 0.9])
      for (let y = y0 + Math.round(n * (back ? 0.12 : 0.35)); y <= y1; y++) {
        const { c, hw, t } = at(y)
        // 주름선은 군데군데 끊긴다
        if (back && Math.round(t * 40 + q * 10) % 9 === 0) continue
        L.set(c + q * hw, y, fold)
      }
    if (back) {
      // 짧은 윗단(블러셔)의 물결 끝선 → 두 겹 베일
      const mid = y0 + Math.round(n * 0.52)
      for (let x = 0; x < 48; x++) {
        const yy = mid + [0, 1, 2, 1][((x % 4) + 4) % 4] + Math.round(Math.abs(x - at(mid).c) * 0.18)
        L.set(x, yy, fold)
        L.set(x, yy - 1, lace)
      }
    }
    for (let x = 0; x < 48; x++) {
      L.set(x, y1 - 1, lace)
      L.set(x, y1 - 2, x % 2 ? fold : lace)
      if (x % 4 === 2) L.set(x, y1 - 4, lace)
    }
    L.row(y1, 0, 47, fold)
  })
}

function bouquet(L: Layer, p: Pose): void {
  const cx = CX + p.f * 2
  const leaf = mat(FIX.leaf)
  const pink = mat(hex('#f890ac'))
  const white = mat(FIX.white)
  const peach = mat(hex('#fbbf9a'))
  const rib = mat(hex('#f4b4c4'))
  // 손잡이 리본
  L.rect(cx - 0.5, 50, cx + 0.5, 51, white.b)
  for (let y = 51; y <= 55; y++) L.set(cx - 1.5 + (y > 53 ? p.sway : 0), y, rib.b)
  for (let y = 51; y <= 53; y++) L.set(cx + 1.5, y, rib.sh)
  L.ell(cx, 46, 5.6, 4.2, leaf.b)
  L.rim(leaf.b, leaf.sh, 0, 1, 1)
  const blob = (dx: number, dy: number, m: typeof pink) => {
    const x = cx + dx
    const y = 46 + dy
    L.rect(x - 1, y - 1, x + 1, y + 1, m.b)
    L.set(x - 1, y - 1, m.hi)
    L.set(x + 1, y + 1, m.sh)
    L.set(x, y, m.sh)
  }
  L.on(() => {
    blob(-3.5, -0.5, pink)
    blob(-0.5, -2, white)
    blob(2.5, -1, peach)
    blob(-1.5, 1.5, peach)
    blob(1.5, 1.5, pink)
    blob(4, 1, white)
  })
}

function tiara(L: Layer, a: AccCtx): void {
  const g = mat(FIX.gold)
  const x = a.hx + (a.view === 'side' ? 2 : 0)
  const t = a.top
  L.row(t + 2, x - 5, x + 5, g.b)
  L.row(t + 1, x - 4, x + 4, g.b)
  for (const k of [-4, -2, 0, 2, 4]) L.col(x + k, t - (k === 0 ? 2 : Math.abs(k) === 2 ? 1 : 0), t + 1, g.b)
  L.rim(g.b, g.sh, 0, 1, 1)
  L.on(() => {
    L.set(x, t - 1, mat(hex('#f890ac')).b)
    L.set(x, t - 2, g.hi)
    L.set(x - 2, t, mat(FIX.white).b)
    L.set(x + 2, t, mat(FIX.white).b)
    L.set(x - 4, t + 1, g.hi)
  })
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
  const tie = o.legTie ? mat(o.legTie(s.color)).b : undefined
  const hx = CX - p.f
  const hctx: HairCtx = { view, f: p.f, hx, m: hairM, tie: mat(s.special === 'bride' ? FIX.white : FIX.red) }
  const actx: AccCtx = { view, f: p.f, hx, top: s.hair.top, fc: CX + 2 * p.f, hair: hairM }

  const out = new Comp()
  const bob = p.bob
  const layer = (
    fn: (L: Layer) => void,
    dy = bob,
    outline = true,
    tint?: (under: number, c: number) => number | undefined,
  ) => {
    const L = new Layer()
    fn(L)
    out.stamp(L, 0, dy, outline, tint)
  }
  const hairBack = () => {
    if (s.hair.back) layer((L) => s.hair.back?.(L, hctx))
  }

  if (view !== 'back') {
    hairBack()
    if (s.special === 'bride') layer((L) => veil(L, p))
  }
  if (view === 'side') layer((L) => drawArm(L, 'R', p, o.sleeve, sleeveM, skin, cuff))
  layer((L) => drawLeg(L, 'B', p, legM, shoeM, o.legStyle, tie), 0)
  layer((L) => drawLeg(L, 'A', p, legM, shoeM, o.legStyle, tie), 0)
  layer((L) => o.draw({ L, view, frame, sway: p.sway, cx: CX + p.f, C, base: s.color, skin, W }))
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
    // 어두운 피부: 흰자·밝은 눈꺼풀 선·밝은 홍채로 눈이 묻히지 않게
    const dark = lum(s.skin) < 0.55
    drawFace(head, p, {
      eye: flat(hex('#2e2636')),
      iris: flat(mix(mix(s.hairColor, hex('#5a4038'), 0.75), hex('#ffe8c8'), dark ? 0.5 : 0.08)),
      white: flat(hex('#ffffff')),
      brow: flat(dark ? mix(tone(s.hairColor, 0.7), hex('#241c26'), 0.45) : mix(tone(s.hairColor, 0.8), s.skin, 0.25)),
      mouth: flat(mix(s.skin, dark ? hex('#f07080') : hex('#b03848'), dark ? 0.5 : 0.62)),
      blush: flat(mix(s.skin, hex('#ff7890'), 0.4)),
      sclera: dark ? flat(hex('#f8ecdf')) : undefined,
      lid: dark ? flat(mix(s.skin, hex('#ffe6cc'), 0.3)) : undefined,
      lash: s.special === 'bride',
    })
    if (s.special === 'bride' && view === 'front') {
      // 귀걸이
      const pearl = flat(hex('#ffffff'), hex('#8a84a6'))
      head.set(12, 30, pearl)
      head.set(35, 30, pearl)
    }
  }
  out.stamp(head, 0, bob)
  if (s.acc.neck) layer((L) => s.acc.neck?.(L, actx))
  if (s.hair.extra) layer((L) => s.hair.extra?.(L, hctx))
  out.stamp(cap, 0, bob)
  if (view === 'back') {
    if (!s.hair.backMerge) hairBack()
    if (s.special === 'bride') {
      // 베일 너머로 머리카락이 비쳐 보인다 (주름선은 조금 더 밝게)
      const hr = ramp(s.hairColor)
      const ids = [hairM.hi, hairM.b, hairM.sh, hairM.ln]
      const warm = hex('#fff2e8')
      const thin = hr.map((c, k) => flat(mix(c, warm, k === 3 ? 0.6 : 0.68)))
      const thick = hr.map((c) => flat(mix(c, warm, 0.8)))
      const foldId = flat(VEIL.fold, VEIL.line)
      const tint = (under: number, c: number) => {
        const k = ids.indexOf(under)
        return k < 0 ? undefined : c === foldId ? thick[k] : thin[k]
      }
      layer((L) => veil(L, p), bob, true, tint)
    }
  }
  if (s.acc.face) layer((L) => s.acc.face?.(L, actx), bob, false)
  if (s.acc.over) layer((L) => s.acc.over?.(L, actx))
  if (s.special === 'bride') layer((L) => tiara(L, actx))

  return { w: MAPLE_W, h: MAPLE_H, data: out.toRGBA(dir === 'left') }
}
