/**
 * 층 조립 + 색 해석 → RGBA 버퍼. DOM 없는 순수 코어(테스트 가능).
 * randomAppearance / normalizeAppearance / PART_DEFS 도 여기서.
 *
 * 조립: 다리(lower) 와 상체(upper: 머리·몸통·팔·치마·머리카락·액세서리)를 따로 그린 뒤,
 * 걷기 프레임에서는 upper 를 통째로 1px 내려 합친다 → 머리는 흔들림 없이 몸과 함께 bob.
 */
import type { Appearance } from '../types'
import type { Dir, Frame, PartDef, SpriteKind, View } from './dims'
import { SPRITE_H, SPRITE_W } from './dims'
import { ACCESSORIES, drawAccessory } from './accessories'
import {
  castHairShadow,
  drawArmSideFar,
  drawArmSideNear,
  drawArmsFront,
  drawFace,
  drawHead,
  drawLegs,
  drawNeck,
  drawTorsoSkin,
} from './body'
import { blit, makeGrid, makeLut, setColor, setRamp, toRGBA, type Grid, type Lut } from './grid'
import { HAIRS, drawHairOver, drawHairUnder } from './hair'
import { OUTFITS, drawSkirt, drawTorso, type OutfitDef } from './outfits'
import { FIXED, HAIR_COLORS, OUTFIT_COLORS, SKINS, hexToRgb, mix, ramp, type RGB, type Ramp } from './palette'
import {
  BRIDE_COLORS,
  BRIDE_VEIL,
  BRIDE_WHITE,
  GROOM_COLORS,
  GROOM_HAIR,
  TUXEDO,
  drawBrideBody,
  drawBrideHair,
  drawBrideOver,
  drawBrideSkirt,
  drawBrideUnder,
} from './special'

export interface PixelBuffer {
  w: number
  h: number
  data: Uint8ClampedArray // RGBA, 길이 w*h*4
}

const COUNTS = {
  skin: SKINS.length,
  hairStyle: HAIRS.length,
  hairColor: HAIR_COLORS.length,
  outfit: OUTFITS.length,
  outfitColor: OUTFIT_COLORS.length,
  accessory: ACCESSORIES.length,
} as const

/* ── 색 해석표 ───────────────────────────────────────────── */
interface LutOpts {
  skin: RGB
  hair: RGB
  cloth: RGB
  e: RGB
  t: RGB
  q: RGB
  shoe: RGB
  acc?: RGB
  acc2?: RGB
  /** 신부 전용: 흰 천(W)·제4색(1234 = 베일) 램프를 직접 지정 */
  whiteRamp?: Ramp
  qRamp?: Ramp
}

function buildLut(o: LutOpts): Lut {
  const lut = makeLut()
  const sk = ramp(o.skin)
  // 피부 음영은 부드럽게 (얼굴이 얼룩져 보이지 않도록)
  const skin = [sk[0], sk[1], mix(sk[1], sk[2], 0.72), sk[3]] as const
  setRamp(lut, 'KkjJ', skin)
  setRamp(lut, 'HhgG', ramp(o.hair))
  setRamp(lut, 'CcbB', ramp(o.cloth))
  setRamp(lut, 'EedD', ramp(o.e))
  setRamp(lut, 'TtrR', ramp(o.t))
  const q = o.qRamp ?? ramp(o.q)
  // 베일은 외곽선을 한 톤 옅게 (가볍고 비치는 느낌)
  setRamp(lut, '1234', q, o.qRamp ? mix(q[2], q[3], 0.6) : q[3])
  const white = ramp(FIXED.white)
  setRamp(lut, 'WwvV', o.whiteRamp ?? [FIXED.eyeWhite, white[1], white[2], white[3]])
  setRamp(lut, 'OonN', ramp(o.shoe))
  if (o.acc) setRamp(lut, 'AazZ', ramp(o.acc))
  if (o.acc2) setRamp(lut, 'QqpP', ramp(o.acc2))
  const gold = ramp(FIXED.gold)
  setColor(lut, 'Y', gold[0], gold[3])
  setColor(lut, 'y', gold[1], gold[3])
  setColor(lut, '&', gold[2], gold[3])
  const fl = ramp(FIXED.flower)
  setColor(lut, 'F', fl[0], fl[3])
  setColor(lut, 'f', fl[1], fl[3])
  setColor(lut, '*', fl[2], fl[3])
  const leaf = ramp(FIXED.leaf)
  setColor(lut, 'L', leaf[0], leaf[3])
  setColor(lut, 'l', leaf[1], leaf[3])
  // 얼굴
  setColor(lut, 'x', mix(FIXED.eye, skin[3], 0.15), skin[3])
  setColor(lut, 'X', FIXED.eyeWhite, skin[3])
  setColor(lut, 'u', mix(o.skin, hexToRgb('#ee7f86'), 0.42), skin[3])
  setColor(lut, 'm', mix(sk[2], hexToRgb('#b0444c'), 0.6), skin[3])
  return lut
}

