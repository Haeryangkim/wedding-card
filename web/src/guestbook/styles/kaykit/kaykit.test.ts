import { describe, expect, it } from 'vitest'
import type { AppearanceParts } from '../../types'
import { ATLAS, type KayKitAtlas } from './assets/atlas'
import { CELL_FIELDS, clampLook, compose, drawOrder, outfitRgb, tintFactors, type Pixels } from './compose'
import { COUPLE_ACCESSORIES, COUPLE_OUTFITS, KAYKIT_FOOT_Y, KAYKIT_H, KAYKIT_W, PART_DEFS, normalizeAppearance, quantizeScale, randomAppearance } from './index'

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const ZERO: AppearanceParts = { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0 }
const CELLS = ATLAS.dirs.length * ATLAS.frames

describe('kaykit 아틀라스 자리표', () => {
  it('방향 4 x 프레임 3, 발바닥 선은 상자 안', () => {
    expect(ATLAS.dirs).toEqual(['down', 'left', 'right', 'up'])
    expect(ATLAS.frames).toBe(3)
    expect([KAYKIT_W, KAYKIT_H, KAYKIT_FOOT_Y]).toEqual([ATLAS.w, ATLAS.h, ATLAS.footY])
    expect(ATLAS.footY).toBeGreaterThan(ATLAS.headTop)
    expect(ATLAS.footY).toBeLessThanOrEqual(ATLAS.h)
  })
  it('모든 띠는 12칸이고, 칸은 아틀라스와 프레임 상자 안에 있다', () => {
    expect(ATLAS.strips.length).toBeGreaterThan(0)
    for (const strip of ATLAS.strips) {
      expect(strip).toHaveLength(CELLS * CELL_FIELDS)
      for (let c = 0; c < CELLS; c++) {
        const [sx, sy, w, h, ox, oy] = strip.slice(c * CELL_FIELDS, (c + 1) * CELL_FIELDS)
        if (w === 0) continue
        expect(sx).toBeGreaterThanOrEqual(0)
        expect(sy).toBeGreaterThanOrEqual(0)
        expect(sx + w).toBeLessThanOrEqual(ATLAS.size[0])
        expect(sy + h).toBeLessThanOrEqual(ATLAS.size[1])
        expect(ox).toBeGreaterThanOrEqual(0)
        expect(oy).toBeGreaterThanOrEqual(0)
        expect(ox + w).toBeLessThanOrEqual(ATLAS.w)
        expect(oy + h).toBeLessThanOrEqual(ATLAS.h)
      }
    }
  })
  it('아틀라스의 칸끼리 겹치지 않는다', () => {
    const rects: number[][] = []
    for (const strip of ATLAS.strips) for (let c = 0; c < CELLS; c++) if (strip[c * CELL_FIELDS + 2] > 0) rects.push(strip.slice(c * CELL_FIELDS, c * CELL_FIELDS + 4))
    rects.sort((a, b) => a[1] - b[1] || a[0] - b[0])
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length && rects[j][1] < rects[i][1] + rects[i][3]; j++) {
        const [ax, , aw] = rects[i]
        const [bx, , bw] = rects[j]
        expect(ax + aw <= bx || bx + bw <= ax, `cells ${rects[i]} / ${rects[j]}`).toBe(true)
      }
  })
  it('몸·머리 띠는 모든 방향·프레임에 그림이 있다', () => {
    for (const part of [...ATLAS.heads, ...ATLAS.outfits]) {
      const strip = ATLAS.strips[part.strip]
      for (let c = 0; c < CELLS; c++) expect(strip[c * CELL_FIELDS + 2], part.label).toBeGreaterThan(0)
    }
  })
  it('액세서리 조각은 띠를 가리키고, 조각마다 under·over 중 하나는 있다', () => {
    for (const acc of ATLAS.accs) {
      expect(acc.pieces.length).toBeGreaterThan(0)
      for (const [under, over] of acc.pieces) {
        expect(Math.max(under, over)).toBeGreaterThanOrEqual(0)
        for (const s of [under, over]) expect(s === -1 || (s >= 0 && s < ATLAS.strips.length)).toBe(true)
      }
    }
  })
  it('신랑·신부는 0·1번 의상, 신부의 액세서리는 전용', () => {
    expect(ATLAS.groom.outfit).toBe(0)
    expect(ATLAS.bride.outfit).toBe(1)
    expect(ATLAS.outfits[0].label).toBe('턱시도')
    expect(ATLAS.outfits[1].label).toBe('웨딩드레스')
    expect(ATLAS.accs[ATLAS.bride.accessory - 1].couple).toBe(true)
    expect(clampLook(ATLAS, ATLAS.groom)).toEqual(ATLAS.groom)
    expect(clampLook(ATLAS, ATLAS.bride)).toEqual(ATLAS.bride)
  })
})

