/**
 * 그림체 등록부: 정적 메타가 실제 모듈과 어긋나지 않는지, 외형 정규화(모르는 스타일·범위 밖 인덱스·예전 글),
 * 배율 계산, 지연 로딩을 검증한다.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Appearance, PartKey } from '../types'
import * as pixel from '../character'
import * as maple from './maple'
import * as forest from './forest'
import {
  appearanceKey,
  blitScale,
  DEFAULT_STYLE,
  drawnHeight,
  getSpriteAt,
  getSpriteFor,
  getStyle,
  headHeight,
  isStyleLoaded,
  loadStyle,
  MAX_AUTO_TRIES,
  RETRY_MAX_MS,
  retryDelay,
  trimSpriteCaches,
  vectorBakeRatio,
  normalizeAnyAppearance,
  onStyleLoaded,
  PART_KEYS,
  randomAppearanceFor,
  spriteScale,
  STYLE_IDS,
  STYLE_META,
  styleOf,
  stylesVersion,
  toStyleId,
  type StyleId,
} from './registry'
import { sanitizeEntry, sanitizeNewInput } from '../validate'
import { buildSampleGuests } from '../sampleGuests'

const modules = { pixel, maple, forest } as const
const countsOf = (defs: { key: PartKey; options: unknown[] }[]) =>
  Object.fromEntries(defs.map((p) => [p.key, p.options.length]))

const ZERO = { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0 }
const HUGE = { skin: 999, hairStyle: 999, hairColor: 999, outfit: 999, outfitColor: 999, accessory: 999 }

describe('STYLE_META 는 모듈과 일치한다', () => {
  it.each(STYLE_IDS)('%s: 파츠별 옵션 개수', (id) => {
    expect(STYLE_META[id].counts).toEqual(countsOf(modules[id].PART_DEFS))
  })
  it('명목 크기와 발 위치', () => {
    expect([STYLE_META.pixel.nominalW, STYLE_META.pixel.nominalH]).toEqual([pixel.SPRITE_W, pixel.SPRITE_H])
    expect([STYLE_META.maple.nominalW, STYLE_META.maple.nominalH]).toEqual([maple.MAPLE_W, maple.MAPLE_H])
    // maple.FOOT_Y 는 신발의 마지막 색칠 행 — 그 아래 외곽선 1행까지가 발
    expect(STYLE_META.maple.footY).toBe(maple.FOOT_Y + 2)
    expect([STYLE_META.forest.nominalW, STYLE_META.forest.nominalH]).toEqual([forest.FOREST_W, forest.FOREST_H])
    expect(STYLE_META.forest.footY).toBeCloseTo(forest.FOREST_FOOT_Y)
    expect(STYLE_META.maple.pixelated).toBe(maple.STYLE_INFO.pixelated)
    expect(STYLE_META.forest.pixelated).toBe(forest.STYLE_INFO.pixelated)
  })
  it('화면에 보이는 이름에 게임 상표를 쓰지 않는다', () => {
    expect(STYLE_META.pixel.label).toBe('기본 픽셀')
    for (const id of STYLE_IDS) {
      expect(`${STYLE_META[id].label} ${STYLE_META[id].description}`).not.toMatch(/메이플|동숲|동물의|스타듀|maple|animal/i)
    }
  })
  it('기본 그림체는 기본 픽셀이고 목록의 첫 번째다', () => {
    expect(DEFAULT_STYLE).toBe('pixel')
    expect(STYLE_IDS[0]).toBe('pixel')
  })
})

describe('normalizeAnyAppearance', () => {
  it('style 이 없는 예전 글은 기본 픽셀 — style 필드를 붙이지 않는다', () => {
    const a = normalizeAnyAppearance({ skin: 1, hairStyle: 2, hairColor: 3, outfit: 4, outfitColor: 5, accessory: 6 })
    expect(a).toEqual({ skin: 1, hairStyle: 2, hairColor: 3, outfit: 4, outfitColor: 5, accessory: 6 })
    expect('style' in a).toBe(false)
    expect(styleOf(a)).toBe('pixel')
  })
  it("명시한 'pixel' 도 같은 모양으로 정리된다", () => {
    expect(normalizeAnyAppearance({ ...ZERO, style: 'pixel' })).toEqual(ZERO)
  })
  it.each([['anime'], [''], [3], [null], [{}], ['MAPLE'], ['__proto__']])('모르는 style %j → 기본 픽셀', (style) => {
    const a = normalizeAnyAppearance({ ...HUGE, style })
    expect(styleOf(a)).toBe('pixel')
    expect('style' in a).toBe(false)
    for (const k of PART_KEYS) expect(a[k]).toBe(STYLE_META.pixel.counts[k] - 1)
  })
  it.each(STYLE_IDS)('%s: 범위 밖 인덱스는 그 스타일의 옵션 개수로 자른다', (id) => {
    const hi = normalizeAnyAppearance({ ...HUGE, style: id })
    const lo = normalizeAnyAppearance({ skin: -1, hairStyle: NaN, hairColor: -Infinity, outfit: 'x', outfitColor: null, style: id })
    expect(styleOf(hi)).toBe(id)
    for (const k of PART_KEYS) {
      expect(hi[k]).toBe(STYLE_META[id].counts[k] - 1)
      expect(lo[k]).toBe(0)
    }
  })
  it('같은 인덱스라도 스타일에 따라 유효 범위가 다르다', () => {
    // 머리 색 11: SD 캐릭터(12색)에서는 유효, 기본 픽셀·숲속 주민(10색)에서는 마지막 색으로
    expect(normalizeAnyAppearance({ ...ZERO, hairColor: 11, style: 'maple' }).hairColor).toBe(11)
    expect(normalizeAnyAppearance({ ...ZERO, hairColor: 11 }).hairColor).toBe(9)
    expect(normalizeAnyAppearance({ ...ZERO, hairColor: 11, style: 'forest' }).hairColor).toBe(9)
    // 머리 모양 11: 숲속 주민은 11가지(0..10)
    expect(normalizeAnyAppearance({ ...ZERO, hairStyle: 11, style: 'forest' }).hairStyle).toBe(10)
    expect(normalizeAnyAppearance({ ...ZERO, hairStyle: 11, style: 'maple' }).hairStyle).toBe(11)
  })
  it('객체가 아닌 값도 유효한 기본 픽셀 외형이 된다', () => {
    for (const raw of [null, undefined, 'x', 3, []]) expect(normalizeAnyAppearance(raw)).toEqual(ZERO)
  })
  it('결과는 각 모듈의 normalizeAppearance 에서도 그대로다 (모듈이 다시 고치지 않는다)', () => {
    let seed = 11
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (const id of STYLE_IDS) {
      for (let i = 0; i < 200; i++) {
        const raw = Object.fromEntries(PART_KEYS.map((k) => [k, Math.floor(rnd() * 40) - 8]))
        const a = normalizeAnyAppearance({ ...raw, style: id })
        const { style: _style, ...parts } = a
        expect(modules[id].normalizeAppearance(parts)).toEqual(parts)
      }
    }
  })
  it('기본 픽셀은 기존 character.normalizeAppearance 와 같은 결과', () => {
    for (const raw of [HUGE, ZERO, { skin: 2.6, hairStyle: '3', hairColor: -2 }, null]) {
      expect(normalizeAnyAppearance(raw)).toEqual(pixel.normalizeAppearance(raw))
    }
  })
  it('여분의 필드는 버린다', () => {
    expect(Object.keys(normalizeAnyAppearance({ ...ZERO, style: 'maple', evil: 1 })).sort()).toEqual(
      [...PART_KEYS, 'style'].sort(),
    )
  })
})

describe('랜덤 · 키', () => {
  it.each(STYLE_IDS)('%s: randomAppearanceFor 는 항상 유효하고 스타일 꼬리표가 붙는다', (id) => {
    for (let i = 0; i < 300; i++) {
      const a = randomAppearanceFor(id)
      expect(styleOf(a)).toBe(id)
      expect(normalizeAnyAppearance(a)).toEqual(a)
    }
    expect(randomAppearanceFor(id, () => 0.999999)).toEqual(normalizeAnyAppearance({ ...HUGE, style: id }))
  })
  it('appearanceKey 는 스타일이 다르면 다르다', () => {
    expect(appearanceKey(ZERO)).toBe(appearanceKey({ ...ZERO, style: 'pixel' }))
    expect(appearanceKey(ZERO)).not.toBe(appearanceKey({ ...ZERO, style: 'maple' }))
    expect(appearanceKey({ ...ZERO, style: 'maple' })).not.toBe(appearanceKey({ ...ZERO, style: 'forest' }))
    expect(appearanceKey('groom')).toBe('groom')
  })
  it('toStyleId / styleOf: 신랑·신부는 기본 픽셀', () => {
    expect(toStyleId('forest')).toBe('forest')
    expect(toStyleId('nope')).toBe('pixel')
    expect(styleOf('groom')).toBe('pixel')
    expect(styleOf('bride')).toBe('pixel')
  })
})

describe('배율 (장면에서 키 맞추기)', () => {
  it('기본 픽셀은 장면 배율 그대로', () => {
    for (const ppu of [3, 4.48, 5, 7]) {
      expect(spriteScale('pixel', ppu)).toBe(ppu)
      expect(drawnHeight('pixel', ppu)).toBeCloseTo(36)
      expect(blitScale('pixel', ppu)).toBe(ppu)
    }
  })
  it('SD 캐릭터는 목표 높이에 가장 가까운 정수배 (기기 픽셀)', () => {
    expect(spriteScale('maple', 5)).toBe(3) // 430px 폭 · dpr 2 스테이지
    expect(spriteScale('maple', 7)).toBe(4) // dpr 3
    expect(spriteScale('maple', 0.5)).toBe(1) // 최소 1
    for (const ppu of [2, 3, 4, 4.48, 5, 6, 7, 8, 10]) {
      const k = spriteScale('maple', ppu)
      expect(Number.isInteger(k)).toBe(true)
      const target = (ppu * 40) / 64
      // 목표와의 크기 비율이 이웃 정수보다 나쁘지 않다
      const err = (n: number) => Math.max(n / target, target / n)
      expect(err(k)).toBeLessThanOrEqual(Math.min(err(k + 1), k > 1 ? err(k - 1) : Infinity) + 1e-9)
    }
  })
  it('숲속 주민은 기기 해상도 그대로 (벡터) — 캔버스를 1:1 로 옮긴다', () => {
    expect(spriteScale('forest', 4.48)).toBeCloseTo((4.48 * STYLE_META.forest.worldH) / STYLE_META.forest.nominalH)
    expect(blitScale('forest', 4.48)).toBe(1)
    expect(drawnHeight('forest', 7)).toBeCloseTo(STYLE_META.forest.worldH)
  })
  it('세 그림체의 인물 키(발~머리)가 비슷하다', () => {
    for (const ppu of [4, 5, 6, 7, 8]) {
      const hs = STYLE_IDS.map((id) => headHeight(id, ppu))
      expect(Math.max(...hs) / Math.min(...hs)).toBeLessThan(1.3)
    }
  })
})

describe('지연 로딩', () => {
  it('기본 픽셀은 처음부터 준비되어 있다', () => {
    expect(isStyleLoaded('pixel')).toBe(true)
    expect(getStyle('pixel')?.partDefs).toBe(pixel.PART_DEFS)
  })

  it('모듈이 오기 전에는 스프라이트가 null 이고(불러오기 시작), 오면 알림이 온다', async () => {
    const ids: StyleId[] = ['maple', 'forest']
    for (const id of ids) {
      expect(isStyleLoaded(id)).toBe(false)
      expect(getStyle(id)).toBeNull()
    }
    const before = stylesVersion()
    const cb = vi.fn()
    const off = onStyleLoaded(cb)
    // 장면이 그리려고 했을 때: 아무것도 못 그리지만 불러오기가 시작된다
    expect(getSpriteFor({ ...ZERO, style: 'maple' }, 'down', 0, 5)).toBeNull()
    expect(getSpriteAt({ ...ZERO, style: 'forest' }, 'down', 0, 5)).toBeNull()
    const [m, f] = await Promise.all([loadStyle('maple'), loadStyle('forest')])
    off()
    expect(cb).toHaveBeenCalledTimes(2)
    expect(stylesVersion()).toBe(before + 2)
    expect(isStyleLoaded('maple') && isStyleLoaded('forest')).toBe(true)
    expect(m.partDefs).toBe(maple.PART_DEFS)
    expect(f.partDefs).toBe(forest.PART_DEFS)
    expect(m.label).toBe(STYLE_META.maple.label)
    // 스타일의 random/normalize 는 꼬리표까지 붙인다
    expect(styleOf(m.randomAppearance())).toBe('maple')
    expect(f.normalizeAppearance({ ...HUGE })).toEqual(normalizeAnyAppearance({ ...HUGE, style: 'forest' }))
    // 다시 불러도 같은 객체
    expect(await loadStyle('maple')).toBe(m)
  })
})

describe('불러오기 실패', () => {
  const okModule = () =>
    Promise.resolve({
      partDefs: maple.PART_DEFS,
      randomAppearance: maple.randomAppearance,
      normalizeAppearance: maple.normalizeAppearance,
      getSprite: () => ({}) as HTMLCanvasElement,
    })
  const M = { ...ZERO, style: 'maple' } as Appearance

  it('한 번 더 시도하고, 그래도 실패하면 거절하되 다음 호출에서 다시 시도할 수 있다', async () => {
    vi.resetModules()
    const fresh = await import('./registry')
    const importer = vi.fn(() => Promise.reject(new Error('offline')))
    await expect(fresh.loadStyle('maple', importer)).rejects.toThrow('offline')
    expect(importer).toHaveBeenCalledTimes(2)
    expect(fresh.isStyleLoaded('maple')).toBe(false)
    expect(fresh.styleStatus('maple')).toBe('failed')
    const ok = vi.fn(okModule)
    await fresh.loadStyle('maple', ok)
    expect(fresh.isStyleLoaded('maple')).toBe(true)
    expect(fresh.styleStatus('maple')).toBe('ready')
    expect(fresh.isStyleFailed('maple')).toBe(false)
  })

  it('retryDelay: 5초에서 두 배씩, 60초에서 멈춘다', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(retryDelay)).toEqual([5000, 10000, 20000, 40000, 60000, 60000, 60000])
  })

  it('실패한 뒤 매 프레임 그려도 간격이 지나기 전에는 다시 불러오지 않고, 구독자에게 실패를 알린다', async () => {
    vi.useFakeTimers()
    try {
      vi.resetModules()
      const fresh = await import('./registry')
      const importer = vi.fn(() => Promise.reject(new Error('404')))
      fresh.setStyleImporter('maple', importer)
      const cb = vi.fn()
      fresh.onStyleLoaded(cb)
      const v0 = fresh.stylesVersion()
      expect(fresh.styleStatus('maple')).toBe('idle')

      // 첫 프레임: 불러오기 시작 (import 두 번) → 실패
      expect(fresh.getSpriteAt(M, 'down', 0, 5)).toBeNull()
      expect(fresh.styleStatus('maple')).toBe('loading')
      for (let i = 0; i < 100; i++) fresh.getSpriteAt(M, 'down', 0, 5)
      await vi.advanceTimersByTimeAsync(0)
      expect(importer).toHaveBeenCalledTimes(2)
      expect(fresh.styleStatus('maple')).toBe('failed')
      expect(cb).toHaveBeenCalledTimes(1)
      expect(fresh.stylesVersion()).toBe(v0 + 1)

      // 간격(5초) 안에는 그리기 루프·ensureStyles·autoLoadStyle 이 아무리 불러도 import 하지 않는다
      for (let i = 0; i < 300; i++) {
        fresh.getSpriteAt(M, 'down', 0, 5)
        fresh.ensureStyles([M])
        fresh.autoLoadStyle('maple')
        await vi.advanceTimersByTimeAsync(16)
      }
      expect(importer).toHaveBeenCalledTimes(2)

      // 간격이 지나면 구독자를 깨우고(정지 화면용), 그 뒤의 자동 호출이 한 번 다시 시도한다
      await vi.advanceTimersByTimeAsync(300)
      expect(cb).toHaveBeenCalledTimes(2)
      fresh.getSpriteAt(M, 'down', 0, 5)
      fresh.getSpriteAt(M, 'down', 0, 5)
      expect(cb).toHaveBeenCalledTimes(3) // 실패 → 불러오는 중
      await vi.advanceTimersByTimeAsync(0)
      expect(importer).toHaveBeenCalledTimes(4)
      expect(fresh.styleStatus('maple')).toBe('failed')

      // 두 번째 실패 뒤에는 10초를 기다린다
      await vi.advanceTimersByTimeAsync(9_000)
      fresh.getSpriteAt(M, 'down', 0, 5)
      expect(importer).toHaveBeenCalledTimes(4)
      await vi.advanceTimersByTimeAsync(1_100)
      fresh.getSpriteAt(M, 'down', 0, 5)
      await vi.advanceTimersByTimeAsync(0)
      expect(importer).toHaveBeenCalledTimes(6)
    } finally {
      vi.useRealTimers()
    }
  })

  it('계속 실패하면 자동 재시도를 멈추고, retryStyle·resetStyleFailures 로 다시 살아난다', async () => {
    vi.useFakeTimers()
    try {
      vi.resetModules()
      const fresh = await import('./registry')
      let online = false
      const importer = vi.fn(() => (online ? okModule() : Promise.reject(new Error('offline'))))
      fresh.setStyleImporter('maple', importer)
      for (let i = 0; i < 40; i++) {
        fresh.getSpriteAt(M, 'down', 0, 5)
        await vi.advanceTimersByTimeAsync(RETRY_MAX_MS)
      }
      expect(importer).toHaveBeenCalledTimes(MAX_AUTO_TRIES * 2)
      expect(fresh.styleStatus('maple')).toBe('failed')

      // 네트워크 복귀·탭 복귀: 대기 없이 자동 재시도가 다시 허용되고 구독자가 깨어난다
      const cb = vi.fn()
      fresh.onStyleLoaded(cb)
      fresh.resetStyleFailures()
      expect(cb).toHaveBeenCalledTimes(1)
      fresh.ensureStyles([M])
      await vi.advanceTimersByTimeAsync(0)
      expect(importer).toHaveBeenCalledTimes(MAX_AUTO_TRIES * 2 + 2)
      fresh.ensureStyles([M])
      await vi.advanceTimersByTimeAsync(0)
      expect(importer).toHaveBeenCalledTimes(MAX_AUTO_TRIES * 2 + 2)

      // "다시 시도" 버튼: 간격과 상관없이 바로 시도하고, 성공하면 준비 상태가 된다
      online = true
      fresh.retryStyle('maple')
      expect(fresh.styleStatus('maple')).toBe('loading')
      await vi.advanceTimersByTimeAsync(0)
      expect(fresh.styleStatus('maple')).toBe('ready')
      expect(fresh.getSpriteAt(M, 'down', 0, 5)).not.toBeNull()
      // 준비된 뒤에는 남은 타이머가 구독자를 깨우지 않는다
      const n = cb.mock.calls.length
      await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 2)
      expect(cb).toHaveBeenCalledTimes(n)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('벡터 그림체는 dpr 2 까지만 굽는다', () => {
  it('vectorBakeRatio: dpr 2 이하는 그대로, 3 이면 2/3', () => {
    expect(vectorBakeRatio(1)).toBe(1)
    expect(vectorBakeRatio(2)).toBe(1)
    expect(vectorBakeRatio(3)).toBeCloseTo(2 / 3)
    expect(vectorBakeRatio()).toBe(1) // window 없음
  })

  it('dpr 3 에서는 2/3 배율로 구운 캔버스를 1.5배로 그려 같은 크기가 된다 + trimSpriteCaches 가 캐시를 비운다', async () => {
    const g = globalThis as unknown as { window?: unknown }
    const saved = g.window
    const f = await loadStyle('forest')
    const getSprite = vi.spyOn(f, 'getSprite').mockReturnValue({ width: 84, height: 108 } as HTMLCanvasElement)
    const clearCache = vi.spyOn(f, 'clearCache')
    try {
      g.window = { devicePixelRatio: 3 }
      const F = { ...ZERO, style: 'forest' } as Appearance
      getSpriteAt(F, 'down', 0, 9)
      expect(getSprite.mock.calls[0][3]).toBeCloseTo(6)
      expect(blitScale('forest', 9)).toBeCloseTo(1.5)
      expect(blitScale('maple', 9)).toBe(9)
      g.window = { devicePixelRatio: 2 }
      getSpriteAt(F, 'down', 0, 9)
      expect(getSprite.mock.calls[1][3]).toBe(9)
      expect(blitScale('forest', 9)).toBe(1)
      trimSpriteCaches()
      expect(clearCache).toHaveBeenCalledTimes(1)
    } finally {
      g.window = saved
      getSprite.mockRestore()
      clearCache.mockRestore()
    }
  })
})

describe('저장소·폼 정제에 스타일이 실려 간다', () => {
  const base = { id: 'x', name: '하객', message: '축하', side: 'groom', createdAt: 1 }
  it('sanitizeEntry: 스타일 유지 + 그 스타일 범위로 보정, 모르는 스타일·예전 글은 기본 픽셀', () => {
    const m = sanitizeEntry({ ...base, appearance: { ...HUGE, style: 'maple' } })
    expect(m?.appearance).toEqual(normalizeAnyAppearance({ ...HUGE, style: 'maple' }))
    expect(m?.appearance.style).toBe('maple')
    expect(m?.appearance.hairColor).toBe(11)
    const legacy = sanitizeEntry({ ...base, appearance: { ...ZERO, hairColor: 11 } })
    expect(legacy?.appearance).toEqual({ ...ZERO, hairColor: 9 })
    const unknown = sanitizeEntry({ ...base, appearance: { ...ZERO, style: 'voxel' } })
    expect(unknown?.appearance).toEqual(ZERO)
  })
  it('sanitizeNewInput: 서버로 보내는 외형에도 스타일이 남는다', () => {
    const out = sanitizeNewInput({
      name: '하객',
      message: '축하',
      side: 'bride',
      password: '1234',
      appearance: { ...ZERO, outfit: 10, style: 'forest' } as Appearance,
    })
    expect(out.appearance).toEqual({ ...ZERO, outfit: 9, style: 'forest' })
  })
  it('데모 샘플: 대부분 기본 픽셀이고 다른 그림체가 몇 명씩 섞여 있다', () => {
    const guests = buildSampleGuests()
    const n = (id: StyleId) => guests.filter((g) => styleOf(g.appearance) === id).length
    expect(n('maple')).toBeGreaterThanOrEqual(2)
    expect(n('forest')).toBeGreaterThanOrEqual(2)
    expect(n('pixel')).toBeGreaterThan(n('maple') + n('forest'))
    // 샘플 인덱스는 그 스타일에서 유효해야 한다 (보정으로 바뀌지 않는다)
    for (const g of guests) expect(normalizeAnyAppearance(g.appearance)).toEqual(g.appearance)
  })
})
