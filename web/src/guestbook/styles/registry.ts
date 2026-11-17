/**
 * 캐릭터 그림체(스타일) 등록부 — 하객마다 고른 그림체가 한 장면에 섞여 나온다.
 *
 *  - pixel  : 기본 픽셀 (../character) — 항상 번들에 포함. 신랑·신부도 이 그림체.
 *  - maple  : SD 캐릭터 (./maple, 48x64 도트) — 필요할 때 동적 import
 *  - forest : 숲속 주민 (./forest, 벡터)      — 필요할 때 동적 import
 *
 * 스타일마다 파츠 목록·개수가 달라 외형 인덱스는 스타일과 함께일 때만 의미가 있다.
 * 그래서 "메타"(이름·치수·옵션 개수·장면 배치 수치)는 여기 정적으로 두어 모듈이 아직 안 왔어도
 * 정규화·배치를 할 수 있게 하고, 그리기(getSprite)·파츠 정의(PART_DEFS)만 모듈에서 가져온다.
 * (옵션 개수가 모듈과 어긋나지 않는지는 registry.test.ts 가 지킨다)
 */
import type { Appearance, AppearanceParts, CharacterStyleId, PartKey } from '../types'
import * as pixelModule from '../character'
import type { Dir, Frame, PartDef } from '../character'

export type StyleId = CharacterStyleId
export type { Dir, Frame, PartDef }
/** 하객 외형 또는 고정 캐릭터(신랑/신부 — 지금은 항상 기본 픽셀) */
export type SpriteKind = Appearance | 'groom' | 'bride'

export const DEFAULT_STYLE: StyleId = 'pixel'
/** 만들기 화면에 보이는 순서 */
export const STYLE_IDS: readonly StyleId[] = ['pixel', 'maple', 'forest']

export const PART_KEYS: readonly PartKey[] = ['skin', 'hairStyle', 'hairColor', 'outfit', 'outfitColor', 'accessory']

export interface StyleMeta {
  id: StyleId
  /** 화면에 보이는 이름 (게임 상표를 쓰지 않는다) */
  label: string
  description: string
  /** 스프라이트의 명목 크기 (픽셀 그림체는 원본 도트 수) */
  nominalW: number
  nominalH: number
  /** 위에서부터 발바닥(접지선)까지의 명목 거리 — 장면에서는 이 선이 캐릭터 위치(y)에 온다. 가로 기준은 중앙 */
  footY: number
  /** true = 도트(최근접 확대), false = 벡터(기기 해상도로 직접 그림) */
  pixelated: boolean
  /** true 면 확대 배율을 기기 픽셀의 정수배로 맞춘다 (도트가 고르게 보이도록) */
  snap: boolean
  /** 장면(월드)에서 스프라이트 전체를 얼마나 크게 그릴지 — 논리 px 높이. 세 그림체의 키가 비슷해지는 값 */
  worldH: number
  /** 발에서 머리 꼭대기까지의 높이 ÷ nominalH (이름표·말풍선·탭 판정용) */
  headFrac: number
  /** 스프라이트에 그림자가 들어 있으면 0, 아니면 장면이 그리는 그림자 반너비(논리 px) */
  shadowR: number
  /** 포커스 링·탭 판정 반너비(논리 px) */
  halfW: number
  /** 이웃과의 간격 배수 (몸집이 큰 그림체는 조금 더 떨어져 선다) */
  sep: number
  /** 상반신 썸네일: 위에서 top 만큼 건너뛰고, 가로 w 만큼이 상자 너비에 차도록 확대 (명목 단위) */
  bust: { top: number; w: number }
  /** 파츠별 옵션 개수 */
  counts: Readonly<Record<PartKey, number>>
}

