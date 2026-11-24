/**
 * "메이플(테스트)" 그림체 — 품질 비교를 위한 비공개 테스트 전용.
 * 참고 게임의 캐릭터 파츠를 그대로(다시 그리지 않고) 쓴다: 팬 API(maplestory.io)에서 아이템 레이어를 받아
 * 로컬 아틀라스로 구워 두고(art/msref/build.py), 게임과 같은 규칙으로 여기서 조합한다.
 *
 *  - 몸의 기준점(navel/neck/brow)에 맞춘 레이어 좌표·z 순서·가림 규칙(모자가 윗머리를 숨기는 식)은
 *    빌드 때 계산해 assets/atlas.json 에 들어 있다. 빌드 스크립트가 API 의 조합 결과와 픽셀 단위로 같은지 검증한다.
 *  - 머리 색은 틴트가 아니라 게임 원래의 색 변형(아이템이 따로 있다), 피부도 원래의 피부 아이템.
 *  - 원본에는 옷 색 변형이 없어서 'outfitColor' 칸을 "얼굴" 고르기로 쓴다 (PART_DEFS 의 라벨 참고).
 *  - 그림은 왼쪽을 본다 — 오른쪽은 좌우 반전. 걷기는 원본 walk1 동작.
 *
 * 내려받은 그림(assets/)은 저장소에 없다. 그래서 정적 import 대신 import.meta.glob 으로 찾고,
 * 없으면 load() 가 거절한다 (등록부가 "불러오지 못했어요" 로 처리). 이름·개수·치수는 catalog.ts 에 있어 에셋 없이도 빌드된다.
 */
import type { AppearanceParts, PartKey } from '../../types'
import type { Dir, Frame, PartDef, SpriteKind } from '../../character'
import {
  ACCESSORIES,
  BRIDE,
  FACES,
  GROOM,
  HAIRS,
  HAIR_COLORS,
  MSREF_FOOT_Y,
  MSREF_H,
  MSREF_W,
  OUTFITS,
  POSES,
  SKINS,
} from './catalog'

export type { Dir, Frame, PartDef, SpriteKind }

/** 스프라이트 명목 크기 (원본 도트 그대로) / 위에서 발밑까지 */
export const SPRITE_W = MSREF_W
export const SPRITE_H = MSREF_H
export const FOOT_Y = MSREF_FOOT_Y

/** 원본 동작의 한 장면: stand1 3장(숨쉬기, 장당 약 500ms) + walk1 4장(장당 약 180ms) */
export type Pose = (typeof POSES)[number]
export { POSES }
/**
 * 등록부의 Frame(0 정지, 1·2 걷기) → 원본 장면.
 * walk1 은 0·2번이 발을 모으는 장면(정지 자세와 거의 같다), 1·3번이 발을 벌리고 팔을 엇갈려 흔드는 장면이다
 * (픽셀 비교: 0↔2 는 251px, 0↔정지 554px 차이인데 1·3 은 나머지와 1700px 넘게 다르다 — 머리도 1px 내려간다).
 * 그래서 걷기 4박자 [1,0,2,0] 이 벌린 발(1번) → 정지 → 반대쪽 벌린 발(3번) → 정지로 보이게 1·3번을 쓴다.
 */
const FRAME_POSE: readonly Pose[] = ['stand1:0', 'walk1:1', 'walk1:3']

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

/** 여자 옷(원피스·드레스): 아이템 번호가 1051xxx · 1041xxx 꼴 (천 단위의 끝자리가 1). 등록부의 MSREF_FEMALE_OUTFITS 와 같다 */
const FEMALE_OUTFIT: readonly boolean[] = OUTFITS.map((o) => Math.floor(o.items[0] / 1000) % 10 === 1)
/** 짧은 머리(번호 34000 미만)의 개수 — 목록 앞쪽에 모여 있다. 등록부의 MSREF_SHORT_HAIRS 와 같다 */
const SHORT_HAIRS = HAIRS.filter((h) => h.base < 34000).length
/** 볼터치가 짙게 덧칠된 얼굴 — 원작의 기본 피부 밖에서는 눈가가 얼룩져 보여 랜덤으로는 기본 피부에만 준다 */
const BLUSH_FACE = FACES.findIndex((f) => f.id === 20038)

