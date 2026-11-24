/**
 * "RPG 치비" 그림체 — 오픈 라이선스 도트(Stendhal 프로젝트의 Cabbit 풍 의상 레이어)를 그대로 겹쳐 쓴다.
 * 다른 그림체와 같은 계약: PART_DEFS / randomAppearance / normalizeAppearance / getSprite (+ load).
 *
 *  - 48x64 도트, 4방향(뒤·오른쪽·앞·왼쪽) x 3칸(걸음·정지·걸음). 모든 레이어가 같은 칸에 정렬돼 있어
 *    풍선·면사포(뒤) → 몸 → 옷 → 얼굴 → 안경·귀걸이 → 머리 → 모자 → 풍선(앞) 순서로 겹치기만 하면 된다.
 *  - 원본은 정지 칸이 걸음 칸보다 2도트 높이 그려져 있다. 그대로 쓰면 서 있을 때 그림자 위로 떠 보이므로
 *    정지 칸만 1도트 내려 그린다 (IDLE_DY) — 걸을 때 1도트 들썩이는 정도만 남는다.
 *  - 피부는 다섯 색을 1:1 로 바꾸고, 머리·옷은 "밝기 순위 → 목표 색 띠" 로 다시 칠한다
 *    (색마다의 순위는 빌드 때 계산해 atlas.ts 에 들어 있다). 옷 색 0번은 그림 원래 색.
 *  - 아틀라스 한 장을 먼저 받아야 하므로 load() 가 끝난 뒤에만 그릴 수 있다 (등록부가 기다려 준다).
 * 에셋(assets/atlas.png·atlas.ts)은 art/cabbit/build.py 로 다시 만든다. 출처·라이선스: art/cabbit/LICENSE.md
 */
import type { AppearanceParts, PartKey } from '../../types'
import type { Dir, Frame, PartDef, SpriteKind } from '../../character'
import { ATLAS } from './assets/atlas'
import type { ColourRank } from './assets/atlas'
import atlasUrl from './assets/atlas.png'

export type { Dir, Frame, PartDef, SpriteKind }

/** 스프라이트 원본 크기 / 발바닥 행 */
export const CABBIT_W = ATLAS.cell[0]
export const CABBIT_H = ATLAS.cell[1]
export const CABBIT_FOOT_Y = 63
/** 정지 칸을 아래로 내려 그리는 양 (도트). 원본의 정지 칸은 발이 60행, 걸음 칸은 62행에 닿는다 */
const IDLE_DY = 1

/* ── 색 ──────────────────────────────────────────────────── */

interface Ramp {
  label: string
  /** 어두운 색 → 밝은 색 (0xRRGGBB) */
  stops: readonly number[]
}
const hx = (s: string): number => parseInt(s, 16)
const ramp = (label: string, stops: string): Ramp => ({ label, stops: stops.split(' ').map(hx) })
const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`

/** 피부: 외곽선 → 가장 밝은 색. 3번이 원본 그림의 색 */
const SKINS: Ramp[] = [
  ramp('밝은 톤', '613c00 985941 e48676 f2b586 ffdab0'),
  ramp('뽀얀 톤', '6e4a2c a8705a eba791 f9cdb2 ffe8d6'),
  ramp('웜 베이지', '5e3a0c 8f5638 d2876a e6a97c f4c99a'),
  ramp('허니', '56330c 794833 a86a52 c28d56 d2a975'),
  ramp('브론즈', '44260c 643a26 8a5238 a66f44 bd8a5a'),
  ramp('딥 브라운', '2e1808 47281c 653a28 7e4f30 99683f'),
]

const HAIR_COLORS: Ramp[] = [
  ramp('흑발', '0b0b10 1b1b24 2c2c38 424250 5e5e6e'),
  ramp('흑갈색', '160c07 2e1c12 49301e 60422a 80603e'),
  ramp('브라운', '2f1206 55220c 7a3e20 99501f b7793d'),
  ramp('오렌지 브라운', '3a0c02 6a2408 96401a b85e2a d98a4e'),
  ramp('카라멜', '4a2c12 7a4e24 a27636 c2924a e0b673'),
  ramp('금발', '732910 d56210 f6a418 ffcd31 ffe683'),
  ramp('애쉬 그레이', '34343e 585864 80808c a4a4ae c8c8d0'),
  ramp('은발', '70707f a2a2b2 c8c8d4 e2e2ea f8f8fc'),
  ramp('로즈 핑크', '7a2c48 b84a70 e07a9c f2a2bc fccbd9'),
  ramp('와인', '2e0a14 561224 7e1e36 a2304c c65470'),
  ramp('민트 블루', '164a52 2a7a84 4aa8ae 7fcfd0 b4ecea'),
]

/** 옷 색: 0번은 "원래 색". 나머지는 기준색 하나에서 어두운 색~밝은 색 띠를 만든다 */
interface OutfitColor {
  label: string
  swatch: string
  stops: readonly number[] | null
}
function tone(label: string, hex: string): OutfitColor {
  const c = hx(hex)
  const ch = [(c >> 16) & 255, (c >> 8) & 255, c & 255]
  const mul = (f: number) => ch.reduce((acc, v) => (acc << 8) | Math.round(Math.min(255, v * f)), 0)
  const lift = (f: number) => ch.reduce((acc, v) => (acc << 8) | Math.round(v + (255 - v) * f), 0)
  return { label, swatch: `#${hex}`, stops: [mul(0.3), mul(0.55), mul(0.8), c, lift(0.35)] }
}
const OUTFIT_COLORS: OutfitColor[] = [
  { label: '원래 색', swatch: 'conic-gradient(#e13838, #e8b020, #3cc8a8, #4aa3e6, #9a78d8, #e13838)', stops: null },
  tone('레드', 'd63434'),
  tone('와인', '9c2244'),
  tone('핑크', 'f07ab0'),
  tone('머스타드', 'e6ac22'),
  tone('포레스트', '2f8a4e'),
  tone('민트', '3cc4a6'),
  tone('스카이', '4aa3e6'),
  tone('네이비', '2c3f8c'),
  tone('라벤더', '9a7ad8'),
  tone('차콜', '4a4a56'),
  tone('크림', 'f2e6cc'),
]

