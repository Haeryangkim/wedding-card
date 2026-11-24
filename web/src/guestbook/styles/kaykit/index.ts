/**
 * "3D 모험가" 그림체 — KayKit Adventurers(Kay Lousberg, CC0)의 3D 캐릭터를 미리 구운 스프라이트로 조합한다.
 * 다른 그림체와 같은 계약: PART_DEFS / randomAppearance / normalizeAppearance / getSprite (+ load).
 *
 *  - 실행 때는 three.js 가 없다. art/kaykit/build.mjs 가 빌드 전에 조각(몸·머리·모자·손에 든 물건)을
 *    방향 4 x 프레임 3 으로 따로 구워 둔 아틀라스를 2D 캔버스에서 겹칠 뿐이다 (./compose.ts).
 *  - 머리 모양 x 의상 x 액세서리를 자유롭게 섞는다. 피부·머리 색·의상 색은 구울 때 중립색으로 둔 영역에 곱한다.
 *  - 4방향 모두 실제로 돌려서 구운 그림이다 (좌우 반전 없음). 프레임 0 = 정지, 1·2 = 반대 발이 나간 걷기.
 *  - 벡터 그림체처럼 scale(명목 1단위당 픽셀)에 맞춘 크기의 캔버스를 돌려준다 (부드럽게 줄여서).
 *  - 아틀라스 두 장(색·마스크)을 먼저 받아야 하므로 load() 가 끝난 뒤에만 getSprite 가 그림을 준다.
 * 에셋 만들기·라이선스: art/kaykit/README.md, art/kaykit/LICENSE.md
 */
import type { AppearanceParts, PartKey } from '../../types'
import type { Dir, Frame, PartDef, SpriteKind } from '../../character'
import { ATLAS } from './assets/atlas'
import atlasUrl from './assets/atlas.webp'
import maskUrl from './assets/mask.webp'
import { clampLook, compose, type Pixels } from './compose'

export type { Dir, Frame, PartDef, SpriteKind }

/** 스프라이트 명목 크기 (구운 프레임 상자) */
export const KAYKIT_W = ATLAS.w
export const KAYKIT_H = ATLAS.h
/** 위에서 발바닥 선까지 */
export const KAYKIT_FOOT_Y = ATLAS.footY

/** 크레딧 문구 (CC0 라 표시 의무는 없지만 원작자를 밝힌다) */
export const CREDITS = ['3D characters: "KayKit : Adventurers Character Pack" by Kay Lousberg (www.kaylousberg.com), CC0 1.0 — pre-rendered to sprites and recoloured for this app.']

const COUNTS: Record<PartKey, number> = {
  skin: ATLAS.skins.length,
  hairStyle: ATLAS.heads.length,
  hairColor: ATLAS.hairColors.length,
  outfit: ATLAS.outfits.length,
  outfitColor: ATLAS.outfitColors.length,
  accessory: ATLAS.accs.length + 1,
}

export const PART_DEFS: PartDef[] = [
  { key: 'hairStyle', label: '머리 모양', options: ATLAS.heads.map((h) => ({ label: h.label })) },
  { key: 'hairColor', label: '머리 색', options: ATLAS.hairColors.map((c) => ({ label: c.label, swatch: c.swatch })) },
  { key: 'outfit', label: '의상', options: ATLAS.outfits.map((o) => ({ label: o.label })) },
  { key: 'outfitColor', label: '의상 색', options: ATLAS.outfitColors.map((c) => ({ label: c.label, swatch: c.swatch })) },
  { key: 'accessory', label: '액세서리', options: [{ label: '없음' }, ...ATLAS.accs.map((a) => ({ label: a.label }))] },
  { key: 'skin', label: '피부', options: ATLAS.skins.map((c) => ({ label: c.label, swatch: c.swatch })) },
]

export function normalizeAppearance(input: AppearanceParts): AppearanceParts {
  return clampLook(ATLAS, input)
}

/** 신랑·신부 몫: 의상 0·1번(턱시도·웨딩드레스)과 신부의 면사포·부케 */
export const COUPLE_OUTFITS: readonly number[] = [ATLAS.groom.outfit, ATLAS.bride.outfit]
export const COUPLE_ACCESSORIES: readonly number[] = ATLAS.accs.map((a, i) => (a.couple ? i + 1 : 0)).filter((i) => i > 0)
const GUEST_OUTFITS = ATLAS.outfits.map((_, i) => i).filter((i) => !COUPLE_OUTFITS.includes(i))
const GUEST_ACCS = ATLAS.accs.map((_, i) => i + 1).filter((i) => !COUPLE_ACCESSORIES.includes(i))
/** 후드를 쓴 머리에는 모자류를 얹지 않는다 (후드 위에 모자가 겹쳐 보인다) */
const GUEST_ACCS_NO_HAT = GUEST_ACCS.filter((i) => !ATLAS.accs[i - 1].hat)
/** 밝은 피부 3종 · 자연스러운 머리 색 4종 (목록의 앞쪽) */
const LIGHT_SKINS = 3
const NATURAL_HAIRS = 4

