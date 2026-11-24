/**
 * "LPC 도트" 그림체 — Liberated Pixel Cup 캐릭터(오픈 라이선스 도트)를 파츠별로 겹쳐 조합한다.
 * 다른 그림체와 같은 계약: PART_DEFS / randomAppearance / normalizeAppearance / getSprite.
 *
 *  - 몸 + 신발·하의·상의(의상 묶음) + 얼굴 + 머리 + 액세서리를 원본 시트의 z 순서대로 겹친다.
 *    모든 파츠가 같은 64x64 칸 기준으로 그려져 있어 위치 보정이 없다 (칸에서 40x58 만 잘라 쓴다).
 *  - 색 바꾸기는 LPC 방식 그대로: 기준 색 6단계(피부·머리·옷감)를 고른 색의 같은 단계로 픽셀 단위로 맞바꾼다.
 *  - 4방향 그림이 모두 있다 (좌우 반전 없음). 프레임 0 = 정지, 1·2 = 반대 발이 나간 걷기.
 *  - 몸(남/여 체형)과 얼굴은 의상 묶음이 정한다. 머리 모양은 어느 몸에나 맞는다.
 *  - 아틀라스 한 장을 먼저 불러와야 하므로 load() 가 끝난 뒤에만 getSprite 가 그림을 준다 (등록부가 기다려 준다).
 * 에셋은 art/lpc/build.py 로 다시 만든다. 그림 저작자·라이선스: art/lpc/LICENSE.md, assets/credits.csv
 */
import type { AppearanceParts, PartKey } from '../../types'
import type { Dir, Frame, PartDef, SpriteKind } from '../../character'
import { ATLAS, type LpcPart } from './assets/atlas'
import atlasUrl from './assets/atlas.png'
import creditsUrl from './assets/credits.csv?url'

export type { Dir, Frame, PartDef, SpriteKind }

/** 스프라이트 명목 크기 (원본 도트) */
export const LPC_W = ATLAS.w
export const LPC_H = ATLAS.h
/** 위에서 발바닥 선까지 */
export const LPC_FOOT_Y = ATLAS.footY

/** 크레딧 화면에 넣을 문구 (LPC 는 앱 안에서 저작자 표시에 닿을 수 있어야 한다) */
export const CREDITS = [
  'Sprites by: Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike), JaidynReiman, Eliza Wyatt (ElizaWy), Nila122, Joe White, Mandi Paugh, Page, Manuel Riecke (MrBeast), Lanea Zimmerman (Sharm), William.Thompsonj, Ahmad3366.',
  'Sprites contributed as part of the Liberated Pixel Cup project from OpenGameArt.org: http://opengameart.org/content/lpc-collection',
  'Licence: OGA-BY 3.0 (https://static.opengameart.org/OGA-BY-3.0.txt) / CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/); some parts CC0. Sprites were recoloured and re-packed for this app.',
  ...(ATLAS.sharealike
    ? [
        'Formal wear, hats and glasses by: bluecarrot16, JaidynReiman, Johannes Sjölund (wulax), laetissima, Luke Mehl, Makrohn, Michael Whitlock (bigbeargames), Stephen Challener (Redshrike), Thane Brimhall (pennomi). Licence: CC-BY-SA 3.0 (http://creativecommons.org/licenses/by-sa/3.0/). Includes "LPC Gentleman" by bluecarrot16 (https://opengameart.org/content/lpc-gentleman). The character sprites that use these parts are available under the same licence.',
      ]
    : []),
]
/** 파일별 상세 크레딧(CSV)의 주소 */
export const CREDITS_URL: string = creditsUrl

const COUNTS: Record<PartKey, number> = {
  skin: ATLAS.skins.length,
  hairStyle: ATLAS.hairs.length,
  hairColor: ATLAS.hairColors.length,
  outfit: ATLAS.outfits.length,
  outfitColor: ATLAS.outfitColors.length,
  accessory: ATLAS.accs.length + 1,
}