/* ── 조립 ───────────────────────────────────────────────── */
function viewOf(dir: Dir): View {
  return dir === 'down' ? 'front' : dir === 'up' ? 'back' : 'side'
}

function merge(lower: Grid, upper: Grid, frame: Frame): Grid {
  blit(lower, upper, frame === 0 ? 0 : 1)
  return lower
}

/** 한복 바지 대님: 신발 바로 위 바짓단 한 줄을 주색 띠로 바꾼다 (모든 방향·프레임 공통). */
function tieAnkles(g: Grid): void {
  const isShoe = (v: number) => v === 111 || v === 110 || v === 79 || v === 78 // o n O N
  for (let y = 0; y < g.h - 1; y++) {
    for (let x = 0; x < g.w; x++) {
      const v = g.data[y * g.w + x]
      if (!isShoe(g.data[(y + 1) * g.w + x])) continue
      if (v === 101) g.data[y * g.w + x] = 99 // e → c
      else if (v === 100 || v === 68) g.data[y * g.w + x] = 98 // d D → b
    }
  }
}

function composeFigure(
  view: View,
  frame: Frame,
  hair: number,
  def: OutfitDef,
  accessory: number,
): Grid {
  const lower = makeGrid()
  const upper = makeGrid()
  drawLegs(lower, view, frame, def.legs, def.legRemap)
  if (def.ankleTie) tieAnkles(lower)

  if (view !== 'back') drawHairUnder(upper, view, hair)
  drawTorsoSkin(upper, view)
  if (view === 'side') drawArmSideFar(upper, frame, def.sleeve)
  drawNeck(upper, view)
  drawSkirt(upper, view, frame, def)
  drawTorso(upper, view, def)
  if (view === 'side') drawArmSideNear(upper, frame, def.sleeve)
  else drawArmsFront(upper, frame, def.sleeve, view === 'back')
  drawHead(upper, view)
  drawHairOver(upper, view, hair)
  castHairShadow(upper)
  drawFace(upper, view)
  drawAccessory(upper, view, accessory)
  return merge(lower, upper, frame)
}

function composeBride(view: View, frame: Frame): Grid {
  const lower = makeGrid()
  const upper = makeGrid()
  drawBrideUnder(upper, view)
  drawTorsoSkin(upper, view)
  drawNeck(upper, view)
  drawBrideSkirt(lower, view, frame)
  drawBrideBody(upper, view)
  drawHead(upper, view)
  drawBrideHair(upper, view)
  castHairShadow(upper)
  drawFace(upper, view)
  drawBrideOver(upper, view)
  return merge(lower, upper, frame)
}

