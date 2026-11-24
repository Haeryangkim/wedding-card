/**
 * "손그림 치비(테스트)" 그림체 — 품질 비교를 위한 비공개 테스트 전용.
 * MaelleMarylloup 의 CHIBI 팩(정면 한 자세의 레이어 그림)을 빌드 때 컷아웃 인형으로 잘라 걷는 동작을 구워 두고
 * (art/chibi/build.py), 여기서는 구워 둔 조각을 순서대로 겹쳐 그린다.
 *
 *  - 몸은 조각(몸통 · 다리 둘 · 팔 둘)마다 변형(들기 · 앞으로 · 뒤로)이 아틀라스에 따로 있고,
 *    프레임별로 어느 변형을 쓸지는 assets/atlas.json 의 poses 가 정한다. 치마·원피스는 통째로 흔들리는 변형이 있다.
 *  - 머리(얼굴 · 머리카락 · 머리 장식)는 한 덩어리 — 걸을 때 위치만 조금 옮긴다.
 *  - 머리카락은 흑백 선화로 구워져 있어 여기서 색을 입힌다 (밝기로 채움 색 ↔ 선 색을 섞는다).
 *  - 원본에 옷 색 변형이 없어서 'outfitColor' 칸을 "얼굴" 고르기로 쓴다 (PART_DEFS 의 라벨 참고).
 *  - 그림은 오른쪽을 비스듬히 본 정면 — right·down 은 그대로, left 는 좌우 반전.
 *    뒷모습(up)은 원본에 없어 머리통을 머리카락으로 덮은 "뒤통수" 를 얹고 몸을 반전한다 (옷의 앞섶이 그대로 보인다).
 *
 * 그림의 재배포가 명시적으로 허용되지 않아 assets/ 는 저장소에 없다. 그래서 정적 import 대신 import.meta.glob 으로 찾고,
 * 없으면 load() 가 거절한다. 이름·개수·치수는 catalog.ts 에 있어 에셋 없이도 빌드된다.
 */
import type { AppearanceParts, PartKey } from '../../types'
import type { Dir, Frame, PartDef, SpriteKind } from '../../character'
import {
  ACCESSORIES,
  BRIDE,
  CHIBI_ATLAS_V,
  CHIBI_FOOT_Y,
  CHIBI_H,
  CHIBI_W,
  FACES,
  GROOM,
  HAIRS,
  HAIR_COLORS,
  OUTFITS,
  SHORT_HAIRS,
  SKINS,
} from './catalog'

export type { Dir, Frame, PartDef, SpriteKind }

/** 스프라이트 명목 크기 (아틀라스 픽셀 단위) / 위에서 발밑까지 */
export const SPRITE_W = CHIBI_W
export const SPRITE_H = CHIBI_H
export const FOOT_Y = CHIBI_FOOT_Y

const COUNTS: Record<PartKey, number> = {
  skin: SKINS.length,
  hairStyle: HAIRS.length,
  hairColor: HAIR_COLORS.length,
  outfit: OUTFITS.length,
  /** 얼굴 (원본에 옷 색 변형이 없어 이 칸을 빌려 쓴다) */
  outfitColor: FACES.length,
  accessory: ACCESSORIES.length + 1,
}

