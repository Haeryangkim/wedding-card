/**
 * "동숲(테스트)" 그림체 — 참고 게임의 캐릭터 렌더를 "그대로" 써 보는 사적인 품질 시험용.
 * 다른 그림체와 같은 계약: PART_DEFS / randomAppearance / normalizeAppearance / getSprite (+ load).
 *
 *  - 그림이 통짜 3D 렌더라 머리·옷을 따로 섞을 수 없다. 그래서 "주민 고르기"(hairStyle)가 주된 선택이고,
 *    손에 드는 소품(accessory)만 조합된다. 피부·머리 색·의상·의상 색은 옵션이 하나뿐이다.
 *  - 그림이 정지 한 장뿐이라 방향은 좌우 반전만 하고, 걷기는 좌우로 기우뚱하며 살짝 뛰는 것으로 대신한다.
 *  - 그림 파일(assets/*.webp)은 저장소에 올리지 않는다. 없어도 앱이 빌드되도록 import.meta.glob 으로 찾고,
 *    없으면 load() 가 거절한다 (등록부가 "불러오지 못함" 으로 처리).
 * 에셋·roster.ts 는 art/acref/build.py 로 다시 만든다.
 */
import type { AppearanceParts, PartKey } from '../../types'
import type { Dir, Frame, PartDef, SpriteKind } from '../../character'
import {
  ATLAS_COLS,
  ATLAS_STAMP,
  BRIDE_ACCESSORY,
  BRIDE_INDEX,
  CELL_FOOT,
  CELL_H,
  CELL_W,
  FOOT_Y,
  GROOM_INDEX,
  ITEMS,
  RESIDENTS,
  SPRITE_H,
  SPRITE_W,
} from './roster'

export type { Dir, Frame, PartDef, SpriteKind }

/** 스프라이트 명목 크기 (아틀라스 픽셀 단위) / 발바닥 선 */
export const ACREF_W = SPRITE_W
export const ACREF_H = SPRITE_H
export const ACREF_FOOT_Y = FOOT_Y
const CX = SPRITE_W / 2

/* 그림 파일 — 없을 수 있으므로 정적 import 대신 glob (없으면 빈 객체) */
interface AtlasInfo {
  stamp: string
}
const IMAGE_URLS = import.meta.glob<string>('./assets/*.webp', { eager: true, query: '?url', import: 'default' })
const ATLAS_INFOS = import.meta.glob<AtlasInfo>('./assets/atlas.json', { eager: true, import: 'default' })
const ATLAS_URL: string | undefined = IMAGE_URLS['./assets/atlas.webp']
const ITEMS_URL: string | undefined = IMAGE_URLS['./assets/items.webp']
const ATLAS_INFO: AtlasInfo | undefined = ATLAS_INFOS['./assets/atlas.json']

/** 그림 파일이 이 빌드에 들어 있는지 (없으면 load() 가 거절한다) */
export const HAS_ASSETS = ATLAS_URL !== undefined && ITEMS_URL !== undefined && ATLAS_INFO !== undefined

/** 걷기: 발을 축으로 좌우로 기우는 각도(라디안)와 뛰는 높이(명목 px) */
const TILT = (3.5 * Math.PI) / 180
const HOP = SPRITE_H * 0.016
/** 그림자 반지름 (명목 px) */
const SHADOW_RX = SPRITE_W * 0.16
const SHADOW_RY = SPRITE_H * 0.024

const ORIGINAL = 'conic-gradient(#f0a6b4, #e3b85a, #9fd3c0, #8fbbdc, #b3a0d6, #f0a6b4)'

const COUNTS: Record<PartKey, number> = {
  skin: 1,
  hairStyle: RESIDENTS.length,
  hairColor: 1,
  outfit: 1,
  outfitColor: 1,
  accessory: ITEMS.length + 1,
}

export const PART_DEFS: PartDef[] = [
  { key: 'hairStyle', label: '주민', options: RESIDENTS.map((r) => ({ label: r.label })) },
  { key: 'accessory', label: '소품', options: [{ label: '없음' }, ...ITEMS.map((t) => ({ label: t.label }))] },
  // 통짜 그림이라 아래는 바꿀 수 없다 (옵션 하나)
  { key: 'outfit', label: '의상', options: [{ label: '입은 그대로' }] },
  { key: 'outfitColor', label: '의상 색', options: [{ label: '원래 색', swatch: ORIGINAL }] },
  { key: 'hairColor', label: '머리 색', options: [{ label: '원래 색', swatch: ORIGINAL }] },
  { key: 'skin', label: '피부', options: [{ label: '원래 색', swatch: ORIGINAL }] },
]

