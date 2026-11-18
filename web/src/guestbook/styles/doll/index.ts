/**
 * "도트 인형" 그림체 — 이미지 생성 도구(Gemini)로 뽑은 시트를 잘라 만든 파츠(머리·몸·액세서리)를 조합한다.
 * 다른 그림체와 같은 계약: PART_DEFS / randomAppearance / normalizeAppearance / getSprite.
 *
 *  - 머리(얼굴+헤어) 한 장 + 몸(옷) 한 장을 목에서 잇고, 액세서리를 얼굴 기준점(두 눈 사이)에 맞춰 올린다.
 *  - 머리 색·피부 색·옷 색은 마스크(R=머리카락, G=피부, B=옷의 주색)를 보고 픽셀 단위로 다시 칠한다.
 *  - 그림이 정면뿐이라 방향은 좌우 반전만 하고, 걷는 동작은 머리가 살짝 끄덕이는 것으로 대신한다.
 *  - 이미지를 먼저 불러와야 하므로 load() 가 끝난 뒤에만 getSprite 를 쓸 수 있다 (등록부가 기다려 준다).
 * 에셋은 art/gemini/build.py 로 다시 만든다.
 */
import type { AppearanceParts, PartKey } from '../../types'
import type { Dir, Frame, PartDef, SpriteKind } from '../../character'
import { ATLAS } from './assets/atlas'
import headsUrl from './assets/heads.png'
import headsMaskUrl from './assets/heads-mask.png'
import bodiesUrl from './assets/bodies.png'
import bodiesMaskUrl from './assets/bodies-mask.png'
import accUrl from './assets/acc.png'

export type { Dir, Frame, PartDef, SpriteKind }

/** 스프라이트 명목 크기 (아틀라스 픽셀 단위) */
export const DOLL_W = 190
export const DOLL_H = 336
/** 발바닥 선 / 가로 중심 / 두 눈 사이 기준점의 y */
export const DOLL_FOOT_Y = 329
const CX = DOLL_W / 2
const EYE_Y = 115

interface Swatch {
  label: string
  hex: string
}
const SKINS: Swatch[] = [
  { label: '밝은 톤', hex: '#fcd2be' },
  { label: '살구 톤', hex: '#f6c4a4' },
  { label: '웜 베이지', hex: '#ecb28c' },
  { label: '허니', hex: '#d99a70' },
  { label: '브론즈', hex: '#b47a56' },
  { label: '딥 브라운', hex: '#86563f' },
]
const HAIR_COLORS: Swatch[] = [
  { label: '흑갈색', hex: '#4a3a3a' },
  { label: '브라운', hex: '#6f4a40' },
  { label: '밤색', hex: '#8f5a3c' },
  { label: '카라멜', hex: '#b9814f' },
  { label: '허니 블론드', hex: '#e0b76c' },
  { label: '애쉬 그레이', hex: '#9b9aa3' },
  { label: '은발', hex: '#d6d2cc' },
  { label: '로즈 핑크', hex: '#e79aa6' },
  { label: '와인', hex: '#8c4250' },
  { label: '민트 블루', hex: '#7fb8b4' },
]
/** 0번은 "원래 색" — 그림 그대로 */
const OUTFIT_COLORS: Swatch[] = [
  { label: '원래 색', hex: 'conic-gradient(#f0a6b4, #e3b85a, #9fd3c0, #8fbbdc, #b3a0d6, #f0a6b4)' },
  { label: '네이비', hex: '#4b5a85' },
  { label: '차콜', hex: '#5a5560' },
  { label: '베이지', hex: '#d9bf9a' },
  { label: '와인', hex: '#a8505c' },
  { label: '포레스트', hex: '#5f8a66' },
  { label: '스카이', hex: '#8fbbdc' },
  { label: '핑크', hex: '#f0a6b4' },
  { label: '라벤더', hex: '#b3a0d6' },
  { label: '머스타드', hex: '#e3b85a' },
  { label: '민트', hex: '#9fd3c0' },
  { label: '크림', hex: '#f6ead6' },
]
/** 액세서리 위치: 두 눈 사이 기준점에서 그림 중심까지의 거리(dx, dy)와 배율. 0번은 '없음' */
const ACC_PLACE: { dx: number; dy: number; s: number }[] = [
  { dx: 0, dy: 3, s: 0.92 }, // 동그란 안경
  { dx: 0, dy: 3, s: 0.92 }, // 선글라스
  { dx: 30, dy: -56, s: 0.5 }, // 리본
  { dx: 0, dy: -50, s: 0.82 }, // 화관
  { dx: 0, dy: -62, s: 1 }, // 밀짚모자
  { dx: 3, dy: -62, s: 0.95 }, // 베레모
  { dx: 0, dy: -62, s: 0.6 }, // 티아라
  { dx: 0, dy: -22, s: 1.02 }, // 헤드폰
]