export const STYLE_META: Readonly<Record<StyleId, StyleMeta>> = {
  pixel: {
    id: 'pixel',
    label: '기본 픽셀',
    description: '또렷한 도트 캐릭터',
    nominalW: pixelModule.SPRITE_W,
    nominalH: pixelModule.SPRITE_H,
    footY: pixelModule.SPRITE_H,
    pixelated: true,
    snap: false, // 장면 자체가 이 그림체의 도트 배율로 그려진다
    worldH: pixelModule.SPRITE_H,
    headFrac: 1,
    shadowR: 7,
    halfW: 10,
    sep: 1,
    bust: { top: 0, w: pixelModule.SPRITE_W },
    counts: { skin: 6, hairStyle: 12, hairColor: 10, outfit: 10, outfitColor: 12, accessory: 11 },
  },
  maple: {
    id: 'maple',
    label: 'SD 캐릭터',
    description: '머리가 큰 2등신 도트',
    nominalW: 48,
    nominalH: 64,
    footY: 63,
    pixelated: true,
    snap: true,
    // 인물 키(약 55도트)가 기본 픽셀(약 35)과 비슷해지는 높이. 실제로는 가장 가까운 정수 배율로 그린다
    worldH: 40,
    headFrac: 56 / 64,
    shadowR: 8,
    halfW: 12,
    sep: 1.15,
    bust: { top: 3, w: 40 },
    counts: { skin: 6, hairStyle: 12, hairColor: 12, outfit: 11, outfitColor: 12, accessory: 10 },
  },
  forest: {
    id: 'forest',
    label: '숲속 주민',
    description: '동글동글 부드러운 그림',
    nominalW: 28,
    nominalH: 36,
    footY: 104 / 3,
    pixelated: false,
    snap: false,
    // 명목 높이(36)보다 조금 크게: 머리가 둥글고 커서 같은 높이면 다른 그림체보다 작아 보인다
    worldH: 38,
    headFrac: 33.5 / 36,
    shadowR: 0,
    halfW: 11,
    sep: 1.1,
    bust: { top: 0.5, w: 26.5 },
    counts: { skin: 6, hairStyle: 11, hairColor: 10, outfit: 10, outfitColor: 12, accessory: 10 },
  },
}

/** 스타일 모듈이 내놓는 것 (세 모듈이 같은 모양) */
export interface StyleModule {
  partDefs: PartDef[]
  randomAppearance: (rnd?: () => number) => AppearanceParts
  normalizeAppearance: (input: AppearanceParts) => AppearanceParts
  /** scale: 벡터 그림체만 사용 (명목 1단위당 픽셀) */
  getSprite: (kind: SpriteKind, dir: Dir, frame: Frame, scale?: number) => HTMLCanvasElement
  /** 구워 둔 스프라이트 캔버스를 버린다 (캐시를 쌓는 그림체만) */
  clearCache?: () => void
}

/** 메타 + (불러온) 모듈을 하나로 묶은 스타일. randomAppearance/normalizeAppearance 는 style 꼬리표까지 붙여 돌려준다 */
export interface CharacterStyle extends StyleMeta {
  partDefs: PartDef[]
  randomAppearance: (rnd?: () => number) => Appearance
  normalizeAppearance: (input: unknown) => Appearance
  getSprite: StyleModule['getSprite']
  clearCache?: () => void
}

/* ── 정규화 (모듈 없이 동기) ─────────────────────────────── */

export function toStyleId(v: unknown): StyleId {
  return v === 'maple' || v === 'forest' ? v : DEFAULT_STYLE
}

/** 외형(또는 신랑/신부)의 그림체. style 이 없거나 모르는 값이면 기본 픽셀 */
export function styleOf(kind: unknown): StyleId {
  if (typeof kind !== 'object' || kind === null) return DEFAULT_STYLE
  return toStyleId((kind as { style?: unknown }).style)
}

function clampIndex(v: unknown, count: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (Number.isNaN(n)) return 0
  const i = Math.round(n)
  if (!(i >= 0)) return 0
  return i > count - 1 ? count - 1 : i
}

/** 외형에 그림체 꼬리표를 붙인다 — 기본 픽셀이면 style 을 생략 (예전 글과 같은 모양) */
export function withStyle(parts: AppearanceParts, id: StyleId): Appearance {
  const out: Appearance = {
    skin: parts.skin,
    hairStyle: parts.hairStyle,
    hairColor: parts.hairColor,
    outfit: parts.outfit,
    outfitColor: parts.outfitColor,
    accessory: parts.accessory,
  }
  if (id !== DEFAULT_STYLE) out.style = id
  return out
}

/**
 * 임의의 값(서버·localStorage·폼)을 유효한 외형으로 보정한다.
 * 모르는 style → 기본 픽셀, 인덱스는 "그 스타일" 의 옵션 개수로 자른다(음수·NaN → 0, 초과 → 마지막).
 */
export function normalizeAnyAppearance(raw: unknown): Appearance {
  const id = styleOf(raw)
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const counts = STYLE_META[id].counts
  return withStyle(
    {
      skin: clampIndex(o.skin, counts.skin),
      hairStyle: clampIndex(o.hairStyle, counts.hairStyle),
      hairColor: clampIndex(o.hairColor, counts.hairColor),
      outfit: clampIndex(o.outfit, counts.outfit),
      outfitColor: clampIndex(o.outfitColor, counts.outfitColor),
      accessory: clampIndex(o.accessory, counts.accessory),
    },
    id,
  )
}