function lutFor(kind: SpriteKind): Lut {
  if (kind === 'groom') {
    const c = TUXEDO.colors(GROOM_COLORS.cloth)
    return buildLut({ skin: GROOM_COLORS.skin, hair: GROOM_COLORS.hair, cloth: GROOM_COLORS.cloth, ...c })
  }
  if (kind === 'bride') {
    return buildLut({
      skin: BRIDE_COLORS.skin,
      hair: BRIDE_COLORS.hair,
      cloth: FIXED.white,
      e: FIXED.white,
      t: FIXED.gold,
      q: FIXED.white,
      whiteRamp: BRIDE_WHITE,
      qRamp: BRIDE_VEIL,
      shoe: FIXED.white,
    })
  }
  const primary = hexToRgb(OUTFIT_COLORS[kind.outfitColor].hex)
  const c = OUTFITS[kind.outfit].colors(primary)
  const acc = ACCESSORIES[kind.accessory]
  return buildLut({
    skin: hexToRgb(SKINS[kind.skin].hex),
    hair: hexToRgb(HAIR_COLORS[kind.hairColor].hex),
    cloth: c.c ?? primary,
    e: c.e,
    t: c.t,
    q: c.q,
    shoe: c.shoe,
    acc: acc.a,
    acc2: acc.q,
  })
}

function mirrorRGBA(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4
      const d = (y * w + (w - 1 - x)) * 4
      out[d] = src[s]
      out[d + 1] = src[s + 1]
      out[d + 2] = src[s + 2]
      out[d + 3] = src[s + 3]
    }
  }
  return out
}

/** DOM 없는 RGBA 버퍼 (테스트/오프스크린 렌더 공용). left 는 right 의 좌우 반전. */
export function buildBuffer(kind: SpriteKind, dir: Dir, frame: Frame): PixelBuffer {
  const view = viewOf(dir)
  let g: Grid
  let lut: Lut
  if (kind === 'groom') {
    g = composeFigure(view, frame, GROOM_HAIR, TUXEDO, 0)
    lut = lutFor(kind)
  } else if (kind === 'bride') {
    g = composeBride(view, frame)
    lut = lutFor(kind)
  } else {
    const a = normalizeAppearance(kind)
    g = composeFigure(view, frame, a.hairStyle, OUTFITS[a.outfit], a.accessory)
    lut = lutFor(a)
  }
  const data = toRGBA(g, lut)
  // left 는 색까지 해석한 right 를 통째로 좌우 반전 (외곽선 명암도 함께 뒤집혀 정확한 거울상)
  return { w: SPRITE_W, h: SPRITE_H, data: dir === 'left' ? mirrorRGBA(data, SPRITE_W, SPRITE_H) : data }
}

/* ── 랜덤 / 보정 ─────────────────────────────────────────── */
function randInt(rand: () => number, n: number): number {
  return Math.floor(rand() * n) % n
}

export function randomAppearance(rand: () => number = Math.random): Appearance {
  // 액세서리는 40% 확률로 '없음'(0) → 과하지 않은 조합
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
  if (!(i >= 0)) return 0 // 음수·-Infinity → 0
  if (i > max - 1) return max - 1 // 범위초과·+Infinity → 최대
  return i
}

/** 임의 입력(비객체·NaN·음수·소수·범위밖)을 유효 정수 Appearance 로 보정. */
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

/* ── 캐릭터 만들기 UI 용 파츠 정의 ─────────────────────────────── */
export const PART_DEFS: PartDef[] = [
  { key: 'hairStyle', label: '머리 모양', options: HAIRS.map((h) => ({ label: h.label })) },
  {
    key: 'hairColor',
    label: '머리 색',
    options: HAIR_COLORS.map((c) => ({ label: c.label, swatch: c.hex })),
  },
  { key: 'outfit', label: '의상', options: OUTFITS.map((o) => ({ label: o.label })) },
  {
    key: 'outfitColor',
    label: '의상 색',
    options: OUTFIT_COLORS.map((c) => ({ label: c.label, swatch: c.hex })),
  },
  { key: 'accessory', label: '액세서리', options: ACCESSORIES.map((a) => ({ label: a.label })) },
  { key: 'skin', label: '피부', options: SKINS.map((c) => ({ label: c.label, swatch: c.hex })) },
]
