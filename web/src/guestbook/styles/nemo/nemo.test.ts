/**
 * 네모 친구(벡터) 스타일의 DOM 없는 검증: 파츠 표, 랜덤·보정 규칙, 걸음새 수치,
 * 그리고 가짜 캔버스로 모든 (옵션 x 방향 x 프레임) 렌더 경로가 예외 없이 도는지 + 캐시 동작.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Appearance, PartKey } from '../../types'
import { FACES, GEOM, HAIR_COLORS, OUTFIT_COLORS, OURS_BACK, OURS_FRONT, PACK_BACK, PACK_FRONT, SKINS } from './data'
import {
  ACCESSORIES,
  CACHE_MAX_ENTRIES,
  CACHE_MAX_PIXELS,
  clearSpriteCache,
  COUPLE_OUTFITS,
  DESIGN_PER_UNIT,
  getSprite,
  HAIRS,
  MAX_SCALE,
  MOUSTACHE_ACCESSORY,
  NEMO_CENTER_X,
  NEMO_FOOT_Y,
  NEMO_H,
  NEMO_W,
  normalizeAppearance,
  OUTFITS,
  PART_DEFS,
  poseOf,
  randomAppearance,
  SHORT_HAIRS,
  spriteCacheStats,
  STYLE_INFO,
  VEIL_ACCESSORY,
} from './index'
import type { Dir, Frame, SpriteKind, View } from './index'

const KEYS: PartKey[] = ['skin', 'hairStyle', 'hairColor', 'outfit', 'outfitColor', 'accessory']
const counts = Object.fromEntries(PART_DEFS.map((p) => [p.key, p.options.length])) as Record<PartKey, number>
const DIRS: Dir[] = ['down', 'left', 'right', 'up']
const FRAMES: Frame[] = [0, 1, 2]
const VIEWS: View[] = ['front', 'side', 'back']

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

describe('parts', () => {
  it('covers every appearance key exactly once, with labelled options', () => {
    expect(PART_DEFS.map((p) => p.key).sort()).toEqual([...KEYS].sort())
    for (const p of PART_DEFS) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.options.length).toBeGreaterThan(1)
      for (const o of p.options) expect(o.label.length).toBeGreaterThan(0)
      // 같은 이름의 옵션이 없어야 고를 때 헷갈리지 않는다
      expect(new Set(p.options.map((o) => o.label)).size).toBe(p.options.length)
    }
  })
  it('option counts match the tables (the numbers registry.ts must repeat)', () => {
    expect(counts).toEqual({
      skin: SKINS.length,
      hairStyle: HAIRS.length,
      hairColor: HAIR_COLORS.length,
      outfit: OUTFITS.length,
      outfitColor: OUTFIT_COLORS.length,
      accessory: ACCESSORIES.length,
    })
    expect(counts).toEqual({ skin: 6, hairStyle: 14, hairColor: 12, outfit: 10, outfitColor: 12, accessory: 10 })
  })
  it('colour options carry a #rrggbb swatch', () => {
    for (const p of PART_DEFS) {
      if (p.key !== 'skin' && p.key !== 'hairColor' && p.key !== 'outfitColor') continue
      for (const o of p.options) expect(o.swatch).toMatch(/^#[0-9a-f]{6}$/)
    }
    for (const s of SKINS) for (const c of [s.ear, s.cheek]) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('keeps the couple-only parts where the registry expects them', () => {
    expect(COUPLE_OUTFITS).toEqual([0, 1])
    expect(OUTFITS[0].label).toBe('턱시도')
    expect(OUTFITS[1].label).toBe('웨딩드레스')
    expect(ACCESSORIES[0].label).toBe('없음')
    expect(VEIL_ACCESSORY).toBe(ACCESSORIES.length - 1)
    expect(ACCESSORIES[VEIL_ACCESSORY].label).toBe('면사포')
    expect(ACCESSORIES[MOUSTACHE_ACCESSORY].label).toBe('콧수염')
  })
  it('splits hair into short (first) and long styles', () => {
    expect(SHORT_HAIRS).toBeGreaterThan(0)
    expect(SHORT_HAIRS).toBeLessThan(HAIRS.length)
    // 긴 머리는 모두 뒷머리 경로가 있다
    for (let i = SHORT_HAIRS; i < HAIRS.length; i++) expect(HAIRS[i].back).toBeTruthy()
  })
  it('marks which shapes come from the pack and which are ours', () => {
    const pack = new Set<string>([...Object.values(PACK_FRONT), ...Object.values(PACK_BACK)])
    const ours = new Set<string>([...Object.values(OURS_FRONT), ...Object.values(OURS_BACK)])
    for (const h of HAIRS) {
      const paths = [h.front, ...(h.back ? [h.back] : [])]
      for (const d of paths) expect(pack.has(d) || ours.has(d)).toBe(true)
      expect(h.pack).toBe(paths.every((d) => pack.has(d)))
    }
    // 팩의 옷은 티셔츠(바지·반바지)와 원피스뿐
    expect(OUTFITS.filter((o) => o.pack).map((o) => o.label)).toEqual(['티셔츠와 바지', '티셔츠와 반바지', '원피스'])
    expect(SKINS.filter((s) => s.pack)).toHaveLength(3)
    expect(HAIR_COLORS.filter((c) => c.pack)).toHaveLength(9)
  })
  it('faces keep eyes and mouth apart so the side view can shift them', () => {
    for (const f of Object.values(FACES)) {
      expect(f.eyeL.length).toBeGreaterThan(0)
      expect(f.eyeR.length).toBe(f.eyeL.length)
      expect(f.mouth.length).toBe(1)
    }
  })
})

describe('dimensions', () => {
  it('describes the style for the registry', () => {
    expect(STYLE_INFO.id).toBe('nemo')
    expect(STYLE_INFO.nominalW).toBe(NEMO_W)
    expect(STYLE_INFO.nominalH).toBe(NEMO_H)
    expect(STYLE_INFO.footY).toBe(NEMO_FOOT_Y)
    expect(STYLE_INFO.pixelated).toBe(false)
    expect(NEMO_CENTER_X).toBe(NEMO_W / 2)
    expect(NEMO_FOOT_Y).toBe(41.25)
    expect(NEMO_FOOT_Y).toBeGreaterThan(NEMO_H * 0.9)
    expect(NEMO_FOOT_Y).toBeLessThan(NEMO_H)
    expect(STYLE_INFO.headFrac).toBeGreaterThan(0.7)
    expect(STYLE_INFO.headFrac).toBeLessThan(0.9)
  })
  it('fits the pack head cell inside the design box with room for the walk', () => {
    const designW = NEMO_W * DESIGN_PER_UNIT
    const designH = NEMO_H * DESIGN_PER_UNIT
    expect(designW).toBeGreaterThanOrEqual(GEOM.headW + 10)
    // 발바닥 아래로 조금 남고, 위로는 머리 칸 꼭대기(뽀글 머리)가 걷기 들썩임(2.5)만큼 올라가도 들어온다
    expect(designH).toBeGreaterThan(GEOM.legY + GEOM.legH + 4)
    expect(NEMO_FOOT_Y * DESIGN_PER_UNIT - (GEOM.legY + GEOM.legH)).toBeGreaterThanOrEqual(2.5)
  })
})

describe('poseOf (walk cycle)', () => {
  it('stands still on frame 0 in every view', () => {
    for (const v of VIEWS) {
      const p = poseOf(v, 0)
      // (-0 도 0 으로 본다)
      for (const v0 of [p.bob, p.shiftX, p.tilt, p.sway, p.legA.dy, p.legA.rot, p.legB.dy, p.legB.rot]) expect(Math.abs(v0)).toBe(0)
    }
  })
  it('front/back: lifts one foot at a time, swings the arms opposite ways and hops', () => {
    for (const v of ['front', 'back'] as View[]) {
      const idle = poseOf(v, 0)
      const a = poseOf(v, 1)
      const b = poseOf(v, 2)
      // 한 발만 든다, 프레임마다 다른 발
      expect([a.legA.dy < 0, a.legB.dy < 0].filter(Boolean)).toHaveLength(1)
      expect(a.legA.dy).toBe(b.legB.dy)
      expect(a.legB.dy).toBe(b.legA.dy)
      // 팔: 한쪽은 더 벌어지고 다른 쪽은 붙는다 — 두 프레임이 서로 거울
      expect(a.armA - idle.armA).toBeCloseTo(-(a.armB - idle.armB), 9)
      expect(Math.abs(a.armA - idle.armA)).toBeGreaterThan(0.2)
      expect(a.armA).toBeCloseTo(b.armB, 9)
      expect(a.bob).toBeLessThan(0)
      expect(a.bob).toBe(b.bob)
      expect(a.tilt).toBeCloseTo(-b.tilt, 9)
      expect(a.sway).toBeCloseTo(-b.sway, 9)
    }
    // 뒷모습은 같은 걸음을 뒤에서 본 것
    expect(poseOf('back', 1)).toEqual(poseOf('front', 2))
  })
  it('side: scissors the legs, counter-swings the arms and keeps both feet on the ground', () => {
    const a = poseOf('side', 1)
    const b = poseOf('side', 2)
    expect(a.legA.rot).toBeGreaterThan(0.4)
    expect(a.legA.rot).toBeCloseTo(-a.legB.rot, 9)
    expect(a.legA.rot).toBeCloseTo(b.legB.rot, 9)
    // 앞으로 나간 다리와 같은 쪽 팔은 뒤로
    const idle = poseOf('side', 0)
    expect(Math.sign(a.armA - idle.armA)).toBe(-Math.sign(a.legA.rot))
    expect(Math.sign(a.armB - idle.armB)).toBe(-Math.sign(a.legB.rot))
    // 엉덩이가 내려간 만큼 다리 끝이 다시 땅에 닿는다
    const reach = GEOM.legH - 3
    expect(a.legA.dy + reach * Math.cos(a.legA.rot)).toBeCloseTo(reach, 9)
    expect(a.bob).toBe(a.legA.dy)
    expect(a.bob).toBe(b.bob)
  })
})

describe('randomAppearance', () => {
  it('yields valid guest appearances and eventually reaches every guest option', () => {
    const r = rng(1)
    const seen = Object.fromEntries(KEYS.map((k) => [k, new Set<number>()])) as Record<PartKey, Set<number>>
    for (let i = 0; i < 6000; i++) {
      const a = randomAppearance(r)
      expect(isValid(a)).toBe(true)
      for (const k of KEYS) seen[k].add(a[k])
    }
    for (const k of ['skin', 'hairStyle', 'hairColor', 'outfitColor'] as PartKey[]) expect(seen[k].size).toBe(counts[k])
    expect([...seen.outfit].sort((x, y) => x - y)).toEqual(OUTFITS.map((_, i) => i).filter((i) => !COUPLE_OUTFITS.includes(i)))
    expect([...seen.accessory].sort((x, y) => x - y)).toEqual(ACCESSORIES.map((_, i) => i).filter((i) => i !== VEIL_ACCESSORY))
  })
  it('never hands out the couple-only parts, and keeps the moustache for short hair + trousers', () => {
    const r = rng(7)
    let matched = 0
    const n = 6000
    for (let i = 0; i < n; i++) {
      const a = randomAppearance(r)
      expect(COUPLE_OUTFITS).not.toContain(a.outfit)
      expect(a.accessory).not.toBe(VEIL_ACCESSORY)
      const feminine = OUTFITS[a.outfit].feminine
      if (a.accessory === MOUSTACHE_ACCESSORY) {
        expect(feminine).toBe(false)
        expect(a.hairStyle).toBeLessThan(SHORT_HAIRS)
      }
      if (feminine === a.hairStyle >= SHORT_HAIRS) matched++
    }
    // 치마 ↔ 긴 머리, 바지 ↔ 짧은 머리가 대부분(약 87%)이지만 전부는 아니다
    expect(matched / n).toBeGreaterThan(0.8)
    expect(matched / n).toBeLessThan(0.95)
  })
  it('stays in range at the extremes of the random source', () => {
    for (const v of [0, 0.999999999, 1]) {
      const a = randomAppearance(() => v)
      expect(isValid(a)).toBe(true)
      expect(COUPLE_OUTFITS).not.toContain(a.outfit)
      expect(a.accessory).not.toBe(VEIL_ACCESSORY)
    }
  })
})

describe('normalizeAppearance', () => {
  it('is the identity on valid appearances (including couple-only parts)', () => {
    const r = rng(2)
    for (let i = 0; i < 500; i++) {
      const a = randomAppearance(r)
      expect(normalizeAppearance(a)).toEqual(a)
    }
    const couple = { skin: 0, hairStyle: 11, hairColor: 1, outfit: 1, outfitColor: 11, accessory: VEIL_ACCESSORY }
    expect(normalizeAppearance(couple)).toEqual(couple)
  })
  it('survives garbage input (fuzz) and is idempotent', () => {
    const r = rng(3)
    const junk: unknown[] = [undefined, null, NaN, Infinity, -Infinity, -1, -0.4, 0.5, 1e9, '3', ' 2 ', '', 'x', true, [], {}, () => 1, 2.5, -7, 999]
    const pick = () => (r() < 0.3 ? Math.round((r() - 0.3) * 40) : junk[Math.floor(r() * junk.length)])
    for (let i = 0; i < 3000; i++) {
      const input: Record<string, unknown> = {}
      for (const k of KEYS) if (r() > 0.15) input[k] = pick()
      if (r() < 0.2) input.style = 'nemo'
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

/* ── 가짜 캔버스: 모든 그리기 호출을 받아 주기만 한다 ───────────── */
describe('getSprite (stubbed canvas)', () => {
  const g = globalThis as Record<string, unknown>
  const saved = { Path2D: g.Path2D, document: g.document }
  let calls = 0
  let fills: string[] = []
  let transforms: number[][] = []
  beforeAll(() => {
    g.Path2D = class {
      moveTo(): void {}
      lineTo(): void {}
      arcTo(): void {}
      arc(): void {}
      rect(): void {}
      closePath(): void {}
    }
    const makeCtx = (): unknown => {
      const state: Record<string, unknown> = { globalAlpha: 1 }
      return new Proxy(state, {
        get(t, prop: string) {
          if (prop in t) return t[prop]
          if (prop === 'fill') {
            return () => {
              calls++
              fills.push(String(t.fillStyle))
            }
          }
          if (prop === 'setTransform') {
            return (...m: number[]) => {
              calls++
              transforms.push(m)
            }
          }
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

  const base: Appearance = { skin: 1, hairStyle: 0, hairColor: 1, outfit: 2, outfitColor: 0, accessory: 0 }
  const drawFills = (kind: SpriteKind, dir: Dir, frame: Frame = 0): string[] => {
    clearSpriteCache()
    fills = []
    getSprite(kind, dir, frame, 2)
    return fills
  }

  it('renders every option of every part in every direction and frame without throwing', () => {
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
          expect(c.width).toBe(NEMO_W * 2)
          expect(c.height).toBe(NEMO_H * 2)
          expect(calls).toBeGreaterThan(before + 20)
        }
      }
    }
  })

  it('mirrors left from right about the sprite centre', () => {
    clearSpriteCache()
    transforms = []
    getSprite(base, 'right', 1, 4)
    getSprite(base, 'left', 1, 4)
    const [r, l] = transforms
    // 배율 4 = 디자인 1단위당 1px: 머리 칸 중심(72.5)이 두 방향 모두 캔버스 가운데(80px)에 온다
    expect(r.slice(0, 4)).toEqual([1, 0, 0, 1])
    expect(l.slice(0, 4)).toEqual([-1, 0, 0, 1])
    expect(r[0] * 72.5 + r[4]).toBe((NEMO_W * 4) / 2)
    expect(l[0] * 72.5 + l[4]).toBe((NEMO_W * 4) / 2)
    expect(r[5]).toBe(l[5])
  })

  it('paints the chosen skin, hair and outfit colours', () => {
    const a: Appearance = { skin: 3, hairStyle: 9, hairColor: 5, outfit: 4, outfitColor: 3, accessory: 0 }
    const f = drawFills(a, 'down')
    expect(f).toContain(SKINS[3].hex)
    expect(f).toContain(SKINS[3].cheek)
    expect(f).toContain(HAIR_COLORS[5].hex)
    expect(f).toContain(OUTFIT_COLORS[3].hex)
  })

  it('shows no face from behind and covers the back of the head with hair', () => {
    for (let h = 0; h < counts.hairStyle; h++) {
      const a: Appearance = { ...base, skin: 1, hairStyle: h, hairColor: 5 }
      const front = drawFills(a, 'down')
      const back = drawFills(a, 'up')
      expect(front).toContain(SKINS[1].cheek)
      expect(front).toContain('#000000') // 눈
      expect(back).not.toContain(SKINS[1].cheek)
      expect(back).not.toContain(SKINS[1].ear)
      expect(back.filter((c) => c === HAIR_COLORS[5].hex).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('dresses the couple: tuxedo for the groom, white gown and veil for the bride', () => {
    const groom = drawFills('groom', 'down')
    const bride = drawFills('bride', 'down')
    expect(groom).toContain('#1e1e28')
    expect(groom).not.toContain('#f6f1ff')
    expect(bride).toContain('#f6f1ff') // 면사포
    expect(bride.filter((c) => c === '#ffffff').length).toBeGreaterThan(3)
    // 하객 번호로도 같은 옷이 나온다 (정규화가 막지 않는다 — 제외는 registry 의 몫)
    expect(drawFills({ ...base, outfit: 0 }, 'down')).toContain('#1e1e28')
  })

  it('caches per (appearance, dir, frame, scale) and treats equivalent inputs as one key', () => {
    clearSpriteCache()
    const a = getSprite(base, 'down', 0, 2)
    expect(getSprite({ ...base }, 'down', 0, 2)).toBe(a)
    expect(getSprite({ ...base, skin: 1.2 } as Appearance, 'down', 0, 2.01)).toBe(a)
    expect(getSprite({ ...base, style: 'pixel' }, 'down', 0, 2)).toBe(a)
    expect(getSprite(base, 'down', 1, 2)).not.toBe(a)
    expect(getSprite(base, 'left', 0, 2)).not.toBe(a)
    expect(getSprite(base, 'down', 0, 3)).not.toBe(a)
    expect(getSprite({ ...base, accessory: 1 }, 'down', 0, 2)).not.toBe(a)
    expect(spriteCacheStats().entries).toBe(5)
  })

  it('clamps the baked scale', () => {
    clearSpriteCache()
    expect(getSprite(base, 'down', 0, 500).width).toBe(NEMO_W * MAX_SCALE)
    expect(getSprite(base, 'down', 0, -3).width).toBe(Math.ceil(NEMO_W * 0.25))
    expect(getSprite(base, 'down', 0, NaN).width).toBe(NEMO_W * 2)
    expect(getSprite(base, 'down', 0).height).toBe(NEMO_H * 2)
  })

  it('evicts least-recently-used sprites and never exceeds the caps', () => {
    clearSpriteCache()
    const r = rng(9)
    const first = getSprite(base, 'down', 0, 4.45)
    let keepAlive = first
    for (let i = 0; i < CACHE_MAX_ENTRIES * 2; i++) {
      getSprite(randomAppearance(r), DIRS[i % 4], (i % 3) as Frame, 4.45)
      if (i % 50 === 0) keepAlive = getSprite(base, 'down', 0, 4.45)
      const st = spriteCacheStats()
      expect(st.entries).toBeLessThanOrEqual(CACHE_MAX_ENTRIES)
      expect(st.pixels).toBeLessThanOrEqual(CACHE_MAX_PIXELS)
    }
    expect(keepAlive).toBe(first)
    clearSpriteCache()
    for (let i = 0; i < 400; i++) getSprite(randomAppearance(r), 'down', 0, MAX_SCALE)
    expect(spriteCacheStats().pixels).toBeLessThanOrEqual(CACHE_MAX_PIXELS)
    expect(spriteCacheStats().entries).toBeLessThan(400)
    clearSpriteCache()
    expect(spriteCacheStats()).toEqual({ entries: 0, pixels: 0 })
  })
})