const BALD = ATLAS.hairs.length
const COUNTS: Record<PartKey, number> = {
  skin: SKINS.length,
  hairStyle: ATLAS.hairs.length + 1,
  hairColor: HAIR_COLORS.length,
  outfit: ATLAS.outfits.length,
  outfitColor: OUTFIT_COLORS.length,
  accessory: ATLAS.accs.length + 1,
}

export const PART_DEFS: PartDef[] = [
  { key: 'hairStyle', label: '머리 모양', options: [...ATLAS.hairs.map((h) => ({ label: h.name })), { label: '민머리' }] },
  { key: 'hairColor', label: '머리 색', options: HAIR_COLORS.map((c) => ({ label: c.label, swatch: css(c.stops[2]) })) },
  { key: 'outfit', label: '의상', options: ATLAS.outfits.map((o) => ({ label: o.name })) },
  { key: 'outfitColor', label: '의상 색', options: OUTFIT_COLORS.map((c) => ({ label: c.label, swatch: c.swatch })) },
  { key: 'accessory', label: '액세서리', options: [{ label: '없음' }, ...ATLAS.accs.map((a) => ({ label: a.name }))] },
  { key: 'skin', label: '피부', options: SKINS.map((c) => ({ label: c.label, swatch: css(c.stops[3]) })) },
]

function clamp(v: unknown, n: number): number {
  const i = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0
  return i < 0 ? 0 : i > n - 1 ? n - 1 : i
}

export function normalizeAppearance(input: AppearanceParts): AppearanceParts {
  return {
    skin: clamp(input?.skin, COUNTS.skin),
    hairStyle: clamp(input?.hairStyle, COUNTS.hairStyle),
    hairColor: clamp(input?.hairColor, COUNTS.hairColor),
    outfit: clamp(input?.outfit, COUNTS.outfit),
    outfitColor: clamp(input?.outfitColor, COUNTS.outfitColor),
    accessory: clamp(input?.accessory, COUNTS.accessory),
  }
}

/** 신랑·신부 몫: 옷 0(턱시도)·1(웨딩드레스), 액세서리 맨 끝(면사포) */
const GUEST_OUTFIT_FROM = 2
const VEIL = ATLAS.accs.length
/** 신부 머리: 올림머리 (원본 050) */
const BRIDE_HAIR = Math.max(0, ATLAS.hairs.findIndex((h) => h.src === '050'))