/** 모듈 없이도 쓸 수 있는 랜덤 외형 (액세서리는 절반쯤 '없음') */
export function randomAppearanceFor(id: StyleId, rnd: () => number = Math.random): Appearance {
  const c = STYLE_META[id].counts
  const pick = (n: number) => Math.min(n - 1, Math.floor(rnd() * n))
  return withStyle(
    {
      skin: pick(c.skin),
      hairStyle: pick(c.hairStyle),
      hairColor: pick(c.hairColor),
      outfit: pick(c.outfit),
      outfitColor: pick(c.outfitColor),
      accessory: rnd() < 0.45 ? 0 : 1 + pick(c.accessory - 1),
    },
    id,
  )
}

/** 캐시·비교용 키 (스타일 + 인덱스) */
export function appearanceKey(kind: SpriteKind): string {
  if (typeof kind === 'string') return kind
  const a = normalizeAnyAppearance(kind)
  return `${a.style ?? DEFAULT_STYLE}:${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}`
}

/* ── 모듈 불러오기 ───────────────────────────────────────── */

function assemble(id: StyleId, mod: StyleModule): CharacterStyle {
  return {
    ...STYLE_META[id],
    partDefs: mod.partDefs,
    randomAppearance: (rnd) => withStyle(mod.randomAppearance(rnd), id),
    normalizeAppearance: (input) => normalizeAnyAppearance({ ...(input as object), style: id }),
    getSprite: mod.getSprite,
    clearCache: mod.clearCache,
  }
}

const loaded: Partial<Record<StyleId, CharacterStyle>> = {
  pixel: assemble('pixel', {
    partDefs: pixelModule.PART_DEFS,
    randomAppearance: pixelModule.randomAppearance,
    normalizeAppearance: pixelModule.normalizeAppearance,
    getSprite: pixelModule.getSprite,
  }),
}

type Importer = () => Promise<StyleModule>
const importers: Record<Exclude<StyleId, 'pixel'>, Importer> = {
  maple: () =>
    import('./maple').then((m) => ({
      partDefs: m.PART_DEFS,
      randomAppearance: m.randomAppearance,
      normalizeAppearance: m.normalizeAppearance,
      // 원본 크기(48x64)만 쓴다 — 확대는 그릴 때 최근접 이웃으로 (미리 확대한 캔버스를 쌓지 않는다)
      getSprite: (kind, dir, frame) => m.getSprite(kind, dir, frame, 1),
    })),
  forest: () =>
    import('./forest').then((m) => ({
      partDefs: m.PART_DEFS,
      randomAppearance: m.randomAppearance,
      normalizeAppearance: m.normalizeAppearance,
      getSprite: m.getSprite,
      clearCache: m.clearSpriteCache,
    })),
}

const pending: Partial<Record<StyleId, Promise<CharacterStyle>>> = {}
const listeners = new Set<() => void>()
let version = 0

/* 불러오기 실패 상태 — 자동 재시도(그리기 루프·effect)는 간격을 두고, 몇 번 실패하면 멈춘다 */
export type StyleStatus = 'idle' | 'loading' | 'ready' | 'failed'
interface Failure {
  /** 연속으로 실패한 loadStyle 횟수 (한 번의 loadStyle 은 import 를 두 번 시도한다) */
  tries: number
  /** 마지막 실패 시각 (Date.now) */
  at: number
}
const failures: Partial<Record<StyleId, Failure>> = {}
const retryTimers: Partial<Record<StyleId, ReturnType<typeof setTimeout>>> = {}
/** 자동 재시도 간격: 5초에서 시작해 두 배씩, 최대 60초 */
export const RETRY_BASE_MS = 5_000
export const RETRY_MAX_MS = 60_000
/** 이만큼 연속 실패하면 자동 재시도를 멈춘다 (다시 시도 버튼·온라인 복귀·탭 복귀 때 풀린다) */
export const MAX_AUTO_TRIES = 6

export function retryDelay(tries: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, tries - 1))
}

function notify(): void {
  version++
  for (const cb of [...listeners]) cb()
}

function clearRetryTimer(id: StyleId): void {
  const t = retryTimers[id]
  if (t !== undefined) {
    clearTimeout(t)
    delete retryTimers[id]
  }
}

/** 자동 호출자(그리기 루프·ensureStyles·useStyle)가 지금 불러오기를 시작해도 되는지 */
function canAutoLoad(id: StyleId): boolean {
  if (loaded[id] || pending[id]) return false
  const f = failures[id]
  if (!f) return true
  if (f.tries >= MAX_AUTO_TRIES) return false
  return Date.now() - f.at >= retryDelay(f.tries)
}