function clamp(v: unknown, n: number): number {
  const i = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0
  return i < 0 ? 0 : i > n - 1 ? n - 1 : i
}

export function normalizeAppearance(input: AppearanceParts): AppearanceParts {
  return {
    skin: 0,
    hairStyle: clamp(input?.hairStyle, COUNTS.hairStyle),
    hairColor: 0,
    outfit: 0,
    outfitColor: 0,
    accessory: clamp(input?.accessory, COUNTS.accessory),
  }
}

/** 신랑·신부 몫의 주민 번호 (하객 랜덤에서 뺀다) */
const RESERVED = new Set([GROOM_INDEX, BRIDE_INDEX])
const GUEST_INDICES = RESIDENTS.map((_, i) => i).filter((i) => !RESERVED.has(i))

/** 하객용 랜덤: 신랑·신부 몫의 두 주민은 빼고, 소품은 절반쯤 없음 */
export function randomAppearance(rnd: () => number = Math.random): AppearanceParts {
  const pick = (n: number) => Math.min(n - 1, Math.floor(rnd() * n))
  return {
    skin: 0,
    hairStyle: GUEST_INDICES[pick(GUEST_INDICES.length)],
    hairColor: 0,
    outfit: 0,
    outfitColor: 0,
    accessory: rnd() < 0.5 ? 0 : 1 + pick(ITEMS.length),
  }
}

function lookOf(kind: SpriteKind): AppearanceParts {
  const base = { skin: 0, hairColor: 0, outfit: 0, outfitColor: 0 }
  if (kind === 'groom') return { ...base, hairStyle: GROOM_INDEX, accessory: 0 }
  if (kind === 'bride') return { ...base, hairStyle: BRIDE_INDEX, accessory: BRIDE_ACCESSORY }
  return normalizeAppearance(kind)
}

/* ── 이미지 불러오기 ─────────────────────────────────────── */