/** 하객용 랜덤: 턱시도·웨딩드레스·면사포·민머리는 빼고, 옷은 대체로 원래 색, 액세서리는 절반쯤 없음 */
export function randomAppearance(rnd: () => number = Math.random): AppearanceParts {
  const pick = (n: number) => Math.min(n - 1, Math.floor(rnd() * n))
  return {
    skin: rnd() < 0.8 ? pick(3) : pick(COUNTS.skin),
    hairStyle: pick(COUNTS.hairStyle - 1),
    hairColor: rnd() < 0.7 ? pick(6) : pick(COUNTS.hairColor),
    outfit: GUEST_OUTFIT_FROM + pick(COUNTS.outfit - GUEST_OUTFIT_FROM),
    outfitColor: rnd() < 0.55 ? 0 : 1 + pick(COUNTS.outfitColor - 1),
    accessory: rnd() < 0.5 ? 0 : 1 + pick(COUNTS.accessory - 2),
  }
}

function lookOf(kind: SpriteKind): AppearanceParts {
  // 신랑: 턱시도 + 짧은 흑발 / 신부: 흰 웨딩드레스 + 올림머리(흑갈색) + 면사포
  if (kind === 'groom') return { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0 }
  if (kind === 'bride') return { skin: 0, hairStyle: BRIDE_HAIR, hairColor: 1, outfit: 1, outfitColor: 0, accessory: VEIL }
  return normalizeAppearance(kind)
}

/* ── 아틀라스 불러오기 ───────────────────────────────────── */

