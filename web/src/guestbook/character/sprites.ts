/**
 * 레이어 조립 + 색 해석 → RGBA 버퍼. DOM 없는 순수 코어(테스트 가능).
 * randomAppearance / normalizeAppearance / PART_DEFS 도 여기서.
 */
import type { Appearance } from '../types'
import type { Dir, Frame, PartDef, SpriteKind } from './dims'
import { SPRITE_H, SPRITE_W } from './dims'
import {
  BLUSH_HEX,
  EYE_HEX,
  GOLD_HEX,
  HAIR_COLORS,
  LIGHT_HEX,
  M,
  MOUTH_HEX,
  OUTFIT_COLORS,
  OUTLINE_HEX,
  SHOE_HEX,
  SKINS,
  darken,
  hexToRgb,
  lighten,
  type RGB,
  type RGBA,
} from './palette'
import {
  ACC_LABELS,
  COUNTS,
  HAIR_LABELS,
  OUTFIT_LABELS,
  drawBride,
  drawGroom,
  drawVeilBack,
  drawVeilFront,
  layerAccessory,
  layerBody,
  layerFace,
  layerHairBack,
  layerHairFront,
  layerOutfit,
} from './parts'
import { autoOutline, makeGrid, mirrorX, toRGBA, type Grid } from './grid'

export interface PixelBuffer {
  w: number
  h: number
  data: Uint8ClampedArray // RGBA, 길이 w*h*4
}

/* ── 액세서리 고정색 (Appearance 엔 accessoryColor 없음) ──────────── */
const ACC_COLORS: { acc: string; acc2: string }[] = [
  { acc: '#000000', acc2: '#000000' }, // 0 없음
  { acc: '#39343a', acc2: '#bcd6e6' }, // 1 안경
  { acc: '#2a2730', acc2: '#1c1b24' }, // 2 선글라스
  { acc: '#c24a5e', acc2: '#8f3346' }, // 3 리본
  { acc: '#e08aa0', acc2: '#b85f7d' }, // 4 꽃
  { acc: '#4b4f5b', acc2: '#6c7180' }, // 5 베레모
  { acc: '#3a456e', acc2: '#283156' }, // 6 보타이
  { acc: '#4b4f5b', acc2: '#e08aa0' }, // 7 헤드폰
]

function a(c: RGB): RGBA {
  return [c[0], c[1], c[2], 255]
}

/** 외형 → 재질별 RGBA LUT. */
function buildLut(opts: {
  skin: string
  hair: string
  cloth: string
  acc: string
  acc2: string
}): Record<number, RGBA> {
  const skin = hexToRgb(opts.skin)
  const hair = hexToRgb(opts.hair)
  const cloth = hexToRgb(opts.cloth)
  const cloth2 = darken(cloth, 0.62)
  const light = hexToRgb(LIGHT_HEX)
  const acc = hexToRgb(opts.acc)
  const acc2 = hexToRgb(opts.acc2)
  const shoe = hexToRgb(SHOE_HEX)
  const lut: Record<number, RGBA> = {}
  lut[M.OUTLINE] = a(hexToRgb(OUTLINE_HEX))
  lut[M.SKIN] = a(skin)
  lut[M.SKIN_SH] = a(darken(skin, 0.86))
  lut[M.SKIN_HI] = a(lighten(skin, 0.22))
  lut[M.HAIR] = a(hair)
  lut[M.HAIR_SH] = a(darken(hair, 0.72))
  lut[M.HAIR_HI] = a(lighten(hair, 0.28))
  lut[M.CLOTH] = a(cloth)
  lut[M.CLOTH_SH] = a(darken(cloth, 0.78))
  lut[M.CLOTH_HI] = a(lighten(cloth, 0.2))
  lut[M.CLOTH2] = a(cloth2)
  lut[M.CLOTH2_SH] = a(darken(cloth2, 0.78))
  lut[M.LIGHT] = a(light)
  lut[M.LIGHT_SH] = a(darken(light, 0.9))
  lut[M.EYE] = a(hexToRgb(EYE_HEX))
  lut[M.MOUTH] = a(hexToRgb(MOUTH_HEX))
  lut[M.BLUSH] = a(hexToRgb(BLUSH_HEX))
  lut[M.SHOE] = a(shoe)
  lut[M.SHOE_SH] = a(darken(shoe, 0.78))
  lut[M.ACC] = a(acc)
  lut[M.ACC_SH] = a(darken(acc, 0.72))
  lut[M.ACC2] = a(acc2)
  lut[M.LENS] = a(hexToRgb('#bcd6e6'))
  lut[M.GOLD] = a(hexToRgb(GOLD_HEX))
  return lut
}

