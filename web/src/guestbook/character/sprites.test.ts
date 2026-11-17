import { describe, expect, it } from 'vitest'
import type { Appearance } from '../types'
import type { Dir, Frame, SpriteKind } from './index'
import {
  buildBuffer,
  normalizeAppearance,
  PART_DEFS,
  randomAppearance,
  SPRITE_H,
  SPRITE_W,
} from './index'

const BASE: Appearance = {
  skin: 1,
  hairStyle: 0,
  hairColor: 1,
  outfit: 0,
  outfitColor: 1,
  accessory: 0,
}

/** PART_DEFS 에서 각 파츠 옵션 개수 */
const counts = Object.fromEntries(PART_DEFS.map((p) => [p.key, p.options.length])) as Record<
  keyof Appearance,
  number
>

function opaqueCount(data: Uint8ClampedArray): number {
  let n = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++
  return n
}

function equalBytes(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

describe('normalizeAppearance', () => {
  const keys: (keyof Appearance)[] = [
    'skin',
    'hairStyle',
    'hairColor',
    'outfit',
    'outfitColor',
    'accessory',
  ]

  function assertValid(a: Appearance) {
    for (const k of keys) {
      expect(Number.isInteger(a[k]), `${k} 정수`).toBe(true)
      expect(a[k]).toBeGreaterThanOrEqual(0)
      expect(a[k]).toBeLessThanOrEqual(counts[k] - 1)
    }
  }

  it('비객체·null·원시값을 유효 기본값으로 보정', () => {
    for (const garbage of [null, undefined, 42, 'hello', true, Symbol(), [], () => {}, NaN]) {
      assertValid(normalizeAppearance(garbage))
    }
  })

  it('음수·범위초과·소수·NaN·문자열 필드를 클램프/반올림', () => {
    assertValid(normalizeAppearance({ skin: -5 }))
    expect(normalizeAppearance({ skin: -5 }).skin).toBe(0)
    expect(normalizeAppearance({ skin: 9999 }).skin).toBe(counts.skin - 1)
    expect(normalizeAppearance({ hairStyle: 2.7 }).hairStyle).toBe(3)
    expect(normalizeAppearance({ hairColor: NaN }).hairColor).toBe(0)
    expect(normalizeAppearance({ outfit: Infinity }).outfit).toBe(counts.outfit - 1)
    expect(normalizeAppearance({ outfit: -Infinity }).outfit).toBe(0)
    expect(normalizeAppearance({ accessory: '3' }).accessory).toBe(3)
    assertValid(normalizeAppearance({ skin: {}, hairStyle: [], outfit: 'x', accessory: null }))
  })

  it('퍼지: 무작위 쓰레기 객체도 항상 유효 범위', () => {
    const pool = [NaN, Infinity, -1, 1.9, 1e9, '2', null, undefined, {}, -0.4, 5.5]
    const pick = () => pool[Math.floor(Math.random() * pool.length)]
    for (let t = 0; t < 300; t++) {
      assertValid(
        normalizeAppearance({
          skin: pick(),
          hairStyle: pick(),
          hairColor: pick(),
          outfit: pick(),
          outfitColor: pick(),
          accessory: pick(),
        }),
      )
    }
  })

  it('유효값은 그대로 보존', () => {
    const a: Appearance = {
      skin: 2,
      hairStyle: 3,
      hairColor: 4,
      outfit: 5,
      outfitColor: 2,
      accessory: 1,
    }
    expect(normalizeAppearance(a)).toEqual(a)
  })
})

describe('randomAppearance', () => {
  it('항상 유효 범위의 정수 조합을 생성', () => {
    for (let t = 0; t < 200; t++) {
      const a = randomAppearance()
      expect(normalizeAppearance(a)).toEqual(a)
    }
  })

  it('rand 함수를 받아 결정적으로 동작', () => {
    const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]
    let i = 0
    const r1 = randomAppearance(() => seq[i++ % seq.length])
    i = 0
    const r2 = randomAppearance(() => seq[i++ % seq.length])
    expect(r1).toEqual(r2)
  })
})

describe('buildBuffer', () => {
  const DIRS: Dir[] = ['down', 'left', 'right', 'up']
  const FRAMES: Frame[] = [0, 1, 2]

  it('항상 SPRITE_W×SPRITE_H RGBA 버퍼를 반환', () => {
    const buf = buildBuffer(BASE, 'down', 0)
    expect(buf.w).toBe(SPRITE_W)
    expect(buf.h).toBe(SPRITE_H)
    expect(buf.data.length).toBe(SPRITE_W * SPRITE_H * 4)
    expect(opaqueCount(buf.data)).toBeGreaterThan(40) // 비어있지 않음
  })

  it('모든 파츠 옵션이 방향·프레임 전부에서 예외 없이 그려짐', () => {
    for (const part of PART_DEFS) {
      for (let i = 0; i < part.options.length; i++) {
        const kind: Appearance = { ...BASE, [part.key]: i }
        for (const dir of DIRS) {
          for (const frame of FRAMES) {
            const buf = buildBuffer(kind, dir, frame)
            expect(buf.data.length).toBe(SPRITE_W * SPRITE_H * 4)
            expect(opaqueCount(buf.data)).toBeGreaterThan(40)
          }
        }
      }
    }
  })

  it('머리모양×의상×액세서리 조합 전수가 예외 없이 그려짐', () => {
    for (let h = 0; h < counts.hairStyle; h++)
      for (let o = 0; o < counts.outfit; o++)
        for (let acc = 0; acc < counts.accessory; acc++) {
          const buf = buildBuffer(
            { ...BASE, hairStyle: h, outfit: o, accessory: acc },
            'down',
            0,
          )
          expect(buf.data.length).toBe(SPRITE_W * SPRITE_H * 4)
        }
  })

  it('고정 캐릭터(신랑·신부)도 모든 방향·프레임에서 그려짐', () => {
    for (const kind of ['groom', 'bride'] as SpriteKind[]) {
      for (const dir of DIRS) {
        for (const frame of FRAMES) {
          const buf = buildBuffer(kind, dir, frame)
          expect(buf.data.length).toBe(SPRITE_W * SPRITE_H * 4)
          expect(opaqueCount(buf.data)).toBeGreaterThan(40)
        }
      }
    }
  })

  it('걷기 프레임(0·1·2)은 서로 다르다', () => {
    const f0 = buildBuffer(BASE, 'down', 0).data
    const f1 = buildBuffer(BASE, 'down', 1).data
    const f2 = buildBuffer(BASE, 'down', 2).data
    expect(equalBytes(f0, f1)).toBe(false)
    expect(equalBytes(f0, f2)).toBe(false)
    expect(equalBytes(f1, f2)).toBe(false)
  })

  it('left 는 right 의 좌우 반전이다', () => {
    const right = buildBuffer(BASE, 'right', 0)
    const left = buildBuffer(BASE, 'left', 0)
    const { w, h, data: L } = left
    const R = right.data
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const li = (y * w + x) * 4
        const ri = (y * w + (w - 1 - x)) * 4
        for (let c = 0; c < 4; c++) expect(L[li + c]).toBe(R[ri + c])
      }
    }
  })
})