let atlasImg: HTMLImageElement | null = null
/** 아틀라스 픽셀 (다시 칠할 때 읽는다) */
let atlasPx: ImageData | null = null
let loading: Promise<void> | null = null

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했어요: ${url}`))
    img.src = url
  })
}

/** 아틀라스를 불러온다 (여러 번 불러도 한 번만 받는다). 실패하면 다음 호출에서 다시 시도 */
export function load(): Promise<void> {
  if (atlasImg && atlasPx) return Promise.resolve()
  loading ??= loadImage(atlasUrl)
    .then((img) => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('캔버스를 만들 수 없어요.')
      ctx.drawImage(img, 0, 0)
      atlasPx = ctx.getImageData(0, 0, c.width, c.height)
      atlasImg = img
    })
    .finally(() => {
      loading = null
    })
  return loading
}

/** load() 가 끝나 바로 그릴 수 있는지 */
export function isReady(): boolean {
  return atlasImg !== null && atlasPx !== null
}

/* ── 다시 칠하기 ─────────────────────────────────────────── */

/** 띠(stops)에서 위치 t(0~1)의 색 — 이웃한 두 색을 섞는다 */
function rampAt(stops: readonly number[], t: number): number {
  const p = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(p))
  const f = p - i
  const a = stops[i]
  const b = stops[i + 1]
  const mix = (sh: number) => Math.round(((a >> sh) & 255) * (1 - f) + ((b >> sh) & 255) * f)
  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}

function rankMap(ranks: readonly ColourRank[], stops: readonly number[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const [c, t] of ranks) m.set(c, rampAt(stops, t))
  return m
}

function skinMap(skin: number): Map<number, number> | null {
  const to = SKINS[skin].stops
  const m = new Map<number, number>()
  ATLAS.skin.forEach((c, i) => {
    if (c !== to[i]) m.set(c, to[i])
  })
  return m.size > 0 ? m : null
}

/** 아틀라스의 한 구역(3x4칸)을 잘라 색 지도대로 바꿔 칠한 캔버스. 지도가 없으면 그림 그대로 */
function recolored(sheet: number, map: Map<number, number> | null): HTMLCanvasElement {
  const [ax, ay, , , cw, ch] = ATLAS.sheets[sheet]
  const w = cw * 3
  const h = ch * 4
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx || !atlasImg || !atlasPx) return c
  if (!map) {
    ctx.drawImage(atlasImg, ax, ay, w, h, 0, 0, w, h)
    return c
  }
  const out = ctx.createImageData(w, h)
  const src = atlasPx.data
  const W = atlasPx.width
  const dst = out.data
  for (let j = 0; j < h; j++) {
    let s = ((ay + j) * W + ax) * 4
    let d = j * w * 4
    for (let i = 0; i < w; i++, s += 4, d += 4) {
      const a = src[s + 3]
      if (a === 0) continue
      const from = (src[s] << 16) | (src[s + 1] << 8) | src[s + 2]
      const to = map.get(from) ?? from
      dst[d] = to >> 16
      dst[d + 1] = (to >> 8) & 255
      dst[d + 2] = to & 255
      dst[d + 3] = a
    }
  }
  ctx.putImageData(out, 0, 0)
  return c
}

/* ── 캐시 ────────────────────────────────────────────────── */

/** 다시 칠한 레이어 (구역 단위, 방향·프레임 12칸을 함께) */
const layerCache = new Map<string, HTMLCanvasElement>()
const LAYER_CACHE_MAX = 160
function layer(key: string, sheet: number, makeMap: () => Map<number, number> | null): HTMLCanvasElement {
  const hit = layerCache.get(key)
  if (hit) {
    layerCache.delete(key)
    layerCache.set(key, hit)
    return hit
  }
  const c = recolored(sheet, makeMap())
  layerCache.set(key, c)
  if (layerCache.size > LAYER_CACHE_MAX) {
    const first = layerCache.keys().next().value
    if (first !== undefined) layerCache.delete(first)
  }
  return c
}

/** 완성된 스프라이트 (외형·방향·프레임·배율) */
const cache = new Map<string, HTMLCanvasElement>()
const CACHE_MAX = 1200

export function clearSpriteCache(): void {
  cache.clear()
  layerCache.clear()
}

/* ── 그리기 ──────────────────────────────────────────────── */

/** 원본 시트의 행: 0 뒤, 1 오른쪽, 2 앞, 3 왼쪽 */
const ROW: Record<Dir, number> = { up: 0, right: 1, down: 2, left: 3 }
/** 프레임 → 열: 0 정지(가운데 칸), 1·2 걸음(양옆 칸) */
const COL: readonly number[] = [1, 0, 2]

function blit(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, sheet: number, row: number, col: number): void {
  const r = ATLAS.sheets[sheet]
  const w = r[4]
  const h = r[5]
  ctx.drawImage(img, col * w, row * h, w, h, r[2], r[3] + (col === 1 ? IDLE_DY : 0), w, h)
}

function compose(a: AppearanceParts, dir: Dir, frame: Frame): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CABBIT_W
  canvas.height = CABBIT_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const row = ROW[dir]
  const col = COL[frame] ?? 1
  const put = (key: string, sheet: number, makeMap: () => Map<number, number> | null = () => null) =>
    blit(ctx, layer(key, sheet, makeMap), sheet, row, col)

  const outfit = ATLAS.outfits[a.outfit]
  const acc = a.accessory > 0 ? ATLAS.accs[a.accessory - 1] : null
  const skin = () => skinMap(a.skin)

  if (acc && acc.rear !== undefined) put(`r${a.accessory}`, acc.rear)
  const body = ATLAS.bodies[outfit.body] ?? ATLAS.bodies[0]
  put(`b${outfit.body},${a.skin}`, body.s, skin)
  const tint = OUTFIT_COLORS[a.outfitColor].stops
  put(`o${a.outfit},${a.outfitColor}`, outfit.s, () => (tint ? rankMap(outfit.map, tint) : null))
  put(`f${a.skin}`, ATLAS.head.s, skin)
  if (acc && acc.layer === 'mask') put(`a${a.accessory}`, acc.s)
  if (a.hairStyle !== BALD) {
    const hair = ATLAS.hairs[a.hairStyle]
    put(`h${a.hairStyle},${a.hairColor}`, hair.s, () => rankMap(hair.map, HAIR_COLORS[a.hairColor].stops))
  }
  if (acc && acc.layer !== 'mask') put(`a${a.accessory}`, acc.s)
  return canvas
}

/**
 * 스프라이트 캔버스 (캐시됨). scale = 1 이면 48x64 원본, 정수 scale 을 주면 최근접 이웃으로 미리 확대한 캔버스.
 * load() 가 끝나기 전에는 빈 캔버스를 돌려준다 (캐시하지 않으므로 받은 뒤 다시 부르면 그림이 나온다).
 */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame, scale: number = 1): HTMLCanvasElement {
  const sc = Number.isFinite(scale) ? Math.min(8, Math.max(1, Math.round(scale))) : 1
  if (!isReady()) {
    const blank = document.createElement('canvas')
    blank.width = CABBIT_W * sc
    blank.height = CABBIT_H * sc
    return blank
  }
  const a = lookOf(kind)
  const key = `${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}|${dir}${frame}@${sc}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  let canvas: HTMLCanvasElement
  if (sc === 1) {
    canvas = compose(a, dir, frame)
  } else {
    canvas = document.createElement('canvas')
    canvas.width = CABBIT_W * sc
    canvas.height = CABBIT_H * sc
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(getSprite(a, dir, frame, 1), 0, 0, canvas.width, canvas.height)
    }
  }
  cache.set(key, canvas)
  if (cache.size > CACHE_MAX) {
    const first = cache.keys().next().value
    if (first !== undefined) cache.delete(first)
  }
  return canvas
}
