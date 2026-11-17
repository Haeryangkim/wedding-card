/**
 * DOM 없는 픽셀 그리드. 재질 id(Uint8Array) 를 찍고 마지막에 RGBA 로 해석한다.
 * 모두 순수 함수 → Node 유닛테스트 가능.
 */
import { SPRITE_W, SPRITE_H } from './dims'
import { M, type Mat, type RGBA } from './palette'

export interface Grid {
  w: number
  h: number
  data: Uint8Array // 길이 w*h, 각 칸은 Mat
}

export function makeGrid(w = SPRITE_W, h = SPRITE_H): Grid {
  return { w, h, data: new Uint8Array(w * h) }
}

export function setPx(g: Grid, x: number, y: number, m: Mat): void {
  const xi = x | 0
  const yi = y | 0
  if (xi < 0 || yi < 0 || xi >= g.w || yi >= g.h) return
  g.data[yi * g.w + xi] = m
}
export function getPx(g: Grid, x: number, y: number): Mat {
  const xi = x | 0
  const yi = y | 0
  if (xi < 0 || yi < 0 || xi >= g.w || yi >= g.h) return M.NONE
  return g.data[yi * g.w + xi] as Mat
}

/** y 행의 [x0,x1] 칸을 m 으로 채움 (끝 포함). */
export function hspan(g: Grid, y: number, x0: number, x1: number, m: Mat): void {
  const a = Math.min(x0, x1)
  const b = Math.max(x0, x1)
  for (let x = a; x <= b; x++) setPx(g, x, y, m)
}
export function vspan(g: Grid, x: number, y0: number, y1: number, m: Mat): void {
  const a = Math.min(y0, y1)
  const b = Math.max(y0, y1)
  for (let y = a; y <= b; y++) setPx(g, x, y, m)
}
export function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, m: Mat): void {
  for (let y = y0; y <= y1; y++) hspan(g, y, x0, x1, m)
}

/** 중심 (cx,cy), 반지름 (rx,ry) 타원을 m 으로 채움. 경계는 반 칸 바깥까지 포함해 둥글게. */
export function fillEllipse(g: Grid, cx: number, cy: number, rx: number, ry: number, m: Mat): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / (rx + 0.0001)
      const dy = (y + 0.5 - cy) / (ry + 0.0001)
      if (dx * dx + dy * dy <= 1) setPx(g, x, y, m)
    }
  }
}

/** mat 재질을 to 로 바꾼다 (그 칸이 mat 일 때만). */
export function recolor(g: Grid, from: Mat, to: Mat): void {
  for (let i = 0; i < g.data.length; i++) if (g.data[i] === from) g.data[i] = to
}

/** 좌우 반전된 새 그리드. */
export function mirrorX(src: Grid): Grid {
  const g = makeGrid(src.w, src.h)
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) g.data[y * g.w + (g.w - 1 - x)] = src.data[y * g.w + x]
  return g
}

/**
 * 비어 있는 칸 중 상하좌우에 불투명 칸이 닿는 곳을 1px 외곽선으로 채운다.
 * (일관된 짙은 테두리)
 */
export function autoOutline(g: Grid, outline: Mat = M.OUTLINE): void {
  const { w, h, data } = g
  const out = new Uint8Array(data) // 복사본에 기록 (원본 이웃 판정 유지)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] !== M.NONE) continue
      const up = y > 0 && data[(y - 1) * w + x] !== M.NONE
      const dn = y < h - 1 && data[(y + 1) * w + x] !== M.NONE
      const lf = x > 0 && data[y * w + (x - 1)] !== M.NONE
      const rt = x < w - 1 && data[y * w + (x + 1)] !== M.NONE
      if (up || dn || lf || rt) out[y * w + x] = outline
    }
  }
  g.data = out
}

export function toRGBA(g: Grid, lut: Record<number, RGBA>): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(g.w * g.h * 4)
  for (let i = 0; i < g.data.length; i++) {
    const c = lut[g.data[i]]
    if (!c) continue // 투명
    buf[i * 4] = c[0]
    buf[i * 4 + 1] = c[1]
    buf[i * 4 + 2] = c[2]
    buf[i * 4 + 3] = c[3]
  }
  return buf
}