/* ── 조립 ───────────────────────────────────────────────── */
/** right 를 그린 뒤 left 는 좌우반전으로 통일(얼굴/머리 방향 일관). */
function baseDir(dir: Dir): Dir {
  return dir === 'left' ? 'right' : dir
}

function composeGuest(app: Appearance, dir: Dir, frame: Frame): Grid {
  const g = makeGrid()
  layerHairBack(g, dir, app.hairStyle)
  layerBody(g, dir, frame)
  layerOutfit(g, dir, frame, app.outfit)
  // 치마 의상은 drawBodyBase 의 맨다리를 그대로 노출 → 추가 처리 불필요
  layerFace(g, dir)
  layerHairFront(g, dir, app.hairStyle)
  layerAccessory(g, dir, app.accessory)
  return g
}

function composeGroom(dir: Dir, frame: Frame): Grid {
  const g = makeGrid()
  layerBody(g, dir, frame)
  drawGroom(g, dir, frame)
  layerFace(g, dir)
  layerHairFront(g, dir, 7) // 숏컷
  return g
}

function composeBride(dir: Dir, frame: Frame): Grid {
  const g = makeGrid()
  drawVeilBack(g, dir)
  layerBody(g, dir, frame)
  drawBride(g, dir, frame)
  layerFace(g, dir)
  layerHairFront(g, dir, 4) // 올림머리
  drawVeilFront(g, dir)
  return g
}

function lutFor(kind: SpriteKind): Record<number, RGBA> {
  if (kind === 'groom') {
    return buildLut({
      skin: SKINS[1].hex,
      hair: '#2b2630',
      cloth: '#2f3038', // 턱시도
      acc: '#d98fa2', // 부토니에
      acc2: '#b85f7d',
    })
  }
  if (kind === 'bride') {
    return buildLut({
      skin: SKINS[1].hex,
      hair: '#45342a',
      cloth: LIGHT_HEX,
      acc: '#e08aa0', // 부케
      acc2: '#b85f7d',
    })
  }
  const acc = ACC_COLORS[kind.accessory] ?? ACC_COLORS[0]
  return buildLut({
    skin: SKINS[kind.skin]?.hex ?? SKINS[0].hex,
    hair: HAIR_COLORS[kind.hairColor]?.hex ?? HAIR_COLORS[0].hex,
    cloth: OUTFIT_COLORS[kind.outfitColor]?.hex ?? OUTFIT_COLORS[0].hex,
    acc: acc.acc,
    acc2: acc.acc2,
  })
}

function composeGrid(kind: SpriteKind, dir: Dir, frame: Frame): Grid {
  const bdir = baseDir(dir)
  let g: Grid
  if (kind === 'groom') g = composeGroom(bdir, frame)
  else if (kind === 'bride') g = composeBride(bdir, frame)
  else g = composeGuest(normalizeAppearance(kind), bdir, frame)
  if (dir === 'left') g = mirrorX(g)
  autoOutline(g)
  return g
}

/** DOM 없는 RGBA 버퍼 (테스트/오프스크린 렌더 공용). */
export function buildBuffer(kind: SpriteKind, dir: Dir, frame: Frame): PixelBuffer {
  const g = composeGrid(kind, dir, frame)
  return { w: SPRITE_W, h: SPRITE_H, data: toRGBA(g, lutFor(kind)) }
}

/* ── 랜덤 / 보정 ─────────────────────────────────────────── */
function randInt(rand: () => number, n: number): number {
  return Math.floor(rand() * n) % n
}

export function randomAppearance(rand: () => number = Math.random): Appearance {
  // 액세서리는 35% 확률로 '없음'(0) → 과하지 않은 조합
  const accessory = rand() < 0.35 ? 0 : randInt(rand, COUNTS.accessory - 1) + 1
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
  const n = typeof v === 'number' ? v : Number(v)
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
  { key: 'hairStyle', label: '머리 모양', options: HAIR_LABELS.map((label) => ({ label })) },
  {
    key: 'hairColor',
    label: '머리 색',
    options: HAIR_COLORS.map((c) => ({ label: c.label, swatch: c.hex })),
  },
  { key: 'outfit', label: '의상', options: OUTFIT_LABELS.map((label) => ({ label })) },
  {
    key: 'outfitColor',
    label: '의상 색',
    options: OUTFIT_COLORS.map((c) => ({ label: c.label, swatch: c.hex })),
  },
  { key: 'accessory', label: '액세서리', options: ACC_LABELS.map((label) => ({ label })) },
  { key: 'skin', label: '피부', options: SKINS.map((c) => ({ label: c.label, swatch: c.hex })) },
]