/**
 * 하객용 랜덤 (등록부의 randomAppearanceFor('msref') 와 같은 규칙):
 *  - 턱시도·웨딩드레스(0·1번)와 웨딩 베일(마지막 액세서리)은 두 사람 몫으로 남긴다. 액세서리는 절반쯤 없음
 *  - 원작의 기본 피부(0번)와 자연스러운 머리 색(앞의 넷)이 많게 — 고르게 뽑으면 형광색 머리·창백한 피부가 절반을 넘는다
 *  - 여자 옷에는 긴 머리가, 그 밖의 옷에는 짧은 머리가 많게
 */
export function randomAppearance(rnd: () => number = Math.random): AppearanceParts {
  const pick = (n: number) => Math.min(n - 1, Math.floor(rnd() * n))
  const outfit = 2 + pick(COUNTS.outfit - 2)
  const long = rnd() < (FEMALE_OUTFIT[outfit] ? 0.85 : 0.15)
  const skin = rnd() < 0.55 ? 0 : pick(COUNTS.skin)
  const face = pick(COUNTS.outfitColor)
  return {
    skin,
    hairStyle: long ? SHORT_HAIRS + pick(COUNTS.hairStyle - SHORT_HAIRS) : pick(SHORT_HAIRS),
    hairColor: rnd() < 0.65 ? pick(4) : pick(COUNTS.hairColor),
    outfit,
    outfitColor: face === BLUSH_FACE && skin !== 0 ? 0 : face,
    accessory: rnd() < 0.5 ? 0 : 1 + pick(COUNTS.accessory - 2),
  }
}

function lookOf(kind: SpriteKind): AppearanceParts {
  const fixed = kind === 'groom' ? GROOM : kind === 'bride' ? BRIDE : null
  if (fixed) {
    return {
      skin: fixed.skin,
      hairStyle: fixed.hair,
      hairColor: fixed.hairColor,
      outfit: fixed.outfit,
      outfitColor: fixed.face,
      accessory: fixed.accessory,
    }
  }
  return normalizeAppearance(kind as AppearanceParts)
}

/** 외형 → 조합할 조각(아이템) 번호. 순서: 몸, 머리통, 얼굴, 머리카락, 옷…, 액세서리… (빌드 스크립트의 검증과 같은 순서) */
function pieceIds(a: AppearanceParts): number[] {
  const skin = SKINS[a.skin].id
  const ids = [skin, 10000 + skin, FACES[a.outfitColor].id, HAIRS[a.hairStyle].base + HAIR_COLORS[a.hairColor].digit]
  ids.push(...OUTFITS[a.outfit].items)
  if (a.accessory > 0) ids.push(...ACCESSORIES[a.accessory - 1].items)
  return ids
}

/* ── 에셋 불러오기 ───────────────────────────────────────── */