/** 이미 불러온 스타일 (아직이면 null — loadStyle 로 불러온다) */
export function getStyle(id: StyleId): CharacterStyle | null {
  return loaded[id] ?? null
}

export function isStyleLoaded(id: StyleId): boolean {
  return loaded[id] !== undefined
}

/** ready = 준비됨, loading = 불러오는 중, failed = 마지막 시도가 실패함(재시도 대기 또는 포기), idle = 아직 시도 안 함 */
export function styleStatus(id: StyleId): StyleStatus {
  if (loaded[id]) return 'ready'
  if (pending[id]) return 'loading'
  return failures[id] ? 'failed' : 'idle'
}

export function isStyleFailed(id: StyleId): boolean {
  return styleStatus(id) === 'failed'
}

/** 스타일 상태가 바뀔 때마다(준비·실패·재시도 시작·재시도 시점 도래) 올라가는 번호 (useSyncExternalStore 스냅샷) */
export function stylesVersion(): number {
  return version
}

/**
 * 스타일 상태가 바뀔 때 불린다: 모듈 준비, 불러오기 실패, 실패 뒤 재시도 시작, 자동 재시도 시점 도래.
 * (받은 쪽이 다시 그리거나 effect 를 다시 돌리면 그 안의 getSpriteAt/ensureStyles 가 필요한 재시도를 시작한다)
 * 구독 해제 함수를 돌려준다
 */
export function onStyleLoaded(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** 테스트용: 기본 importer 를 바꿔 끼운다 (자동 재시도 경로까지 가짜 importer 를 타도록) */
export function setStyleImporter(id: Exclude<StyleId, 'pixel'>, importer: Importer): void {
  importers[id] = importer
}

/**
 * 스타일 모듈을 불러온다 (한 번만). 실패하면 곧바로 한 번 더 시도하고, 그래도 안 되면 거절한다.
 * 직접 부르면 언제든 새로 시도한다 — 간격 제한은 자동 호출자(getSpriteAt·ensureStyles·autoLoadStyle)에만 걸린다.
 */
export function loadStyle(id: StyleId, importer?: Importer): Promise<CharacterStyle> {
  const hit = loaded[id]
  if (hit) return Promise.resolve(hit)
  const running = pending[id]
  if (running) return running
  const load = importer ?? importers[id as Exclude<StyleId, 'pixel'>]
  clearRetryTimer(id)
  const p = load()
    .catch(() => load())
    .then(
      (mod) => {
        const style = assemble(id, mod)
        loaded[id] = style
        delete pending[id]
        delete failures[id]
        notify()
        return style
      },
      (err: unknown) => {
        delete pending[id]
        const tries = (failures[id]?.tries ?? 0) + 1
        failures[id] = { tries, at: Date.now() }
        if (tries < MAX_AUTO_TRIES) {
          // 재시도 시점이 되면 구독자를 깨운다 — 애니메이션 없이 멈춰 있는 화면(만들기·정지 장면)도 다시 시도하도록
          const t = setTimeout(() => {
            delete retryTimers[id]
            if (!loaded[id] && !pending[id]) notify()
          }, retryDelay(tries))
          ;(t as { unref?: () => void }).unref?.()
          retryTimers[id] = t
        }
        notify()
        throw err
      },
    )
  pending[id] = p
  // 실패 표시를 보고 있던 화면이 "불러오는 중" 으로 바뀌도록
  if (failures[id]) notify()
  return p
}

/** 자동 호출용: 간격 제한을 지키며 불러오기를 시작한다 (실패는 조용히). 이미 있거나 진행 중이거나 아직 기다릴 때면 아무 일도 없다 */
export function autoLoadStyle(id: StyleId): void {
  if (canAutoLoad(id)) loadStyle(id).catch(() => {})
}

/** 사용자가 "다시 시도" 를 눌렀을 때: 실패 기록을 지우고 바로 불러온다 */
export function retryStyle(id: StyleId): void {
  if (loaded[id] || pending[id]) return
  delete failures[id]
  loadStyle(id).catch(() => {})
}

/** 실패한 스타일의 대기 시간을 없앤다 — 네트워크가 돌아왔거나 탭으로 돌아왔을 때 곧바로 다시 시도할 수 있게 */
export function resetStyleFailures(): void {
  let any = false
  for (const id of STYLE_IDS) {
    if (!failures[id] || loaded[id]) continue
    failures[id] = { tries: 0, at: Number.NEGATIVE_INFINITY }
    clearRetryTimer(id)
    any = true
  }
  if (any) notify()
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('online', resetStyleFailures)
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') resetStyleFailures()
    })
  }
}