export const PART_DEFS: PartDef[] = [
  { key: 'hairStyle', label: '머리 모양', options: ATLAS.hairs.map((h) => ({ label: h.label })) },
  { key: 'hairColor', label: '머리 색', options: ATLAS.hairColors.map((c) => ({ label: c.label, swatch: c.swatch })) },
  { key: 'outfit', label: '의상', options: ATLAS.outfits.map((o) => ({ label: o.label })) },
  { key: 'outfitColor', label: '의상 색', options: ATLAS.outfitColors.map((c) => ({ label: c.label, swatch: c.swatch })) },
  { key: 'accessory', label: '액세서리', options: [{ label: '없음' }, ...ATLAS.accs.map((a) => ({ label: a.label }))] },
  { key: 'skin', label: '피부', options: ATLAS.skins.map((c) => ({ label: c.label, swatch: c.swatch })) },
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

/** 신랑·신부 몫으로 남겨 두는 것: 의상 0·1번(턱시도·웨딩드레스 — 빌드에 따라 신랑 의상 번호가 다를 수 있다)과 신부의 머리 장식 */
const RESERVED_OUTFITS = new Set([ATLAS.groom.outfit, ATLAS.bride.outfit])
const GUEST_OUTFITS = ATLAS.outfits.map((_, i) => i).filter((i) => !RESERVED_OUTFITS.has(i))
const GUEST_ACCS = ATLAS.accs.map((_, i) => i + 1).filter((i) => i !== ATLAS.bride.accessory)
/** 머리 모양 목록은 짧은 머리(0~7) → 긴 머리(8~) 순서 */
const SHORT_HAIRS = 8

/** 하객용 랜덤: 턱시도·웨딩드레스·티아라는 빼고, 몸에 어울리는 머리 길이를 주로 고른다. 액세서리는 절반쯤 없음 */
export function randomAppearance(rnd: () => number = Math.random): AppearanceParts {
  const pick = (n: number) => Math.min(n - 1, Math.floor(rnd() * n))
  const outfit = GUEST_OUTFITS[pick(GUEST_OUTFITS.length)]
  const female = ATLAS.outfits[outfit].body === 'f'
  const longHair = rnd() < (female ? 0.85 : 0.1)
  return {
    skin: rnd() < 0.7 ? pick(2) : pick(COUNTS.skin),
    hairStyle: longHair ? SHORT_HAIRS + pick(COUNTS.hairStyle - SHORT_HAIRS) : pick(SHORT_HAIRS),
    // 머리 색 목록의 앞 넷이 자연스러운 어두운 색 (블랙·다크 브라운·밤색·라이트 브라운)
    hairColor: rnd() < 0.65 ? pick(4) : pick(COUNTS.hairColor),
    outfit,
    outfitColor: pick(COUNTS.outfitColor),
    accessory: rnd() < 0.5 ? 0 : GUEST_ACCS[pick(GUEST_ACCS.length)],
  }
}

function lookOf(kind: SpriteKind): AppearanceParts {
  if (kind === 'groom') return ATLAS.groom
  if (kind === 'bride') return ATLAS.bride
  return normalizeAppearance(kind)
}

/* ── 아틀라스 불러오기 ───────────────────────────────────── */

/** 아틀라스 픽셀 (RGBA, 곱하지 않은 알파) */
let atlas: { data: Uint8ClampedArray; width: number } | null = null
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
  if (atlas) return Promise.resolve()
  loading ??= loadImage(atlasUrl)
    .then((img) => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('캔버스를 만들 수 없어요.')
      ctx.drawImage(img, 0, 0)
      atlas = { data: ctx.getImageData(0, 0, c.width, c.height).data, width: c.width }
      cache.clear()
    })
    .finally(() => {
      loading = null
    })
  return loading
}

/* ── 색 바꾸기 ───────────────────────────────────────────── */

