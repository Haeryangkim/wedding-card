/**
 * DOM 없는 픽셀 그리드. 칸 값 = 재질 톤을 뜻하는 글자 코드(0 = 투명).
 * 문자열 템플릿을 찍고(stamp), 마지막에 Lut 로 RGBA 를 해석한다. 모두 순수 함수.
 */
import { SPRITE_H, SPRITE_W } from './dims'
import type { RGB, Ramp } from './palette'

export interface Grid {
  w: number
  h: number
  data: Uint8Array
}

export function makeGrid(w = SPRITE_W, h = SPRITE_H): Grid {
  return { w, h, data: new Uint8Array(w * h) }
}

export function setPx(g: Grid, x: number, y: number, ch: string): void {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return
  g.data[y * g.w + x] = ch === '_' ? 0 : ch.charCodeAt(0)
}

export function getPx(g: Grid, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return ''
  const v = g.data[y * g.w + x]
  return v === 0 ? '' : String.fromCharCode(v)
}

/** 글자 치환표. 값이 '' 이면 그 칸은 건너뜀 */
export type Remap = Record<string, string>

/**
 * 문자열 템플릿을 (x0,y0) 에 찍는다. '.'/' ' = 건너뜀, '_' = 지움(투명으로).
 * remap 으로 재질군을 바꿔 찍을 수 있다 (예: 바지 템플릿을 맨다리 피부로).
 */
export function stamp(g: Grid, rows: readonly string[], y0: number, x0 = 0, remap?: Remap): void {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    const y = y0 + r
    if (y < 0 || y >= g.h) continue
    for (let i = 0; i < row.length; i++) {
      let ch = row[i]
      if (ch === '.' || ch === ' ') continue
      if (remap && ch in remap) {
        ch = remap[ch]
        if (ch === '') continue
      }
      const x = x0 + i
      if (x < 0 || x >= g.w) continue
      g.data[y * g.w + x] = ch === '_' ? 0 : ch.charCodeAt(0)
    }
  }
}

/** src 를 dy 만큼 내려 dst 위에 덮어 그린다 (투명 칸은 건너뜀). */
export function blit(dst: Grid, src: Grid, dy = 0): void {
  for (let y = 0; y < src.h; y++) {
    const ty = y + dy
    if (ty < 0 || ty >= dst.h) continue
    for (let x = 0; x < src.w; x++) {
      const v = src.data[y * src.w + x]
      if (v !== 0) dst.data[ty * dst.w + x] = v
    }
  }
}

/* ── 색 해석 ─────────────────────────────────────────────── */
export interface Lut {
  /** 글자 코드 → 색 */
  color: (RGB | undefined)[]
  /** 글자 코드 → 그 재질이 실루엣 가장자리일 때의 외곽선 색 (아래·오른쪽 = 그늘진 쪽) */
  outline: (RGB | undefined)[]
  /** 빛을 받는 위·왼쪽 가장자리의 외곽선 색 (한 톤 밝다) */
  outlineLit: (RGB | undefined)[]
}

export function makeLut(): Lut {
  return { color: new Array(128), outline: new Array(128), outlineLit: new Array(128) }
}

const blend = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]

/**
 * 4글자(하이라이트·기본·음영·딥)에 램프를 배정.
 * 외곽선은 그 재질의 딥 톤(검정 아님), 빛 받는 쪽은 음영 톤과 섞어 한 단계 밝게.
 */
export function setRamp(lut: Lut, chars: string, r: Ramp, outline: RGB = r[3]): void {
  const lit = blend(r[2], outline, 0.55)
  for (let i = 0; i < 4 && i < chars.length; i++) {
    const code = chars.charCodeAt(i)
    lut.color[code] = r[i]
    lut.outline[code] = outline
    lut.outlineLit[code] = lit
  }
}
export function setColor(lut: Lut, ch: string, c: RGB, outline: RGB, lit: RGB = outline): void {
  const code = ch.charCodeAt(0)
  lut.color[code] = c
  lut.outline[code] = outline
  lut.outlineLit[code] = lit
}

const lum = (c: RGB) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11

/**
 * 그리드 → RGBA. 실루엣 바깥 1px 에 컬러 외곽선을 두른다:
 * 투명 칸이 채워진 칸과 4방향으로 닿으면, 닿은 재질들의 외곽선 색 중 가장 어두운 것을 쓴다.
 * 조명이 좌상단이므로 도형의 위·왼쪽에 놓인 외곽선(= 채워진 이웃이 아래/오른쪽에만 있음)은
 * 밝은 변형을, 아래·오른쪽(발밑, 밑면)은 가장 어두운 톤을 쓴다 → 선택적 컬러 아웃라인.
 */
export function toRGBA(g: Grid, lut: Lut): Uint8ClampedArray {
  const out = new Uint8ClampedArray(g.w * g.h * 4)
  const { w, h, data } = g
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[y * w + x])
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const v = data[i]
      let c: RGB | undefined
      if (v !== 0) {
        c = lut.color[v]
      } else {
        const up = at(x, y - 1)
        const left = at(x - 1, y)
        // 위나 왼쪽에 도형이 있으면 이 칸은 그 도형의 그늘진 가장자리
        const table = up === 0 && left === 0 ? lut.outlineLit : lut.outline
        let bestL = 1e9
        for (const nv of [left, at(x + 1, y), up, at(x, y + 1)]) {
          if (nv === 0) continue
          const oc = table[nv]
          if (!oc) continue
          const l = lum(oc)
          if (l < bestL) {
            bestL = l
            c = oc
          }
        }
      }
      if (c) {
        const o = i * 4
        out[o] = c[0]
        out[o + 1] = c[1]
        out[o + 2] = c[2]
        out[o + 3] = 255
      }
    }
  }
  return out
}
