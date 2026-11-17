/**
 * 숲속 주민(벡터) 스타일의 DOM 없는 부분 검증: 외형 보정 퍼즈, 모든 옵션 인덱스 유효성,
 * 그리고 가짜 캔버스로 모든 (옵션 x 방향 x 프레임) 렌더 경로가 예외 없이 도는지 + LRU 캐시 동작.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Appearance, PartKey } from '../../types'
import { ACCESSORIES } from './accessories'
import { HAIRS } from './hair'
import {
  clearSpriteCache,
  FOREST_FOOT_Y,
  FOREST_H,
  FOREST_W,
  getSprite,
  MAX_DPR,
  MAX_SCALE,
  normalizeAppearance,
  PART_DEFS,
  randomAppearance,
  spriteCacheStats,
  spriteScale,
  STYLE_INFO,
} from './index'
import type { Dir, Frame, SpriteKind } from './index'
import { OUTFITS } from './outfits'
import { HAIR_COLORS, OUTFIT_COLORS, SKINS } from './palette'
import { CACHE_MAX_ENTRIES, CACHE_MAX_PIXELS } from './sprites'

const KEYS: (PartKey)[] = ['skin', 'hairStyle', 'hairColor', 'outfit', 'outfitColor', 'accessory']
const counts = Object.fromEntries(PART_DEFS.map((p) => [p.key, p.options.length])) as Record<PartKey, number>
const DIRS: Dir[] = ['down', 'left', 'right', 'up']
const FRAMES: Frame[] = [0, 1, 2]

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function isValid(a: Appearance): boolean {
  return KEYS.every((k) => Number.isInteger(a[k]) && a[k] >= 0 && a[k] < counts[k])
}

describe('PART_DEFS', () => {
  it('covers every appearance key exactly once, with labelled options', () => {
    expect(PART_DEFS.map((p) => p.key).sort()).toEqual([...KEYS].sort())
    for (const p of PART_DEFS) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.options.length).toBeGreaterThan(1)
      for (const o of p.options) expect(o.label.length).toBeGreaterThan(0)
    }
  })
  it('option counts match the underlying tables', () => {
    expect(counts).toEqual({
      skin: SKINS.length,
      hairStyle: HAIRS.length,
      hairColor: HAIR_COLORS.length,
      outfit: OUTFITS.length,
      outfitColor: OUTFIT_COLORS.length,
      accessory: ACCESSORIES.length,
    })
  })
  it('colour options carry a #rrggbb swatch', () => {
    for (const p of PART_DEFS) {
      if (p.key !== 'skin' && p.key !== 'hairColor' && p.key !== 'outfitColor') continue
      for (const o of p.options) expect(o.swatch).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
  it('accessory 0 means "none"', () => {
    expect(ACCESSORIES[0].label).toBe('없음')
  })
})

describe('STYLE_INFO', () => {
  it('describes the style for an integrator', () => {
    expect(STYLE_INFO.id).toBe('forest')
    expect(STYLE_INFO.label.length).toBeGreaterThan(0)
    expect(STYLE_INFO.nominalW).toBe(FOREST_W)
    expect(STYLE_INFO.nominalH).toBe(FOREST_H)
    expect(STYLE_INFO.footY).toBe(FOREST_FOOT_Y)
    expect(STYLE_INFO.footY).toBeGreaterThan(FOREST_H * 0.9)
    expect(STYLE_INFO.footY).toBeLessThanOrEqual(FOREST_H)
    expect(STYLE_INFO.pixelated).toBe(false)
    expect(STYLE_INFO.recommendedCssHeight).toBeGreaterThanOrEqual(60)
  })
})

describe('randomAppearance', () => {
  it('always yields valid indices and eventually reaches every option', () => {
    const r = rng(1)
    const seen = Object.fromEntries(KEYS.map((k) => [k, new Set<number>()])) as Record<PartKey, Set<number>>
    for (let i = 0; i < 4000; i++) {
      const a = randomAppearance(r)
      expect(isValid(a)).toBe(true)
      for (const k of KEYS) seen[k].add(a[k])
    }
    for (const k of KEYS) expect(seen[k].size).toBe(counts[k])
  })
  it('stays in range at the extremes of the random source', () => {
    expect(isValid(randomAppearance(() => 0))).toBe(true)
    expect(isValid(randomAppearance(() => 0.999999999))).toBe(true)
    expect(isValid(randomAppearance(() => 1))).toBe(true)
  })
})

describe('normalizeAppearance', () => {
  it('is the identity on valid appearances', () => {
    const r = rng(2)
    for (let i = 0; i < 500; i++) {
      const a = randomAppearance(r)
      expect(normalizeAppearance(a)).toEqual(a)
    }
  })
  it('survives garbage input (fuzz) and is idempotent', () => {
    const r = rng(3)
    const junk: unknown[] = [undefined, null, NaN, Infinity, -Infinity, -1, -0.4, 0.5, 1e9, '3', ' 2 ', '', 'x', true, [], {}, () => 1, 2.5, -7, 999]
    const pick = () => (r() < 0.3 ? Math.round((r() - 0.3) * 40) : junk[Math.floor(r() * junk.length)])
    for (let i = 0; i < 3000; i++) {
      const input: Record<string, unknown> = {}
      for (const k of KEYS) if (r() > 0.15) input[k] = pick()
      if (r() < 0.2) input.extra = 'ignored'
      const a = normalizeAppearance(input)
      expect(isValid(a)).toBe(true)
      expect(Object.keys(a).sort()).toEqual([...KEYS].sort())
      expect(normalizeAppearance(a)).toEqual(a)
    }
    for (const bad of [undefined, null, 0, 'str', [], true, Symbol('s')]) expect(isValid(normalizeAppearance(bad))).toBe(true)
  })
  it('clamps out-of-range values to the nearest valid index', () => {
    const a = normalizeAppearance({ skin: -5, hairStyle: 9999, hairColor: '2', outfit: 1.4, outfitColor: 1.6, accessory: NaN })
    expect(a).toEqual({ skin: 0, hairStyle: counts.hairStyle - 1, hairColor: 2, outfit: 1, outfitColor: 2, accessory: 0 })
  })
})

describe('spriteScale', () => {
  it('multiplies by devicePixelRatio but caps it at MAX_DPR', () => {
    expect(spriteScale(2, 1)).toBe(2)
    expect(spriteScale(2, 2)).toBe(4)
    expect(spriteScale(2, 3)).toBe(2 * MAX_DPR)
    expect(spriteScale(2, 0.5)).toBe(2)
    expect(spriteScale(1000, 3)).toBe(MAX_SCALE)
  })
  it('defaults to DPR 1 without a window', () => {
    expect(spriteScale(2.2)).toBeCloseTo(2.2, 5)
  })
})

/* ── 가짜 캔버스: 모든 그리기 호출을 받아 주기만 한다 ───────────── */
describe('getSprite (stubbed canvas)', () => {
  const g = globalThis as Record<string, unknown>
  const saved = { Path2D: g.Path2D, document: g.document }
  let calls = 0
  beforeAll(() => {
    g.Path2D = class {
      moveTo(): void {}
      lineTo(): void {}
      bezierCurveTo(): void {}
      quadraticCurveTo(): void {}
      arc(): void {}
      ellipse(): void {}
      closePath(): void {}
    }
    const makeCtx = (): unknown => {
      const state: Record<string, unknown> = { globalAlpha: 1 }
      return new Proxy(state, {
        get(t, prop: string) {
          if (prop in t) return t[prop]
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} })
          return () => {
            calls++
          }
        },
        set(t, prop: string, v) {
          t[prop] = v
          return true
        },
      })
    }
    g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }) }
  })
  afterAll(() => {
    g.Path2D = saved.Path2D
    g.document = saved.document
    clearSpriteCache()
  })

  const base: Appearance = { skin: 1, hairStyle: 0, hairColor: 1, outfit: 0, outfitColor: 1, accessory: 0 }

  it('renders every option of every part in every direction and frame without throwing', () => {
    clearSpriteCache()
    const kinds: SpriteKind[] = ['groom', 'bride']
    for (const k of KEYS) for (let i = 0; i < counts[k]; i++) kinds.push({ ...base, [k]: i })
    // 머리 x 의상, 머리 x 액세서리 조합도 전부
    for (let h = 0; h < counts.hairStyle; h++) {
      for (let o = 0; o < counts.outfit; o++) kinds.push({ ...base, hairStyle: h, outfit: o })
      for (let x = 0; x < counts.accessory; x++) kinds.push({ ...base, hairStyle: h, accessory: x })
    }
    for (const kind of kinds) {
      // 같은 외형이 여러 번 나와도 매번 실제로 그리도록 캐시를 비운다
      clearSpriteCache()
      for (const d of DIRS) {
        for (const f of FRAMES) {
          const before = calls
          const c = getSprite(kind, d, f, 2)
          expect(c.width).toBe(FOREST_W * 2)
          expect(c.height).toBe(FOREST_H * 2)
          expect(calls).toBeGreaterThan(before + 20)
        }
      }
    }
  })

  it('caches per (appearance, dir, frame, scale) and treats equivalent inputs as one key', () => {
    clearSpriteCache()
    const a = getSprite(base, 'down', 0, 2)
    expect(getSprite({ ...base }, 'down', 0, 2)).toBe(a)
    expect(getSprite({ ...base, skin: 1.2 } as Appearance, 'down', 0, 2.01)).toBe(a)
    expect(getSprite(base, 'down', 1, 2)).not.toBe(a)
    expect(getSprite(base, 'left', 0, 2)).not.toBe(a)
    expect(getSprite(base, 'down', 0, 3)).not.toBe(a)
    expect(getSprite({ ...base, accessory: 1 }, 'down', 0, 2)).not.toBe(a)
    expect(spriteCacheStats().entries).toBe(5)
  })

  it('clamps the baked scale', () => {
    clearSpriteCache()
    expect(getSprite(base, 'down', 0, 500).width).toBe(FOREST_W * MAX_SCALE)
    expect(getSprite(base, 'down', 0, -3).width).toBe(Math.ceil(FOREST_W * 0.25))
    expect(getSprite(base, 'down', 0, NaN).width).toBe(FOREST_W * 2)
  })

  it('evicts least-recently-used sprites and never exceeds the caps', () => {
    clearSpriteCache()
    const r = rng(9)
    const first = getSprite(base, 'down', 0, 4.45)
    let keepAlive = first
    for (let i = 0; i < CACHE_MAX_ENTRIES * 2; i++) {
      getSprite(randomAppearance(r), DIRS[i % 4], (i % 3) as Frame, 4.45)
      // 계속 쓰는 스프라이트는 살아남는다
      if (i % 50 === 0) keepAlive = getSprite(base, 'down', 0, 4.45)
      const st = spriteCacheStats()
      expect(st.entries).toBeLessThanOrEqual(CACHE_MAX_ENTRIES)
      expect(st.pixels).toBeLessThanOrEqual(CACHE_MAX_PIXELS)
    }
    expect(keepAlive).toBe(first)
    expect(getSprite(base, 'down', 0, 4.45)).toBe(first)
    // 큰 스프라이트는 픽셀 예산으로 제한된다
    clearSpriteCache()
    for (let i = 0; i < 400; i++) getSprite(randomAppearance(r), 'down', 0, MAX_SCALE)
    expect(spriteCacheStats().pixels).toBeLessThanOrEqual(CACHE_MAX_PIXELS)
    expect(spriteCacheStats().entries).toBeLessThan(400)
    clearSpriteCache()
    expect(spriteCacheStats()).toEqual({ entries: 0, pixels: 0 })
  })
})