/** 레이어 한 장: [아틀라스 칸 번호, x, y (몸 origin = 발밑 기준), z 순서, 슬롯 묶음 번호] */
type LayerRow = readonly [rect: number, x: number, y: number, z: number, slots: number]
interface PieceData {
  /** 슬롯을 차지하는 우선순위 (큰 쪽이 나중에 덮어쓴다) */
  o: number
  /** 이 아이템이 차지하는 슬롯 (예: 모자 = Cp, H1, H5) */
  v: readonly string[]
  /** 장면별 레이어 — 숫자면 "그 번호 장면과 같다" */
  p: readonly (number | readonly LayerRow[])[]
}
interface AtlasMeta {
  v: number
  w: number
  h: number
  /** 몸 origin 의 캔버스 x / y */
  cx: number
  footY: number
  poses: readonly string[]
  rects: readonly (readonly [number, number, number, number])[]
  slotSets: readonly (readonly string[])[]
  pieces: Readonly<Record<string, PieceData>>
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

/** 아틀라스를 불러온다 (여러 번 불러도 한 번만 받는다). 에셋이 없거나 catalog.ts 와 어긋나면 거절 */
export function load(): Promise<void> {
  if (meta && sheet) return Promise.resolve()
  loading ??= (async () => {
    const metaFile = Object.values(META_FILES)[0]
    const imageFile = Object.values(IMAGE_FILES)[0]
    if (!metaFile || !imageFile) {
      throw new Error('msref 에셋이 없어요 — art/msref/build.py fetch, build 를 먼저 실행하세요.')
    }
    const [m, url] = await Promise.all([metaFile(), imageFile()])
    if (m.w !== MSREF_W || m.h !== MSREF_H || m.footY !== MSREF_FOOT_Y || m.poses.join() !== POSES.join()) {
      throw new Error('msref 에셋과 catalog.ts 가 어긋나요 — art/msref/build.py build 를 다시 실행하세요.')
    }
    const img = await loadImage(url)
    meta = m
    sheet = img
  })().finally(() => {
    loading = null
  })
  return loading
}

/* ── 조합 ────────────────────────────────────────────────── */

interface Entry {
  canvas: HTMLCanvasElement
}
const cache = new Map<string, Entry>()
/** 96x86 캔버스 한 장이 약 33KB — 500장이면 16MB 남짓 */
const CACHE_MAX = 500

export function clearSpriteCache(): void {
  cache.clear()
}

function blank(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = MSREF_W
  c.height = MSREF_H
  return c
}
let placeholder: HTMLCanvasElement | null = null

/** 한 장면을 조합해 그린다. 가림 규칙·그리는 순서는 art/msref/build.py 의 compose() 와 같다 */
function paint(ctx: CanvasRenderingContext2D, m: AtlasMeta, img: HTMLImageElement, ids: readonly number[], pose: number): void {
  const pieces: { id: number; d: PieceData }[] = []
  for (const id of ids) {
    const d = m.pieces[id]
    if (d) pieces.push({ id, d })
  }
  // 슬롯 주인: 우선순위(o) 순으로 돌며 나중 것이 덮어쓴다 — 모자(Cp)가 머리카락(Hr)의 H1 을 가져가는 식
  const owner = new Map<string, number>()
  for (const p of [...pieces].sort((a, b) => a.d.o - b.d.o)) {
    for (const s of p.d.v) owner.set(s, p.id)
  }
  const rows: LayerRow[] = []
  for (const p of pieces) {
    let layers = p.d.p[pose]
    if (typeof layers === 'number') layers = p.d.p[layers]
    if (typeof layers === 'number' || !layers) continue
    for (const ly of layers) {
      // 레이어가 쓰는 슬롯 가운데 "이 아이템 몫" 인 슬롯을 다른 아이템에 빼앗겼으면 숨긴다
      let visible = true
      for (const s of m.slotSets[ly[4]]) {
        if (p.d.v.includes(s) && owner.get(s) !== p.id) {
          visible = false
          break
        }
      }
      if (visible) rows.push(ly)
    }
  }
  // z 가 같으면 조각 순서 그대로 (Array.prototype.sort 는 안정 정렬)
  rows.sort((a, b) => a[3] - b[3])
  for (const ly of rows) {
    const r = m.rects[ly[0]]
    ctx.drawImage(img, r[0], r[1], r[2], r[3], m.cx + ly[1], m.footY + ly[2], r[2], r[3])
  }
}

/**
 * 원본 장면(pose)을 직접 고르는 스프라이트 (MSREF_W x MSREF_H, 도트 1:1 — 확대는 그리는 쪽이 최근접 이웃으로).
 * flip = true 면 오른쪽을 본다. load() 가 끝나기 전에는 빈 캔버스를 돌려준다.
 */
export function getPoseSprite(kind: SpriteKind, flip: boolean, pose: Pose): HTMLCanvasElement {
  if (!meta || !sheet) return (placeholder ??= blank())
  const a = lookOf(kind)
  const poseIndex = Math.max(0, POSES.indexOf(pose))
  const key = `${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}|${poseIndex}${flip ? 'R' : 'L'}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit.canvas
  }
  const canvas = blank()
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.imageSmoothingEnabled = false
  // 정수 좌표·등배 복사뿐이라 반전해도 도트가 그대로 옮겨진다
  if (flip) ctx.setTransform(-1, 0, 0, 1, MSREF_W, 0)
  paint(ctx, meta, sheet, pieceIds(a), poseIndex)
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  cache.set(key, { canvas })
  if (cache.size > CACHE_MAX) {
    const first = cache.keys().next().value
    if (first !== undefined) cache.delete(first)
  }
  return canvas
}

/**
 * 방향: 그림은 옆모습(왼쪽 보기)뿐이다. left = 원본, right = 반전.
 * 위·아래로 걸을 때도 옆모습이라 up 은 오른쪽, down 은 왼쪽을 보게 한다.
 * 단, 나란히 서는 두 사람이 마주 보도록 신랑(왼쪽에 선다)의 down 은 오른쪽을 본다.
 */
function facesRight(kind: SpriteKind, dir: Dir): boolean {
  if (dir === 'right' || dir === 'up') return true
  if (dir === 'left') return false
  return kind === 'groom'
}

/** 스프라이트 캔버스 (MSREF_W x MSREF_H). scale 은 쓰지 않는다 — 도트 그림체라 원본 크기만 만든다 */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame, _scale: number = 1): HTMLCanvasElement {
  return getPoseSprite(kind, facesRight(kind, dir), FRAME_POSE[frame] ?? FRAME_POSE[0])
}