describe('kaykit 파츠 정의·정규화·랜덤', () => {
  const count = (key: keyof AppearanceParts) => PART_DEFS.find((d) => d.key === key)!.options.length
  it('PART_DEFS 는 여섯 항목이고 개수가 아틀라스와 같다', () => {
    expect(PART_DEFS.map((d) => d.key).sort()).toEqual(['accessory', 'hairColor', 'hairStyle', 'outfit', 'outfitColor', 'skin'])
    expect(count('skin')).toBe(ATLAS.skins.length)
    expect(count('hairStyle')).toBe(ATLAS.heads.length)
    expect(count('hairColor')).toBe(ATLAS.hairColors.length)
    expect(count('outfit')).toBe(ATLAS.outfits.length)
    expect(count('outfitColor')).toBe(ATLAS.outfitColors.length)
    expect(count('accessory')).toBe(ATLAS.accs.length + 1)
    expect(PART_DEFS.find((d) => d.key === 'accessory')!.options[0].label).toBe('없음')
    for (const key of ['skin', 'hairColor', 'outfitColor'] as const) for (const o of PART_DEFS.find((d) => d.key === key)!.options) expect(o.swatch).toBeTruthy()
  })
  it('normalizeAppearance 는 범위를 벗어난 값을 자른다', () => {
    expect(normalizeAppearance({ skin: -3, hairStyle: 99, hairColor: NaN, outfit: 1.6, outfitColor: 1e9, accessory: -1 })).toEqual({
      skin: 0,
      hairStyle: count('hairStyle') - 1,
      hairColor: 0,
      outfit: 2,
      outfitColor: count('outfitColor') - 1,
      accessory: 0,
    })
    expect(normalizeAppearance(undefined as unknown as AppearanceParts)).toEqual(ZERO)
    const a = { skin: 2, hairStyle: 3, hairColor: 4, outfit: 5, outfitColor: 6, accessory: 7 }
    expect(normalizeAppearance(a)).toEqual(a)
  })
  it('randomAppearance 는 신랑·신부 몫을 뽑지 않고 나머지는 모두 뽑는다', () => {
    expect(COUPLE_OUTFITS).toEqual([0, 1])
    expect(COUPLE_ACCESSORIES).toEqual([ATLAS.accs.length])
    const rnd = lcg(11)
    const seen = { outfit: new Set<number>(), accessory: new Set<number>(), hairStyle: new Set<number>(), outfitColor: new Set<number>(), skin: new Set<number>(), hairColor: new Set<number>() }
    let none = 0
    for (let i = 0; i < 6000; i++) {
      const a = randomAppearance(rnd)
      expect(normalizeAppearance(a)).toEqual(a)
      for (const k of Object.keys(seen) as (keyof typeof seen)[]) seen[k].add(a[k])
      if (a.accessory === 0) none++
      // 후드 머리에는 모자류를 얹지 않는다
      if (ATLAS.heads[a.hairStyle].hood && a.accessory > 0) expect(ATLAS.accs[a.accessory - 1].hat).toBeFalsy()
    }
    const sorted = (s: Set<number>) => [...s].sort((x, y) => x - y)
    const range = (n: number) => Array.from({ length: n }, (_, i) => i)
    expect(sorted(seen.outfit)).toEqual(range(count('outfit')).filter((i) => i > 1))
    expect(sorted(seen.accessory)).toEqual(range(count('accessory')).filter((i) => i !== ATLAS.accs.length))
    expect(sorted(seen.hairStyle)).toEqual(range(count('hairStyle')))
    expect(sorted(seen.outfitColor)).toEqual(range(count('outfitColor')))
    expect(sorted(seen.skin)).toEqual(range(count('skin')))
    expect(sorted(seen.hairColor)).toEqual(range(count('hairColor')))
    expect(none / 6000).toBeGreaterThan(0.4)
    expect(none / 6000).toBeLessThan(0.6)
  })
  it('rnd 가 0 이나 1 에 가까워도 유효한 하객 외형을 준다', () => {
    for (const v of [0, 0.999999]) {
      const a = randomAppearance(() => v)
      expect(normalizeAppearance(a)).toEqual(a)
      expect(COUPLE_OUTFITS).not.toContain(a.outfit)
      expect(COUPLE_ACCESSORIES).not.toContain(a.accessory)
    }
  })
  it('배율은 0.05 단위, 0.1~2 로 맞춘다', () => {
    expect(quantizeScale(0.7312)).toBe(0.75)
    expect(quantizeScale(0)).toBe(1)
    expect(quantizeScale(NaN)).toBe(1)
    expect(quantizeScale(0.01)).toBe(0.1)
    expect(quantizeScale(9)).toBe(2)
  })
})