/** 하객용 랜덤: 턱시도·웨딩드레스·면사포는 빼고, 옷은 절반쯤 원래 색, 액세서리는 절반쯤 없음 */
export function randomAppearance(rnd: () => number = Math.random): AppearanceParts {
  const pick = (n: number) => Math.min(n - 1, Math.floor(rnd() * n))
  const hairStyle = pick(COUNTS.hairStyle)
  const accs = ATLAS.heads[hairStyle].hood ? GUEST_ACCS_NO_HAT : GUEST_ACCS
  return {
    skin: rnd() < 0.7 ? pick(LIGHT_SKINS) : pick(COUNTS.skin),
    hairStyle,
    hairColor: rnd() < 0.65 ? pick(NATURAL_HAIRS) : pick(COUNTS.hairColor),
    outfit: GUEST_OUTFITS[pick(GUEST_OUTFITS.length)],
    outfitColor: rnd() < 0.5 ? 0 : 1 + pick(COUNTS.outfitColor - 1),
    accessory: rnd() < 0.5 ? 0 : accs[pick(accs.length)],
  }
}

function lookOf(kind: SpriteKind): AppearanceParts {
  if (kind === 'groom') return ATLAS.groom
  if (kind === 'bride') return ATLAS.bride
  return normalizeAppearance(kind)
}

/* ── 아틀라스 불러오기 ───────────────────────────────────── */

let pixels: { color: Pixels; mask: Pixels } | null = null
let loading: Promise<void> | null = null

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했어요: ${url}`))
    img.src = url
  })
}

function readPixels(img: HTMLImageElement): Pixels {
  if (img.naturalWidth !== ATLAS.size[0] || img.naturalHeight !== ATLAS.size[1]) {
    throw new Error('kaykit 아틀라스와 atlas.ts 가 어긋나요 — art/kaykit/build.mjs 를 다시 실행하세요.')
  }
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('캔버스를 만들 수 없어요.')
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, c.width, c.height).data
  // 읽고 난 캔버스는 바로 비운다 (큰 캔버스가 메모리에 남지 않게)
  c.width = c.height = 0
  return { data, width: img.naturalWidth }
}

/** 아틀라스를 불러온다 (여러 번 불러도 한 번만 받는다). 실패하면 다음 호출에서 다시 시도 */
export function load(): Promise<void> {
  if (pixels) return Promise.resolve()
  loading ??= Promise.all([loadImage(atlasUrl), loadImage(maskUrl)])
    .then(([color, mask]) => {
      pixels = { color: readPixels(color), mask: readPixels(mask) }
      clearSpriteCache()
    })
    .finally(() => {
      loading = null
    })
  return loading
}

/* ── 캐시 ────────────────────────────────────────────────── */

interface Entry {
  canvas: HTMLCanvasElement
  px: number
}
const cache = new Map<string, Entry>()
let cachePixels = 0
const CACHE_MAX_ENTRIES = 400
/** 캔버스 픽셀 합계 상한 (약 48MB) — 프레임 상자가 커서 장수만으로는 메모리를 가늠할 수 없다 */
const CACHE_MAX_PIXELS = 12_000_000

export function clearSpriteCache(): void {
  cache.clear()
  cachePixels = 0
}

/** 배율을 0.05 단위로 맞춘다 (캐시가 배율마다 갈라지지 않게). 구운 해상도의 2배까지만 */
export function quantizeScale(scale: number): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1
  return Math.min(2, Math.max(0.1, Math.round(s * 20) / 20))
}

/** 원본 크기로 조합할 때 쓰는 작업용 캔버스 (한 장을 돌려 쓴다) */
let scratch: HTMLCanvasElement | null = null

/** 발밑 그림자 (명목 단위): 가로 반지름 · 세로 반지름 */
const SHADOW_RX = 44
const SHADOW_RY = 15

/**
 * 스프라이트 캔버스 (KAYKIT_W*scale x KAYKIT_H*scale). scale = 명목 1단위당 픽셀.
 * load() 가 끝나기 전에는 빈 캔버스를 돌려준다 (캐시에 남기지 않는다).
 */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame, scale: number = 1): HTMLCanvasElement {
  const sc = quantizeScale(scale)
  const a = lookOf(kind)
  const f: Frame = frame === 1 || frame === 2 ? frame : 0
  const key = `${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}|${dir}${f}|${sc}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit.canvas
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(KAYKIT_W * sc)
  canvas.height = Math.ceil(KAYKIT_H * sc)
  const ctx = canvas.getContext('2d')
  if (!ctx || !pixels) return canvas

  scratch ??= document.createElement('canvas')
  if (scratch.width !== KAYKIT_W || scratch.height !== KAYKIT_H) {
    scratch.width = KAYKIT_W
    scratch.height = KAYKIT_H
  }
  const sctx = scratch.getContext('2d')
  if (!sctx) return canvas
  const img = sctx.createImageData(KAYKIT_W, KAYKIT_H)
  img.data.set(compose(ATLAS, pixels.color, pixels.mask, a, Math.max(0, ATLAS.dirs.indexOf(dir)), f))
  sctx.putImageData(img, 0, 0)

  ctx.setTransform(sc, 0, 0, sc, 0, 0)
  ctx.fillStyle = 'rgba(52, 44, 60, 0.2)'
  ctx.beginPath()
  ctx.ellipse(KAYKIT_W / 2, KAYKIT_FOOT_Y - 1, SHADOW_RX, SHADOW_RY, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(scratch, 0, 0)

  const px = canvas.width * canvas.height
  cache.set(key, { canvas, px })
  cachePixels += px
  while (cache.size > CACHE_MAX_ENTRIES || cachePixels > CACHE_MAX_PIXELS) {
    const first = cache.keys().next().value
    if (first === undefined) break
    cachePixels -= cache.get(first)?.px ?? 0
    cache.delete(first)
  }
  return canvas
}