let atlas: HTMLImageElement | null = null
let items: HTMLImageElement | null = null
let loading: Promise<void> | null = null

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했어요: ${url}`))
    img.src = url
  })
}

/**
 * 그림을 모두 불러온다 (여러 번 불러도 한 번만 받는다). 실패하면 다음 호출에서 다시 시도.
 * 그림 파일이 빌드에 없거나(저장소에 올리지 않는다) 주민 목록과 어긋나면 거절한다.
 */
export function load(): Promise<void> {
  if (atlas && items) return Promise.resolve()
  if (ATLAS_URL === undefined || ITEMS_URL === undefined || ATLAS_INFO === undefined) {
    return Promise.reject(new Error('동숲(테스트) 그림 파일이 없어요 — art/acref/build.py 로 먼저 만들어 주세요.'))
  }
  if (ATLAS_INFO.stamp !== ATLAS_STAMP) {
    return Promise.reject(new Error('동숲(테스트) 그림 파일이 주민 목록과 맞지 않아요 — art/acref/build.py 를 다시 돌려 주세요.'))
  }
  loading ??= Promise.all([loadImage(ATLAS_URL), loadImage(ITEMS_URL)])
    .then(([a, t]) => {
      atlas = a
      items = t
    })
    .finally(() => {
      loading = null
    })
  return loading
}

/* ── 조각 (단계별로 절반씩 줄여 둔 그림) ─────────────────── */

type Source = HTMLImageElement | HTMLCanvasElement

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

const partCache = new Map<string, HTMLCanvasElement>()
const PART_CACHE_MAX = 120

/**
 * 아틀라스의 한 칸을 1/2^level 크기로 줄인 캔버스.
 * 한 번에 크게 줄이면 가장자리가 거칠어지므로 절반씩 내려간다 (장면에서는 보통 원본의 1/4~1/2 크기로 그린다).
 */
function part(key: string, src: Source, x: number, y: number, w: number, h: number, level: number): HTMLCanvasElement {
  const k = `${key}@${level}`
  const hit = partCache.get(k)
  if (hit) {
    partCache.delete(k)
    partCache.set(k, hit)
    return hit
  }
  let c: HTMLCanvasElement
  if (level === 0) {
    c = newCanvas(w, h)
    c.getContext('2d')?.drawImage(src, x, y, w, h, 0, 0, w, h)
  } else {
    const up = part(key, src, x, y, w, h, level - 1)
    c = newCanvas(up.width / 2, up.height / 2)
    const ctx = c.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(up, 0, 0, up.width, up.height, 0, 0, up.width / 2, up.height / 2)
    }
  }
  partCache.set(k, c)
  if (partCache.size > PART_CACHE_MAX) {
    const first = partCache.keys().next().value
    if (first !== undefined) partCache.delete(first)
  }
  return c
}

/** 배율 sc 로 그릴 때 쓸 축소 단계: 남는 축소가 절반을 넘지 않게 */
function levelFor(sc: number): number {
  let level = 0
  let s = sc
  while (s <= 0.5 && level < 3) {
    s *= 2
    level++
  }
  return level
}

/* ── 캐시 ────────────────────────────────────────────────── */

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
  partCache.clear()
}

function quantize(scale: number): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1
  // 1/200 단위: 요청한 배율과 캔버스 크기의 차이가 0.5px 안쪽이 되게 (장면이 쓰는 배율은 몇 가지뿐이라 캐시는 늘지 않는다)
  return Math.min(3, Math.max(0.05, Math.round(s * 200) / 200))
}

/**
 * 스프라이트 캔버스 (ACREF_W*scale x ACREF_H*scale). scale = 명목 1단위당 픽셀.
 * frame 0 = 서 있기, 1·2 = 걷기(왼쪽·오른쪽으로 기우뚱). dir 'left' 만 좌우 반전 (뒷모습 그림은 없다).
 * load() 가 끝나기 전에는 빈 캔버스를 돌려준다.
 */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame, scale: number = 1): HTMLCanvasElement {
  const sc = quantize(scale)
  const a = lookOf(kind)
  const flip = dir === 'left'
  const step = frame === 1 ? -1 : frame === 2 ? 1 : 0
  const key = `${a.hairStyle},${a.accessory}|${flip ? 1 : 0}${frame}|${sc}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit.canvas
  }
  const canvas = newCanvas(SPRITE_W * sc, SPRITE_H * sc)
  const ctx = canvas.getContext('2d')
  if (!ctx || !atlas || !items) return canvas

  const who = RESIDENTS[a.hairStyle]
  const level = levelFor(sc)
  const body = part(
    `r${a.hairStyle}`,
    atlas,
    (a.hairStyle % ATLAS_COLS) * CELL_W,
    Math.floor(a.hairStyle / ATLAS_COLS) * CELL_H,
    CELL_W,
    CELL_H,
    level,
  )

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.setTransform(flip ? -sc : sc, 0, 0, sc, flip ? canvas.width : 0, 0)
  // 그림자 (뛰어오를 때는 조금 작아진다)
  const lift = step === 0 ? 0 : HOP
  const sh = step === 0 ? 1 : 0.9
  ctx.fillStyle = 'rgba(60, 50, 40, 0.2)'
  ctx.beginPath()
  ctx.ellipse(CX, FOOT_Y - SHADOW_RY * 0.35, SHADOW_RX * sh, SHADOW_RY * sh, 0, 0, Math.PI * 2)
  ctx.fill()
  // 발을 축으로 기울이고 살짝 띄운다 — 소품도 몸과 함께 움직인다
  if (step !== 0) {
    ctx.translate(CX, FOOT_Y - lift)
    ctx.rotate(step * TILT)
    ctx.translate(-CX, -FOOT_Y)
  }
  ctx.drawImage(body, 0, 0, body.width, body.height, CX - CELL_W / 2, FOOT_Y - CELL_FOOT, CELL_W, CELL_H)
  if (a.accessory > 0) {
    const t = ITEMS[a.accessory - 1]
    const img = part(`i${a.accessory}`, items, t.x, t.y, t.w, t.h, level)
    const hx = CX + who.hx
    const hy = FOOT_Y - who.hy
    if (who.side < 0) {
      // 왼손: 소품을 좌우로 뒤집어 손잡이가 손에 오게
      ctx.translate(hx, 0)
      ctx.scale(-1, 1)
      ctx.translate(-hx, 0)
    }
    if (t.tilt) {
      // 손잡이를 축으로 몸 바깥쪽으로 눕힌다 (풍선이 얼굴을 가리지 않게) — 각도는 주민마다 머리에 닿지 않는 값
      ctx.translate(hx, hy)
      ctx.rotate(who.lean)
      ctx.translate(-hx, -hy)
    }
    ctx.drawImage(img, 0, 0, img.width, img.height, hx - t.gx, hy - t.gy, t.w, t.h)
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