describe('kaykit 겹치는 순서·색', () => {
  it('액세서리 under → 몸 → 머리 → 액세서리 over', () => {
    const look = { ...ZERO, outfit: 3, hairStyle: 2 }
    const body = ATLAS.outfits[3].strip
    const head = ATLAS.heads[2].strip
    expect(drawOrder(ATLAS, look)).toEqual([body, head])
    ATLAS.accs.forEach((acc, i) => {
      const order = drawOrder(ATLAS, { ...look, accessory: i + 1 })
      const at = order.indexOf(body)
      expect(order[at + 1]).toBe(head)
      expect(order.slice(0, at)).toEqual(acc.pieces.map((p) => p[0]).filter((s) => s >= 0))
      expect(order.slice(at + 2)).toEqual(acc.pieces.map((p) => p[1]).filter((s) => s >= 0))
    })
  })
  it('의상 색 0번(기본)은 그 의상의 원래 색, 나머지는 고른 색', () => {
    expect(ATLAS.outfitColors[0].rgb).toBe(-1)
    for (let o = 0; o < ATLAS.outfits.length; o++) expect(outfitRgb(ATLAS, { ...ZERO, outfit: o })).toBe(ATLAS.outfits[o].base)
    expect(outfitRgb(ATLAS, { ...ZERO, outfit: 4, outfitColor: 3 })).toBe(ATLAS.outfitColors[3].rgb)
    const t = tintFactors(ATLAS, { ...ZERO, skin: 1, hairColor: 2, outfit: 2, outfitColor: 1 })
    const want = [ATLAS.skins[1].rgb, ATLAS.hairColors[2].rgb, ATLAS.outfitColors[1].rgb].flatMap((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]).map((v) => v / ATLAS.neutral)
    Array.from(t).forEach((v, i) => expect(v).toBeCloseTo(want[i], 5))
  })
})

