/**
 * 손그림 치비(테스트) 그림체의 DOM·에셋 없는 부분 검증: 카탈로그의 짜임, 외형 보정, 하객용 랜덤의 규칙, 방향 처리.
 * (그림 파일은 저장소에 없으므로 그리기는 여기서 다루지 않는다)
 */
import { describe, expect, it } from 'vitest'
import type { AppearanceParts, PartKey } from '../../types'
import { ACCESSORIES, BRIDE, CHIBI_FOOT_Y, CHIBI_H, CHIBI_HEAD_TOP, CHIBI_W, FACES, GROOM, HAIRS, HAIR_COLORS, OUTFITS, SKINS } from './catalog'
import {
  COMMON_HAIR_COLORS,
  COMMON_SKINS,
  COUPLE_ACCESSORY,
  COUPLE_OUTFITS,
  FEMALE_OUTFITS,
  FOOT_Y,
  normalizeAppearance,
  PART_DEFS,
  quantizeScale,
  randomAppearance,
  SHORT_HAIRS,
  SPRITE_H,
  SPRITE_W,
  viewOf,
} from './index'

const KEYS: PartKey[] = ['skin', 'hairStyle', 'hairColor', 'outfit', 'outfitColor', 'accessory']
const counts = Object.fromEntries(PART_DEFS.map((p) => [p.key, p.options.length])) as Record<PartKey, number>

/** 씨앗이 있는 난수 (mulberry32) */
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