const COUNTS: Record<PartKey, number> = {
  skin: SKINS.length,
  hairStyle: ATLAS.heads.length,
  hairColor: HAIR_COLORS.length,
  outfit: ATLAS.bodies.length,
  outfitColor: OUTFIT_COLORS.length,
  accessory: ATLAS.acc.length + 1,
}

export const PART_DEFS: PartDef[] = [
  { key: 'hairStyle', label: '머리 모양', options: ATLAS.heads.map((h) => ({ label: h.name })) },
  { key: 'hairColor', label: '머리 색', options: HAIR_COLORS.map((c) => ({ label: c.label, swatch: c.hex })) },
  { key: 'outfit', label: '의상', options: ATLAS.bodies.map((b) => ({ label: b.name })) },
  { key: 'outfitColor', label: '의상 색', options: OUTFIT_COLORS.map((c) => ({ label: c.label, swatch: c.hex })) },
  { key: 'accessory', label: '액세서리', options: [{ label: '없음' }, ...ATLAS.acc.map((a) => ({ label: a.name }))] },
  { key: 'skin', label: '피부', options: SKINS.map((c) => ({ label: c.label, swatch: c.hex })) },
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

/** 하객용 랜덤: 턱시도·웨딩드레스는 빼고, 옷은 대체로 원래 색, 액세서리는 절반쯤 없음 */
export function randomAppearance(rnd: () => number = Math.random): AppearanceParts {
  const pick = (n: number) => Math.min(n - 1, Math.floor(rnd() * n))
  return {
    skin: pick(3),
    hairStyle: pick(COUNTS.hairStyle),
    hairColor: pick(5),
    outfit: 2 + pick(COUNTS.outfit - 2),
    outfitColor: rnd() < 0.6 ? 0 : 1 + pick(COUNTS.outfitColor - 1),
    accessory: rnd() < 0.5 ? 0 : 1 + pick(COUNTS.accessory - 1),
  }
}

function lookOf(kind: SpriteKind): AppearanceParts {
  if (kind === 'groom') return { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0 }
  if (kind === 'bride') return { skin: 0, hairStyle: 9, hairColor: 1, outfit: 1, outfitColor: 0, accessory: 7 }
  return normalizeAppearance(kind)
}

/* ── 이미지 불러오기 ─────────────────────────────────────── */

interface Sheet {
  img: HTMLImageElement
  /** 원본 픽셀 (다시 칠할 때 읽는다) */
  px: ImageData
  mask: ImageData
}
let heads: Sheet | null = null
let bodies: Sheet | null = null
let acc: HTMLImageElement | null = null
let loading: Promise<void> | null = null

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했어요: ${url}`))
    img.src = url
  })
}

function pixels(img: HTMLImageElement): ImageData {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('캔버스를 만들 수 없어요.')
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, c.width, c.height)
}

/** 파츠 이미지를 모두 불러온다 (여러 번 불러도 한 번만 받는다). 실패하면 다음 호출에서 다시 시도 */
export function load(): Promise<void> {
  if (heads && bodies && acc) return Promise.resolve()
  loading ??= Promise.all([headsUrl, headsMaskUrl, bodiesUrl, bodiesMaskUrl, accUrl].map(loadImage))
    .then(([h, hm, b, bm, a]) => {
      heads = { img: h, px: pixels(h), mask: pixels(hm) }
      bodies = { img: b, px: pixels(b), mask: pixels(bm) }
      acc = a
    })
    .finally(() => {
      loading = null
    })
  return loading
}

/* ── 다시 칠하기 ─────────────────────────────────────────── */

type RGB = readonly [number, number, number]
function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

/** 밝기 비율 f 로 색을 입힌다: 어두운 곳은 목표색을 어둡게, 밝은 곳(하이라이트)은 흰 쪽으로 */
function shade(t: RGB, f: number, i: number): number {
  if (f <= 1) return t[i] * f
  return t[i] + (255 - t[i]) * Math.min(1, (f - 1) * 0.6)
}

interface Tint {
  /** 마스크 채널 (0=R 머리카락, 1=G 피부, 2=B 옷) */
  ch: 0 | 1 | 2
  to: RGB
  /** 기준 밝기 (shade 방식) — 없으면 채널별 비율로 곱한다 (피부) */
  baseLum?: number
  from?: RGB
}

/** 아틀라스의 한 칸을 잘라, 마스크가 가리키는 부분만 다시 칠한 캔버스 */
function tinted(sheet: Sheet, rect: readonly number[], tints: Tint[]): HTMLCanvasElement {
  const [x, y, w, h] = rect
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return c
  if (tints.length === 0) {
    ctx.drawImage(sheet.img, x, y, w, h, 0, 0, w, h)
    return c
  }
  const out = ctx.createImageData(w, h)
  const src = sheet.px.data
  const mk = sheet.mask.data
  const W = sheet.px.width
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const s = ((y + j) * W + x + i) * 4
      const d = (j * w + i) * 4
      let r = src[s]
      let g = src[s + 1]
      let b = src[s + 2]
      for (const t of tints) {
        const m = mk[s + t.ch] / 255
        if (m < 0.02) continue
        let nr: number
        let ng: number
        let nb: number
        if (t.baseLum !== undefined) {
          const f = lum(r, g, b) / t.baseLum
          nr = shade(t.to, f, 0)
          ng = shade(t.to, f, 1)
          nb = shade(t.to, f, 2)
        } else {
          const from = t.from as RGB
          nr = Math.min(255, (r * t.to[0]) / from[0])
          ng = Math.min(255, (g * t.to[1]) / from[1])
          nb = Math.min(255, (b * t.to[2]) / from[2])
        }
        r += (nr - r) * m
        g += (ng - g) * m
        b += (nb - b) * m
      }
      out.data[d] = r
      out.data[d + 1] = g
      out.data[d + 2] = b
      out.data[d + 3] = src[s + 3]
    }
  }
  ctx.putImageData(out, 0, 0)
  return c
}

const HAIR_BASE_LUM = lum(ATLAS.hairBase[0], ATLAS.hairBase[1], ATLAS.hairBase[2])
const SKIN_BASE: RGB = [ATLAS.skinBase[0], ATLAS.skinBase[1], ATLAS.skinBase[2]]

function skinTint(skin: number): Tint[] {
  return skin === 0 ? [] : [{ ch: 1, to: rgb(SKINS[skin].hex), from: SKIN_BASE }]
}

/* ── 캐시 ────────────────────────────────────────────────── */

const partCache = new Map<string, HTMLCanvasElement>()
const PART_CACHE_MAX = 160
function cachedPart(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  const hit = partCache.get(key)
  if (hit) return hit
  const c = make()
  partCache.set(key, c)
  if (partCache.size > PART_CACHE_MAX) {
    const first = partCache.keys().next().value
    if (first !== undefined) partCache.delete(first)
  }
  return c
}

interface Entry {
  canvas: HTMLCanvasElement
  px: number
}
const cache = new Map<string, Entry>()
let cachePixels = 0
const CACHE_MAX_ENTRIES = 400
const CACHE_MAX_PIXELS = 24_000_000

export function clearSpriteCache(): void {
  cache.clear()
  cachePixels = 0
}

function quantize(scale: number): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1
  return Math.min(4, Math.max(0.1, Math.round(s * 20) / 20))
}

/**
 * 스프라이트 캔버스 (DOLL_W*scale x DOLL_H*scale). scale = 명목 1단위당 픽셀.
 * load() 가 끝나기 전에는 빈 캔버스를 돌려준다.
 */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame, scale: number = 1): HTMLCanvasElement {
  const sc = quantize(scale)
  const a = lookOf(kind)
  const nod = frame % 2 === 1 ? 1 : 0
  const flip = dir === 'left'
  const key = `${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}|${flip ? 1 : 0}${nod}|${sc}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit.canvas
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(DOLL_W * sc)
  canvas.height = Math.ceil(DOLL_H * sc)
  const ctx = canvas.getContext('2d')
  if (!ctx || !heads || !bodies || !acc) return canvas
  const hs = heads
  const bs = bodies

  const hd = ATLAS.heads[a.hairStyle]
  const bd = ATLAS.bodies[a.outfit]
  const head = cachedPart(`h${a.hairStyle},${a.hairColor},${a.skin}`, () =>
    tinted(hs, hd.rect, [{ ch: 0, to: rgb(HAIR_COLORS[a.hairColor].hex), baseLum: HAIR_BASE_LUM }, ...skinTint(a.skin)]),
  )
  const body = cachedPart(`b${a.outfit},${a.outfitColor},${a.skin}`, () =>
    tinted(bs, bd.rect, [
      ...(a.outfitColor === 0 ? [] : [{ ch: 2 as const, to: rgb(OUTFIT_COLORS[a.outfitColor].hex), baseLum: bd.lum }]),
      ...skinTint(a.skin),
    ]),
  )

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.setTransform(flip ? -sc : sc, 0, 0, sc, flip ? canvas.width : 0, 0)
  // 그림자
  ctx.fillStyle = 'rgba(70, 50, 40, 0.22)'
  ctx.beginPath()
  ctx.ellipse(CX, DOLL_FOOT_Y - 2, 52, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  // 머리(긴 머리는 어깨 뒤로 내려온다) → 몸 → 액세서리
  const hy = EYE_Y - hd.ey + nod * 2
  ctx.drawImage(head, CX - hd.ex, hy)
  ctx.drawImage(body, CX - bd.ax, DOLL_FOOT_Y - bd.rect[3])
  if (a.accessory > 0) {
    const r = ATLAS.acc[a.accessory - 1].rect
    const p = ACC_PLACE[a.accessory - 1]
    const w = r[2] * p.s
    const h = r[3] * p.s
    ctx.drawImage(acc, r[0], r[1], r[2], r[3], CX + p.dx - w / 2, EYE_Y + p.dy - h / 2 + nod * 2, w, h)
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