describe('kaykit compose (가짜 아틀라스)', () => {
  // 4x4 상자, 방향 1 x 프레임 1. 띠 0 = 몸(2x2, 상자의 (1,2)), 띠 1 = 머리(2x2, (1,0)), 띠 2 = under(1x1, (0,0)), 띠 3 = over(1x1, (1,0))
  const fake: KayKitAtlas = {
    w: 4,
    h: 4,
    footY: 4,
    headTop: 0,
    dirs: ['down'],
    frames: 1,
    neutral: 200,
    size: [8, 2],
    strips: [
      [0, 0, 2, 2, 1, 2],
      [2, 0, 2, 2, 1, 0],
      [4, 0, 1, 1, 0, 0],
      [5, 0, 1, 1, 1, 0],
    ],
    skins: [{ label: 's', swatch: '#fff', rgb: 0xc86432 }],
    hairColors: [{ label: 'h', swatch: '#fff', rgb: 0x640000 }],
    outfitColors: [
      { label: '기본', swatch: '#fff', rgb: -1 },
      { label: 'b', swatch: '#fff', rgb: 0x0000c8 },
    ],
    heads: [{ label: 'head', strip: 1 }],
    outfits: [{ label: 'body', strip: 0, base: 0x00c800 }],
    accs: [{ label: 'acc', pieces: [[2, 3]] }],
    groom: ZERO,
    bride: ZERO,
  }
  const px = (rows: number[][][]): Pixels => ({ data: Uint8ClampedArray.from(rows.flat(2)), width: rows[0].length })
  const G = [200, 200, 200, 255]
  const O = [0, 0, 0, 0]
  // 색: 몸은 중립 회색, 머리 왼쪽 위는 반투명 회색, 나머지 머리는 고정 색(10,20,30), under 는 빨강, over 는 반투명 파랑
  const color = px([
    [G, G, [100, 100, 100, 128], [10, 20, 30, 255], [255, 0, 0, 255], [0, 0, 255, 128], O, O],
    [G, [100, 100, 100, 255], [10, 20, 30, 255], G, O, O, O, O],
  ])
  // 마스크: 몸 = 옷(B), 단 (1,1) 은 옷 절반. 머리 (0,0) = 피부, (1,1) = 머리카락, 나머지 0. 작은 잡음(5)은 무시
  const mask = px([
    [[0, 0, 255, 255], [0, 0, 255, 255], [255, 0, 0, 255], [5, 5, 5, 255], O, O, O, O],
    [[0, 0, 255, 255], [0, 0, 128, 255], [0, 0, 0, 255], [0, 255, 0, 255], O, O, O, O],
  ])
  const at = (out: Uint8ClampedArray, x: number, y: number) => Array.from(out.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4))

  it('중립색에 고른 색을 곱하고(넘치면 255), 마스크가 없는 픽셀은 그대로 둔다', () => {
    const out = compose(fake, color, mask, ZERO, 0, 0)
    expect(out).toHaveLength(4 * 4 * 4)
    // 몸: 회색 200 x 기본 색(0,200,0)/200
    expect(at(out, 1, 2)).toEqual([0, 200, 0, 255])
    // 옷 비율 128/255 인 픽셀: 100 x (1 + 0.502 x (계수 - 1))
    const half = at(out, 2, 3)
    expect(half[0]).toBeCloseTo(100 * (1 - 128 / 255), 0)
    expect(half[1]).toBeCloseTo(100, 0)
    expect(half[3]).toBe(255)
    // 머리: 고정 색은 그대로 (잡음 5 는 무시), 머리카락 = 200 x (100,0,0)/200
    expect(at(out, 2, 0)).toEqual([10, 20, 30, 255])
    expect(at(out, 2, 1)).toEqual([100, 0, 0, 255])
    // 빈 곳은 투명
    expect(at(out, 3, 3)).toEqual([0, 0, 0, 0])
    expect(at(out, 0, 0)).toEqual([0, 0, 0, 0])
  })
  it('의상 색을 바꾸면 옷 영역만 바뀐다', () => {
    const out = compose(fake, color, mask, { ...ZERO, outfitColor: 1 }, 0, 0)
    expect(at(out, 1, 2)).toEqual([0, 0, 200, 255])
    expect(at(out, 2, 1)).toEqual([100, 0, 0, 255])
  })
  it('under 는 맨 아래, over 는 맨 위에 겹친다 (반투명은 섞인다)', () => {
    const plain = compose(fake, color, mask, ZERO, 0, 0)
    // 반투명 피부 픽셀: 100 x (200,100,50)/200, 알파 128
    expect(at(plain, 1, 0)).toEqual([100, 50, 25, 128])
    const out = compose(fake, color, mask, { ...ZERO, accessory: 1 }, 0, 0)
    // under: 머리가 없는 (0,0) 에 그대로 보인다
    expect(at(out, 0, 0)).toEqual([255, 0, 0, 255])
    // over(파랑, 알파 128) 가 반투명 머리 픽셀 위에: 알파가 늘고 파랑이 섞인다
    const mixed = at(out, 1, 0)
    expect(mixed[3]).toBeGreaterThan(128)
    expect(mixed[2]).toBeGreaterThan(100)
    expect(mixed[0]).toBeLessThan(100)
  })
  it('방향·프레임 번호가 범위를 벗어나도 터지지 않는다', () => {
    expect(() => compose(fake, color, mask, { ...ZERO, accessory: 99, outfit: -5 }, 7, 9)).not.toThrow()
  })
})