describe('chibi 카탈로그', () => {
  it('치수: 발밑·머리 꼭대기가 프레임 안에 있다', () => {
    expect([SPRITE_W, SPRITE_H, FOOT_Y]).toEqual([CHIBI_W, CHIBI_H, CHIBI_FOOT_Y])
    expect(CHIBI_W % 2).toBe(0)
    expect(CHIBI_FOOT_Y).toBeGreaterThan(CHIBI_H * 0.9)
    expect(CHIBI_FOOT_Y).toBeLessThan(CHIBI_H)
    expect(CHIBI_HEAD_TOP).toBeGreaterThan(0)
    expect(CHIBI_HEAD_TOP).toBeLessThan(CHIBI_H / 3)
  })

  it('PART_DEFS 가 여섯 칸을 한 번씩 다루고 개수가 카탈로그와 같다', () => {
    expect(PART_DEFS.map((p) => p.key).sort()).toEqual([...KEYS].sort())
    expect(counts).toEqual({
      skin: SKINS.length,
      hairStyle: HAIRS.length,
      hairColor: HAIR_COLORS.length,
      outfit: OUTFITS.length,
      outfitColor: FACES.length,
      accessory: ACCESSORIES.length + 1,
    })
    expect(PART_DEFS.find((p) => p.key === 'accessory')?.options[0].label).toBe('없음')
    for (const p of PART_DEFS) for (const o of p.options) expect(o.label.length).toBeGreaterThan(0)
  })

  it('색상칩은 #rrggbb', () => {
    for (const c of [...SKINS.map((s) => s.hex), ...HAIR_COLORS.flatMap((h) => [h.hex, h.line])]) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('충분한 가짓수: 피부 5+, 머리 10+ (짧은·긴 머리 모두), 옷 12+', () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(5)
    expect(HAIRS.length).toBeGreaterThanOrEqual(10)
    expect(SHORT_HAIRS).toBeGreaterThanOrEqual(4)
    expect(HAIRS.length - SHORT_HAIRS).toBeGreaterThanOrEqual(4)
    expect(OUTFITS.length).toBeGreaterThanOrEqual(12)
  })

  it('0번 옷은 신랑, 1번 옷은 신부, 면사포는 마지막 액세서리', () => {
    expect(COUPLE_OUTFITS).toEqual([0, 1])
    expect(GROOM.outfit).toBe(0)
    expect(BRIDE.outfit).toBe(1)
    expect(OUTFITS[0].female).toBe(false)
    expect(OUTFITS[1].female).toBe(true)
    expect(BRIDE.accessory).toBe(COUPLE_ACCESSORY)
    expect(COUPLE_ACCESSORY).toBe(counts.accessory - 1)
    expect(GROOM.accessory).toBe(0)
  })

  it('신랑·신부의 외형이 범위 안에 있다', () => {
    for (const f of [GROOM, BRIDE]) {
      const a: AppearanceParts = {
        skin: f.skin,
        hairStyle: f.hairStyle,
        hairColor: f.hairColor,
        outfit: f.outfit,
        outfitColor: f.face,
        accessory: f.accessory,
      }
      expect(normalizeAppearance(a)).toEqual(a)
    }
    expect(GROOM.hairStyle).toBeLessThan(SHORT_HAIRS)
    expect(BRIDE.hairStyle).toBeGreaterThanOrEqual(SHORT_HAIRS)
  })

  it('FEMALE_OUTFITS 는 카탈로그의 female 표시와 같다', () => {
    expect(FEMALE_OUTFITS).toEqual(OUTFITS.flatMap((o, i) => (o.female ? [i] : [])))
    expect(FEMALE_OUTFITS.length).toBeGreaterThan(2)
    expect(FEMALE_OUTFITS.length).toBeLessThan(OUTFITS.length - 2)
  })
})

describe('chibi normalizeAppearance', () => {
  it('범위 안의 값은 그대로', () => {
    const r = rng(7)
    for (let i = 0; i < 300; i++) {
      const a = Object.fromEntries(KEYS.map((k) => [k, Math.floor(r() * counts[k])])) as unknown as AppearanceParts
      expect(normalizeAppearance(a)).toEqual(a)
    }
  })

  it('이상한 값은 범위 안의 정수로 보정한다', () => {
    const junk: unknown[] = [-1, -1e9, 1e9, 3.6, NaN, Infinity, -Infinity, '2', null, undefined, {}, []]
    const r = rng(11)
    for (let i = 0; i < 400; i++) {
      const a = Object.fromEntries(KEYS.map((k) => [k, junk[Math.floor(r() * junk.length)]])) as unknown as AppearanceParts
      const n = normalizeAppearance(a)
      for (const k of KEYS) {
        expect(Number.isInteger(n[k])).toBe(true)
        expect(n[k]).toBeGreaterThanOrEqual(0)
        expect(n[k]).toBeLessThan(counts[k])
      }
    }
    expect(normalizeAppearance({ skin: 99, hairStyle: 99, hairColor: 99, outfit: 99, outfitColor: 99, accessory: 99 })).toEqual({
      skin: counts.skin - 1,
      hairStyle: counts.hairStyle - 1,
      hairColor: counts.hairColor - 1,
      outfit: counts.outfit - 1,
      outfitColor: counts.outfitColor - 1,
      accessory: counts.accessory - 1,
    })
    expect(normalizeAppearance(undefined as unknown as AppearanceParts)).toEqual({
      skin: 0,
      hairStyle: 0,
      hairColor: 0,
      outfit: 0,
      outfitColor: 0,
      accessory: 0,
    })
  })
})

describe('chibi randomAppearance', () => {
  const N = 4000
  const r = rng(2026)
  const samples = Array.from({ length: N }, () => randomAppearance(r))

  it('항상 유효한 외형이고, 두 사람 몫(턱시도·웨딩드레스·면사포)은 나오지 않는다', () => {
    for (const a of samples) {
      expect(normalizeAppearance(a)).toEqual(a)
      expect(COUPLE_OUTFITS).not.toContain(a.outfit)
      expect(a.accessory).not.toBe(COUPLE_ACCESSORY)
    }
  })

  it('하객 몫의 모든 번호가 한 번은 나온다', () => {
    const seen = Object.fromEntries(KEYS.map((k) => [k, new Set<number>()])) as Record<PartKey, Set<number>>
    for (const a of samples) for (const k of KEYS) seen[k].add(a[k])
    expect(seen.skin.size).toBe(counts.skin)
    expect(seen.hairStyle.size).toBe(counts.hairStyle)
    expect(seen.hairColor.size).toBe(counts.hairColor)
    expect(seen.outfitColor.size).toBe(counts.outfitColor)
    expect(seen.outfit.size).toBe(counts.outfit - 2)
    expect(seen.accessory.size).toBe(counts.accessory - 1) // 없음 + 면사포를 뺀 나머지
  })

  it('액세서리는 절반쯤 없음', () => {
    const none = samples.filter((a) => a.accessory === 0).length / N
    expect(none).toBeGreaterThan(0.42)
    expect(none).toBeLessThan(0.58)
  })

  it('원피스·치마에는 긴 머리가, 그 밖의 옷에는 짧은 머리가 많다', () => {
    const fem = samples.filter((a) => FEMALE_OUTFITS.includes(a.outfit))
    const masc = samples.filter((a) => !FEMALE_OUTFITS.includes(a.outfit))
    const longRate = (list: AppearanceParts[]) => list.filter((a) => a.hairStyle >= SHORT_HAIRS).length / list.length
    expect(fem.length).toBeGreaterThan(N / 5)
    expect(masc.length).toBeGreaterThan(N / 5)
    expect(longRate(fem)).toBeGreaterThan(0.78)
    expect(longRate(masc)).toBeLessThan(0.22)
  })

  it('밝은 피부·자연스러운 머리 색이 많다', () => {
    expect(samples.filter((a) => a.skin < COMMON_SKINS).length / N).toBeGreaterThan(0.6)
    expect(samples.filter((a) => a.hairColor < COMMON_HAIR_COLORS).length / N).toBeGreaterThan(0.7)
  })

  it('난수가 1 에 아주 가까워도 범위를 넘지 않는다', () => {
    const a = randomAppearance(() => 0.999999999)
    expect(normalizeAppearance(a)).toEqual(a)
    const b = randomAppearance(() => 0)
    expect(normalizeAppearance(b)).toEqual(b)
    expect(b.outfit).toBe(2)
  })
})

describe('chibi 방향·배율', () => {
  const guest: AppearanceParts = { skin: 0, hairStyle: 0, hairColor: 0, outfit: 2, outfitColor: 0, accessory: 0 }

  it('오른쪽은 그림 그대로, 왼쪽은 반전, 위는 뒤통수', () => {
    expect(viewOf(guest, 'right')).toEqual({ walk: 'side', back: false, flip: false })
    expect(viewOf(guest, 'left')).toEqual({ walk: 'side', back: false, flip: true })
    expect(viewOf(guest, 'down')).toEqual({ walk: 'down', back: false, flip: false })
    expect(viewOf(guest, 'up')).toEqual({ walk: 'down', back: true, flip: true })
  })

  it('신랑·신부는 아래를 볼 때 서로 마주 본다', () => {
    expect(viewOf('groom', 'down').flip).toBe(false)
    expect(viewOf('bride', 'down').flip).toBe(true)
    expect(viewOf('bride', 'right').flip).toBe(false)
    expect(viewOf('groom', 'left').flip).toBe(true)
  })

  it('배율은 0.05 단위, 0.1~4 범위로 맞춘다', () => {
    expect(quantizeScale(1)).toBe(1)
    expect(quantizeScale(0.77)).toBeCloseTo(0.75)
    expect(quantizeScale(0.001)).toBe(0.1)
    expect(quantizeScale(99)).toBe(4)
    expect(quantizeScale(NaN)).toBe(1)
    expect(quantizeScale(-2)).toBe(1)
  })
})
