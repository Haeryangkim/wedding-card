import { describe, expect, it } from 'vitest'
import type { Appearance, Dir, Frame, SpriteKind } from './dims'
import { FOOT_Y, MAPLE_H, MAPLE_W } from './dims'
import { ACCESSORIES } from './accessories'
import { HAIRS } from './hair'
import { OUTFITS } from './outfits'
import { HAIR_COLORS, OUTFIT_COLORS, SKINS } from './palette'
import { buildBuffer, normalizeAppearance, PART_DEFS, randomAppearance } from './sprites'

const BASE: Appearance = { skin: 1, hairStyle: 0, hairColor: 1, outfit: 0, outfitColor: 1, accessory: 0 }
const KEYS: (keyof Appearance)[] = ['skin', 'hairStyle', 'hairColor', 'outfit', 'outfitColor', 'accessory']
const DIRS: Dir[] = ['down', 'left', 'right', 'up']
const FRAMES: Frame[] = [0, 1, 2]

const counts = Object.fromEntries(PART_DEFS.map((p) => [p.key, p.options.length])) as Record<keyof Appearance, number>

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function opaque(data: Uint8ClampedArray): number {
  let n = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++
  return n
}
function same(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
/** 맨 아래 불투명 행 */
function bottomRow(data: Uint8ClampedArray): number {
  for (let y = MAPLE_H - 1; y >= 0; y--)
    for (let x = 0; x < MAPLE_W; x++) if (data[(y * MAPLE_W + x) * 4 + 3]) return y
  return -1
}

describe('maple PART_DEFS', () => {
  it('여섯 파츠가 모두 있고 옵션 수가 데이터 표와 같다', () => {
    expect(PART_DEFS.map((p) => p.key)).toEqual(KEYS)
    expect(counts).toEqual({
      skin: SKINS.length,
      hairStyle: HAIRS.length,
      hairColor: HAIR_COLORS.length,
      outfit: OUTFITS.length,
      outfitColor: OUTFIT_COLORS.length,
      accessory: ACCESSORIES.length,
    })
    for (const p of PART_DEFS) for (const o of p.options) expect(o.label.length).toBeGreaterThan(0)
  })
  it('앞머리 표는 모두 20칸', () => {
    for (const h of HAIRS) expect(h.bang).toHaveLength(20)
  })
})

describe('maple normalizeAppearance', () => {
  it('유효한 값은 그대로 둔다', () => {
    expect(normalizeAppearance(BASE)).toEqual(BASE)
  })
  it('null · undefined · 빈 객체는 전부 0', () => {
    const zero = { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0 }
    expect(normalizeAppearance(null)).toEqual(zero)
    expect(normalizeAppearance(undefined)).toEqual(zero)
    expect(normalizeAppearance({})).toEqual(zero)
  })
  it('퍼즈: 어떤 입력이 와도 범위 안의 정수만 나온다', () => {
    const r = rng(1234)
    const junk: unknown[] = [NaN, Infinity, -Infinity, -1, -0.5, 1e9, 2.7, '3', null, undefined, {}, [], true]
    for (let i = 0; i < 3000; i++) {
      const raw: Record<string, unknown> = {}
      for (const k of KEYS) {
        const pick = r()
        if (pick < 0.15) continue
        raw[k] = pick < 0.5 ? junk[Math.floor(r() * junk.length)] : (r() - 0.3) * 40
      }
      const a = normalizeAppearance(raw as Partial<Appearance>)
      for (const k of KEYS) {
        expect(Number.isInteger(a[k])).toBe(true)
        expect(a[k]).toBeGreaterThanOrEqual(0)
        expect(a[k]).toBeLessThan(counts[k])
      }
      // 멱등
      expect(normalizeAppearance(a)).toEqual(a)
    }
  })
  it('randomAppearance 는 항상 유효하다', () => {
    const r = rng(99)
    for (let i = 0; i < 500; i++) {
      const a = randomAppearance(r)
      expect(normalizeAppearance(a)).toEqual(a)
    }
    expect(normalizeAppearance(randomAppearance(() => 0.999999))).toEqual(randomAppearance(() => 0.999999))
  })
})

describe('maple buildBuffer', () => {
  it('모든 옵션 인덱스가 4방향 × 3프레임에서 그려진다', () => {
    for (const k of KEYS)
      for (let i = 0; i < counts[k]; i++) {
        const a = { ...BASE, [k]: i }
        for (const d of DIRS)
          for (const f of FRAMES) {
            const b = buildBuffer(a, d, f)
            expect(b.w).toBe(MAPLE_W)
            expect(b.h).toBe(MAPLE_H)
            expect(b.data.length).toBe(MAPLE_W * MAPLE_H * 4)
            expect(opaque(b.data)).toBeGreaterThan(500)
          }
      }
  })
  it('옵션을 바꾸면 그림이 달라진다 (정면 정지)', () => {
    for (const k of KEYS) {
      const seen: Uint8ClampedArray[] = []
      for (let i = 0; i < counts[k]; i++) {
        const { data } = buildBuffer({ ...BASE, [k]: i }, 'down', 0)
        for (const prev of seen) expect(same(prev, data)).toBe(false)
        seen.push(data)
      }
    }
  })
  it('발바닥 외곽선은 FOOT_Y + 1 행 (정지 프레임, 모든 옷)', () => {
    const kinds: SpriteKind[] = [...OUTFITS.map((_, i) => ({ ...BASE, outfit: i })), 'groom', 'bride']
    for (const kind of kinds) for (const d of DIRS) expect(bottomRow(buildBuffer(kind, d, 0).data)).toBe(FOOT_Y + 1)
  })
  it('left 는 right 의 좌우 반전', () => {
    for (const kind of [BASE, 'groom', 'bride'] as SpriteKind[])
      for (const f of FRAMES) {
        const r = buildBuffer(kind, 'right', f).data
        const l = buildBuffer(kind, 'left', f).data
        for (let y = 0; y < MAPLE_H; y++)
          for (let x = 0; x < MAPLE_W; x++)
            for (let c = 0; c < 4; c++)
              expect(l[(y * MAPLE_W + x) * 4 + c]).toBe(r[(y * MAPLE_W + (MAPLE_W - 1 - x)) * 4 + c])
      }
  })
  it('걷기 프레임 1 · 2 는 정지 프레임과도, 서로와도 다르다', () => {
    for (const kind of [BASE, { ...BASE, outfit: 7 }, 'groom', 'bride'] as SpriteKind[])
      for (const d of DIRS) {
        const [a, b, c] = FRAMES.map((f) => buildBuffer(kind, d, f).data)
        expect(same(a, b)).toBe(false)
        expect(same(a, c)).toBe(false)
        expect(same(b, c)).toBe(false)
      }
  })
  it('같은 입력은 같은 결과 (결정적)', () => {
    expect(same(buildBuffer('bride', 'up', 1).data, buildBuffer('bride', 'up', 1).data)).toBe(true)
  })
})