/** 색 단 번호(1 피부·2 머리·3 옷감)별: 기준 색(0xRRGGBB) → 단계(0~5) */
const SRC_INDEX: Map<number, number>[] = ATLAS.src.map((ramp) => new Map(ramp.map((c, i) => [c, i])))
/** 반투명 픽셀은 캔버스에서 읽을 때 색이 조금 어긋난다 — 채널당 이만큼까지는 같은 단계로 본다 */
const SOFT_TOLERANCE = 8

function stepOf(kind: number, r: number, g: number, b: number, a: number): number {
  const hit = SRC_INDEX[kind].get((r << 16) | (g << 8) | b)
  if (hit !== undefined) return hit
  if (a === 255) return -1
  const ramp = ATLAS.src[kind]
  let best = -1
  let bestD = SOFT_TOLERANCE + 1
  for (let i = 0; i < ramp.length; i++) {
    const c = ramp[i]
    const d = Math.max(Math.abs(r - (c >> 16)), Math.abs(g - ((c >> 8) & 255)), Math.abs(b - (c & 255)))
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** 파츠의 색 지정을 실제 색 단으로 푼다 ('' = 그림 그대로) */
function rampFor(tint: string, a: AppearanceParts): readonly number[] | null {
  if (tint === '') return null
  if (tint === 'skin') return ATLAS.skins[a.skin].ramp
  if (tint === 'hair') return ATLAS.hairColors[a.hairColor].ramp
  const main = ATLAS.outfitColors[a.outfitColor].cloth
  if (tint === 'main') return ATLAS.cloth[main]
  const [first, second] = tint.split('|')
  return ATLAS.cloth[first === main && second ? second : first] ?? null
}

/* ── 겹쳐 그리기 ─────────────────────────────────────────── */

const W = ATLAS.w
const H = ATLAS.h
const FRAMES = ATLAS.frames
const DIR_INDEX: Record<Dir, number> = { down: 0, left: 0, right: 0, up: 0 }
ATLAS.dirs.forEach((d, i) => {
  DIR_INDEX[d as Dir] = i
})

/**
 * 띠의 한 칸을 out(RGBA, W x H) 위에 겹친다. ramp 가 있으면 기준 색을 그 색 단으로 바꿔 가며 그린다.
 * clipAbove: 이 줄보다 위(y < clipAbove)는 그리지 않는다 (모자 밑으로 들어간 머리카락)
 */
function blit(out: Uint8ClampedArray, stripNo: number, cell: number, ramp: readonly number[] | null, clipAbove: number): void {
  if (!atlas) return
  const [sx, sy, sw, sh, ox, oy, kind] = ATLAS.strips[stripNo]
  const src = atlas.data
  const x0 = sx + cell * sw
  for (let j = 0; j < sh; j++) {
    const y = oy + j
    if (y < clipAbove) continue
    let s = ((sy + j) * atlas.width + x0) * 4
    let d = (y * W + ox) * 4
    for (let i = 0; i < sw; i++, s += 4, d += 4) {
      const sa = src[s + 3]
      if (sa === 0) continue
      let r = src[s]
      let g = src[s + 1]
      let b = src[s + 2]
      if (ramp && kind > 0) {
        const step = stepOf(kind, r, g, b, sa)
        if (step >= 0) {
          const c = ramp[step]
          r = c >> 16
          g = (c >> 8) & 255
          b = c & 255
        }
      }
      const da = out[d + 3]
      if (sa === 255 || da === 0) {
        out[d] = r
        out[d + 1] = g
        out[d + 2] = b
        out[d + 3] = sa
        continue
      }
      // 곱하지 않은 알파끼리의 "over"
      const fa = sa / 255
      const ba = (da / 255) * (1 - fa)
      const oa = fa + ba
      out[d] = (r * fa + out[d] * ba) / oa
      out[d + 1] = (g * fa + out[d + 1] * ba) / oa
      out[d + 2] = (b * fa + out[d + 2] * ba) / oa
      out[d + 3] = oa * 255
    }
  }
}

/** 모자 그림(한 칸)에서 챙 줄 — 가장 넓은 줄(같으면 아래쪽). 이 줄보다 위의 머리카락은 모자 속에 있다 */
const brimCache = new Map<number, number>()
function brimRow(stripNo: number, cell: number): number {
  const key = stripNo * 64 + cell
  const hit = brimCache.get(key)
  if (hit !== undefined) return hit
  let row = 0
  if (atlas) {
    const [sx, sy, sw, sh, , oy] = ATLAS.strips[stripNo]
    let widest = 0
    for (let j = 0; j < sh; j++) {
      let lo = -1
      let hi = -1
      for (let i = 0; i < sw; i++) {
        if (atlas.data[((sy + j) * atlas.width + sx + cell * sw + i) * 4 + 3] === 0) continue
        if (lo < 0) lo = i
        hi = i
      }
      const width = lo < 0 ? 0 : hi - lo + 1
      if (width >= widest) {
        widest = width
        row = oy + j
      }
    }
    brimCache.set(key, row)
  }
  return row
}

const HAIR_KIND = 2

function compose(a: AppearanceParts, dir: Dir, frame: Frame): Uint8ClampedArray {
  const out = new Uint8ClampedArray(W * H * 4)
  const outfit = ATLAS.outfits[a.outfit]
  const acc = a.accessory > 0 ? ATLAS.accs[a.accessory - 1] : null
  const accParts: LpcPart[] = acc ? (acc.parts ?? acc[outfit.body] ?? []) : []
  const parts: LpcPart[] = [...ATLAS.base[outfit.body], ...outfit.parts, ...ATLAS.hairs[a.hairStyle].parts, ...accParts]
  // 원본 시트의 z 순서 (같은 z 는 넣은 순서 그대로)
  const order = parts.map((p, i) => ({ p, i })).sort((u, v) => ATLAS.strips[u.p[0]][7] - ATLAS.strips[v.p[0]][7] || u.i - v.i)
  const cell = DIR_INDEX[dir] * FRAMES + frame
  const hatBrim = acc?.hat && accParts.length > 0 ? brimRow(accParts[0][0], cell) : 0
  for (const { p } of order) {
    const isHair = ATLAS.strips[p[0]][6] === HAIR_KIND && p[1] === 'hair' && !accParts.includes(p)
    blit(out, p[0], cell, rampFor(p[1], a), isHair ? hatBrim : 0)
  }
  return out
}

/* ── 캐시 ────────────────────────────────────────────────── */

const cache = new Map<string, HTMLCanvasElement>()
/** 40x58 캔버스 한 장이 약 9KB — 하객 한 명이 방향 x 프레임 최대 12장 */
const CACHE_MAX = 900

export function clearSpriteCache(): void {
  cache.clear()
}

/**
 * 스프라이트 캔버스 (LPC_W x LPC_H 원본 도트 — 확대는 그리는 쪽에서 정수배 최근접으로).
 * scale 은 다른 그림체와 모양을 맞추기 위한 자리일 뿐 쓰지 않는다.
 * load() 가 끝나기 전에는 빈 캔버스를 돌려준다 (캐시에 남기지 않는다).
 */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame, _scale: number = 1): HTMLCanvasElement {
  const a = lookOf(kind)
  const f: Frame = frame === 1 || frame === 2 ? frame : 0
  const key = `${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}|${dir}${f}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx || !atlas) return canvas
  const img = ctx.createImageData(W, H)
  img.data.set(compose(a, dir, f))
  ctx.putImageData(img, 0, 0)
  cache.set(key, canvas)
  if (cache.size > CACHE_MAX) {
    const first = cache.keys().next().value
    if (first !== undefined) cache.delete(first)
  }
  return canvas
}