export const PART_DEFS: PartDef[] = [
  { key: 'hairStyle', label: '머리 모양', options: HAIRS.map((h) => ({ label: h.label })) },
  { key: 'hairColor', label: '머리 색', options: HAIR_COLORS.map((c) => ({ label: c.label, swatch: c.hex })) },
  { key: 'outfitColor', label: '얼굴', options: FACES.map((f) => ({ label: f.label })) },
  { key: 'outfit', label: '의상', options: OUTFITS.map((o) => ({ label: o.label })) },
  { key: 'accessory', label: '액세서리', options: [{ label: '없음' }, ...ACCESSORIES.map((a) => ({ label: a.label }))] },
  { key: 'skin', label: '피부', options: SKINS.map((s) => ({ label: s.label, swatch: s.hex })) },
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

/** 하객에게 주지 않는 번호: 턱시도·웨딩드레스(0·1번 옷)와 면사포(마지막 액세서리) */
export const COUPLE_OUTFITS: readonly number[] = [GROOM.outfit, BRIDE.outfit]
export const COUPLE_ACCESSORY = ACCESSORIES.length
/** 원피스·치마 차림인 옷의 번호 (긴 머리가 많이 나온다) */
export const FEMALE_OUTFITS: readonly number[] = OUTFITS.flatMap((o, i) => (o.female ? [i] : []))
export { SHORT_HAIRS }
/** 랜덤으로 자주 뽑는 범위: 밝은 피부 둘, 자연스러운 머리 색 넷 */
export const COMMON_SKINS = 2
export const COMMON_HAIR_COLORS = 4

/**
 * 하객용 랜덤:
 *  - 턱시도·웨딩드레스(0·1번)와 면사포(마지막 액세서리)는 두 사람 몫으로 남긴다. 액세서리는 절반쯤 없음
 *  - 원피스·치마에는 긴 머리가, 그 밖의 옷에는 짧은 머리가 많게 (85%)
 *  - 밝은 피부(앞의 둘)와 자연스러운 머리 색(앞의 넷)이 많게
 */
export function randomAppearance(rnd: () => number = Math.random): AppearanceParts {
  const pick = (n: number) => Math.min(n - 1, Math.floor(rnd() * n))
  const outfit = 2 + pick(COUNTS.outfit - 2)
  const long = rnd() < (OUTFITS[outfit].female ? 0.85 : 0.15)
  return {
    skin: rnd() < 0.6 ? pick(COMMON_SKINS) : pick(COUNTS.skin),
    hairStyle: long ? SHORT_HAIRS + pick(COUNTS.hairStyle - SHORT_HAIRS) : pick(SHORT_HAIRS),
    hairColor: rnd() < 0.7 ? pick(COMMON_HAIR_COLORS) : pick(COUNTS.hairColor),
    outfit,
    outfitColor: pick(COUNTS.outfitColor),
    accessory: rnd() < 0.5 ? 0 : 1 + pick(COUNTS.accessory - 2),
  }
}

function lookOf(kind: SpriteKind): AppearanceParts {
  const fixed = kind === 'groom' ? GROOM : kind === 'bride' ? BRIDE : null
  if (fixed) {
    return {
      skin: fixed.skin,
      hairStyle: fixed.hairStyle,
      hairColor: fixed.hairColor,
      outfit: fixed.outfit,
      outfitColor: fixed.face,
      accessory: fixed.accessory,
    }
  }
  return normalizeAppearance(kind as AppearanceParts)
}

/**
 * 방향 → 그리는 모습. 그림은 오른쪽을 비스듬히 본다.
 *  - right·down = 그대로, left = 반전. 나란히 서는 두 사람이 마주 보도록 신부(오른쪽에 선다)의 down 은 반전
 *  - up = 뒤통수 + 반전 (뒤에서 보면 좌우가 바뀐다)
 */
export function viewOf(kind: SpriteKind, dir: Dir): { walk: 'down' | 'side'; back: boolean; flip: boolean } {
  if (dir === 'up') return { walk: 'down', back: true, flip: true }
  if (dir === 'down') return { walk: 'down', back: false, flip: kind === 'bride' }
  return { walk: 'side', back: false, flip: dir === 'left' }
}

/* ── 에셋 불러오기 ───────────────────────────────────────── */

/** 조각 묶음: 조각 이름 → 변형별 아틀라스 칸 번호 (-1 = 없음). 변형이 하나뿐이면 어느 자세에서든 그것을 쓴다 */
interface Rig {
  body?: readonly number[]
  legL?: readonly number[]
  legR?: readonly number[]
  armL?: readonly number[]
  armR?: readonly number[]
}
interface SkinRig extends Rig {
  head: number
}
interface Pose {
  /** [왼다리, 오른다리] 변형 */
  l: readonly [number, number]
  /** [왼팔, 오른팔] 변형 */
  a: readonly [number, number]
  /** 치마·원피스 변형 */
  b: number
  /** 상체(몸통·팔)를 내리는 양 */
  dy: number
  /** 머리 이동 */
  hx: number
  hy: number
}
interface AccCells {
  /** 머리카락 위 */
  front?: number
  /** 얼굴 위·머리카락 아래 */
  face?: number
  /** 몸 뒤 */
  back?: number
  /** 뒷모습: 뒤통수 위 */
  up?: number
  /** 뒷모습: 몸 위·뒤통수 아래 */
  upBody?: number
}
interface AtlasMeta {
  v: number
  w: number
  h: number
  footY: number
  /** [아틀라스 x, y, w, h, 프레임 안의 x, y] */
  rects: readonly (readonly [number, number, number, number, number, number])[]
  poses: { down: readonly Pose[]; side: readonly Pose[] }
  skins: readonly SkinRig[]
  faces: readonly number[]
  hairs: readonly { front: number; back: number; up: number }[]
  /** low = 바지·신발(다리와 함께), high = 윗옷·치마·원피스(다리 위에) */
  outfits: readonly { low: readonly Rig[]; high: readonly Rig[] }[]
  accs: readonly AccCells[]
}

// 에셋 폴더가 비어 있어도 빌드되도록 정적 import 대신 glob (없으면 빈 객체)
const META_FILES = import.meta.glob<AtlasMeta>('./assets/atlas.json', { import: 'default' })
const IMAGE_FILES = import.meta.glob<string>('./assets/atlas.png', { query: '?url', import: 'default' })

let meta: AtlasMeta | null = null
let sheet: HTMLImageElement | null = null
let loading: Promise<void> | null = null

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했어요: ${url}`))
    img.src = url
  })
}

/** 에셋이 이 빌드에 들어 있는지 (없으면 load() 는 항상 거절한다) */
export function hasAssets(): boolean {
  return Object.keys(META_FILES).length > 0 && Object.keys(IMAGE_FILES).length > 0
}

/** 아틀라스가 catalog.ts 와 맞는지 (치수·판 번호·파츠 개수) */
export function matchesCatalog(m: AtlasMeta): boolean {
  return (
    m.v === CHIBI_ATLAS_V &&
    m.w === CHIBI_W &&
    m.h === CHIBI_H &&
    m.footY === CHIBI_FOOT_Y &&
    m.skins.length === SKINS.length &&
    m.faces.length === FACES.length &&
    m.hairs.length === HAIRS.length &&
    m.outfits.length === OUTFITS.length &&
    m.accs.length === ACCESSORIES.length &&
    m.poses.down.length === 3 &&
    m.poses.side.length === 3
  )
}

/** 아틀라스를 불러온다 (여러 번 불러도 한 번만 받는다). 에셋이 없거나 catalog.ts 와 어긋나면 거절 */
export function load(): Promise<void> {
  if (meta && sheet) return Promise.resolve()
  loading ??= (async () => {
    const metaFile = Object.values(META_FILES)[0]
    const imageFile = Object.values(IMAGE_FILES)[0]
    if (!metaFile || !imageFile) {
      throw new Error('chibi 에셋이 없어요 — art/chibi/build.py collect, build 를 먼저 실행하세요.')
    }
    const [m, url] = await Promise.all([metaFile(), imageFile()])
    if (!matchesCatalog(m)) {
      throw new Error('chibi 에셋과 catalog.ts 가 어긋나요 — art/chibi/build.py build 를 다시 실행하세요.')
    }
    const img = await loadImage(url)
    meta = m
    sheet = img
  })().finally(() => {
    loading = null
  })
  return loading
}

/* ── 머리 색 입히기 ──────────────────────────────────────── */

type RGB = readonly [number, number, number]
function rgb(hex: string): RGB {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

const tintCache = new Map<string, HTMLCanvasElement>()
/** 머리 모양 17 x 색 10 x 칸 3 을 다 담아도 510장 (칸 하나가 100x110 안팎) */
const TINT_CACHE_MAX = 240

/** 흑백 선화 칸 → 색 입힌 캔버스. 밝기 1 = 채움 색, 0 = 선 색 */
function tintedCell(m: AtlasMeta, img: HTMLImageElement, rect: number, color: number): HTMLCanvasElement {
  const key = `${rect}:${color}`
  const hit = tintCache.get(key)
  if (hit) return hit
  const [x, y, w, h] = m.rects[rect]
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return c
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  const fill = rgb(HAIR_COLORS[color].hex)
  const line = rgb(HAIR_COLORS[color].line)
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    const g = (px[i] + px[i + 1] + px[i + 2]) / 765
    px[i] = line[0] + (fill[0] - line[0]) * g
    px[i + 1] = line[1] + (fill[1] - line[1]) * g
    px[i + 2] = line[2] + (fill[2] - line[2]) * g
  }
  ctx.putImageData(data, 0, 0)
  tintCache.set(key, c)
  if (tintCache.size > TINT_CACHE_MAX) {
    const first = tintCache.keys().next().value
    if (first !== undefined) tintCache.delete(first)
  }
  return c
}

/* ── 조합 ────────────────────────────────────────────────── */

/** 조각의 v번 변형 (변형이 모자라면 마지막 것) */
function variant(rig: Rig, part: keyof Rig, v: number): number {
  const ids = rig[part]
  return ids && ids.length > 0 ? ids[Math.min(v, ids.length - 1)] : -1
}

/**
 * 한 장면을 원본 크기(CHIBI_W x CHIBI_H)로 그린다. 순서는 art/chibi/build.py 의 Composer.sprite 와 같다:
 * 그림자 → (뒷머리 · 몸 뒤 장식) → 몸통 → 다리(먼 쪽부터) → 치마·윗옷 → 팔 → 머리.
 */
function paint(
  ctx: CanvasRenderingContext2D,
  m: AtlasMeta,
  img: HTMLImageElement,
  a: AppearanceParts,
  pose: Pose,
  back: boolean,
): void {
  const put = (r: number | undefined, dx = 0, dy = 0, tint = -1) => {
    if (r === undefined || r < 0) return
    const q = m.rects[r]
    if (tint >= 0) ctx.drawImage(tintedCell(m, img, r, tint), q[4] + dx, q[5] + dy)
    else ctx.drawImage(img, q[0], q[1], q[2], q[3], q[4] + dx, q[5] + dy, q[2], q[3])
  }
  const skin = m.skins[a.skin]
  const outfit = m.outfits[a.outfit]
  const hair = m.hairs[a.hairStyle]
  const acc: AccCells = a.accessory > 0 ? m.accs[a.accessory - 1] : {}
  const { dy, hx, hy } = pose

  ctx.fillStyle = 'rgba(70, 50, 40, 0.2)'
  ctx.beginPath()
  ctx.ellipse(m.w / 2, m.footY - 1.5, 30, 5.5, 0, 0, Math.PI * 2)
  ctx.fill()

  if (!back) {
    // 뒷머리는 머리의 좌우 흔들림을 따라가지 않는다 (살짝 늦게 따라오는 느낌)
    put(hair.back, 0, hy, a.hairColor)
    put(acc.back, 0, dy)
  }
  put(variant(skin, 'body', 0), 0, dy)
  for (const ly of outfit.low) put(variant(ly, 'body', 0), 0, dy)
  const legs = [
    ['legR', pose.l[1]],
    ['legL', pose.l[0]],
  ] as const
  for (const [part, v] of legs) {
    put(variant(skin, part, v))
    for (const ly of outfit.low) put(variant(ly, part, v))
  }
  for (const ly of outfit.high) put(variant(ly, 'body', pose.b), 0, dy)
  const arms = [
    ['armR', pose.a[1]],
    ['armL', pose.a[0]],
  ] as const
  for (const [part, v] of arms) {
    put(variant(skin, part, v), 0, dy)
    for (const ly of outfit.low) put(variant(ly, part, v), 0, dy)
    for (const ly of outfit.high) put(variant(ly, part, v), 0, dy)
  }
  if (back) {
    put(acc.upBody, 0, dy)
    put(hair.up, hx, hy, a.hairColor)
    put(acc.up, hx, hy)
  } else {
    put(skin.head, hx, hy)
    put(acc.face, hx, hy)
    put(m.faces[a.outfitColor], hx, hy)
    put(hair.front, hx, hy, a.hairColor)
    put(acc.front, hx, hy)
  }
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
  tintCache.clear()
  cachePixels = 0
}

function remember(key: string, canvas: HTMLCanvasElement): void {
  const px = canvas.width * canvas.height
  cache.set(key, { canvas, px })
  cachePixels += px
  for (const [k, e] of cache) {
    if (cache.size <= CACHE_MAX_ENTRIES && cachePixels <= CACHE_MAX_PIXELS) break
    if (k === key) break
    cache.delete(k)
    cachePixels -= e.px
  }
}

function recall(key: string): HTMLCanvasElement | null {
  const hit = cache.get(key)
  if (!hit) return null
  cache.delete(key)
  cache.set(key, hit)
  return hit.canvas
}

/** 배율을 0.05 단위로 맞춘다 (캐시가 배율마다 따로 쌓이지 않게) */
export function quantizeScale(scale: number): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1
  return Math.min(4, Math.max(0.1, Math.round(s * 20) / 20))
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** 원본 크기(CHIBI_W x CHIBI_H) 한 장 */
function baseSprite(m: AtlasMeta, img: HTMLImageElement, a: AppearanceParts, key: string, kind: SpriteKind, dir: Dir, frame: Frame) {
  const hit = recall(key)
  if (hit) return hit
  const canvas = makeCanvas(CHIBI_W, CHIBI_H)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const view = viewOf(kind, dir)
  const pose = m.poses[view.walk][frame] ?? m.poses[view.walk][0]
  if (view.flip) ctx.setTransform(-1, 0, 0, 1, CHIBI_W, 0)
  paint(ctx, m, img, a, pose, view.back)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  remember(key, canvas)
  return canvas
}

/**
 * 스프라이트 캔버스 (CHIBI_W*scale x CHIBI_H*scale). scale = 명목 1단위당 픽셀.
 * load() 가 끝나기 전에는 빈 캔버스를 돌려준다.
 */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame, scale: number = 1): HTMLCanvasElement {
  const sc = quantizeScale(scale)
  const w = Math.ceil(CHIBI_W * sc)
  const h = Math.ceil(CHIBI_H * sc)
  if (!meta || !sheet) return makeCanvas(w, h)
  const a = lookOf(kind)
  const view = viewOf(kind, dir)
  const f = frame === 1 || frame === 2 ? frame : 0
  const baseKey = `${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}|${view.walk}${view.back ? 'B' : 'F'}${view.flip ? 'L' : 'R'}${f}`
  const base = baseSprite(meta, sheet, a, baseKey, kind, dir, f)
  if (sc === 1) return base
  const key = `${baseKey}|${sc}`
  const hit = recall(key)
  if (hit) return hit
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // 절반보다 작게 줄일 때는 한 번 절반으로 줄인 뒤 다시 줄인다 (가는 선이 끊기지 않게)
  let src: HTMLCanvasElement = base
  if (sc < 0.5) {
    const half = makeCanvas(Math.ceil(CHIBI_W / 2), Math.ceil(CHIBI_H / 2))
    const hctx = half.getContext('2d')
    if (hctx) {
      hctx.imageSmoothingEnabled = true
      hctx.imageSmoothingQuality = 'high'
      hctx.drawImage(base, 0, 0, half.width, half.height)
      src = half
    }
  }
  ctx.drawImage(src, 0, 0, CHIBI_W * sc, CHIBI_H * sc)
  remember(key, canvas)
  return canvas
}