/** 주어진 외형들이 쓰는 스타일 가운데 아직 없는 모듈을 불러오기 시작한다 (실패는 조용히 — 간격을 두고 다시 시도) */
export function ensureStyles(kinds: Iterable<unknown>): void {
  for (const k of kinds) autoLoadStyle(styleOf(k))
}

/** 구워 둔 스프라이트 캔버스를 버린다 (벡터 그림체의 캐시). 필요한 것은 다음에 그릴 때 다시 굽는다 */
export function trimSpriteCaches(): void {
  for (const id of STYLE_IDS) loaded[id]?.clearCache?.()
}

/* ── 그리기 ──────────────────────────────────────────────── */

/**
 * 스프라이트 명목 1단위를 기기 픽셀 몇 개로 그릴지.
 * pxPerUnit = 월드 논리 px 하나의 기기 픽셀 수 (미리보기에서는 CSS 배율 x devicePixelRatio).
 * snap 스타일은 목표에 (비율로) 가장 가까운 정수배(최소 1)로 맞춘다.
 */
export function spriteScale(id: StyleId, pxPerUnit: number): number {
  const m = STYLE_META[id]
  const s = (pxPerUnit * m.worldH) / m.nominalH
  if (!m.snap) return s
  // 크기 "비율" 이 가장 가까운 정수: 아래(f)·위(f+1) 가운데 s/f 와 (f+1)/s 중 작은 쪽
  const f = Math.floor(s)
  if (f < 1) return 1
  return s * s > f * (f + 1) ? f + 1 : f
}

/** 벡터 그림체는 devicePixelRatio 2 까지만 굽는다 (3x 폰에서 캔버스 메모리가 2.25배로 느는 것을 막음) */
export const MAX_VECTOR_DPR = 2

/** 벡터 스프라이트를 요청 배율보다 얼마나 작게 굽는지 (0~1). dpr <= 2 면 1 */
export function vectorBakeRatio(dpr?: number): number {
  const d = dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1)
  return typeof d === 'number' && d > MAX_VECTOR_DPR ? MAX_VECTOR_DPR / d : 1
}

/**
 * 배율(명목 1단위당 기기 픽셀)에 맞는 스프라이트 캔버스. 스타일 모듈이 아직 없으면 null
 * (불러오기는 시작한다 — 실패한 뒤에는 간격을 두고만 다시 시도하므로 매 프레임 불러도 된다).
 * 도트 그림체는 원본 크기 캔버스를 돌려주므로 배율만큼 최근접 확대해 그리고,
 * 벡터 그림체는 그 배율(dpr 2 초과분은 뺀)로 구운 캔버스다. 어느 쪽이든 blitScale 을 곱해 그린다.
 */
export function getSpriteAt(kind: SpriteKind, dir: Dir, frame: Frame, scale: number): HTMLCanvasElement | null {
  const id = styleOf(kind)
  const style = loaded[id]
  if (!style) {
    autoLoadStyle(id)
    return null
  }
  return style.pixelated
    ? style.getSprite(kind, dir, frame)
    : style.getSprite(kind, dir, frame, scale * vectorBakeRatio())
}

/** 월드용: 논리 px 하나가 기기 픽셀 pxPerLogicalUnit 개일 때의 스프라이트 캔버스 (없으면 null) */
export function getSpriteFor(
  kind: SpriteKind,
  dir: Dir,
  frame: Frame,
  pxPerLogicalUnit: number,
): HTMLCanvasElement | null {
  return getSpriteAt(kind, dir, frame, spriteScale(styleOf(kind), pxPerLogicalUnit))
}

/** getSpriteAt 캔버스를 그릴 때 곱할 배율 (도트 = scale, 벡터 = 1 — dpr 이 2 를 넘으면 덜 구운 만큼 dpr/2) */
export function blitScale(id: StyleId, scale: number): number {
  return STYLE_META[id].pixelated ? scale : 1 / vectorBakeRatio()
}

/** 장면에서 실제로 그려지는 스프라이트 전체 높이(논리 px) — snap 때문에 worldH 와 조금 다를 수 있다 */
export function drawnHeight(id: StyleId, pxPerUnit: number): number {
  const m = STYLE_META[id]
  return (m.nominalH * spriteScale(id, pxPerUnit)) / pxPerUnit
}

/** 발에서 머리 꼭대기까지의 높이(논리 px) */
export function headHeight(id: StyleId, pxPerUnit: number): number {
  return drawnHeight(id, pxPerUnit) * STYLE_META[id].headFrac
}
