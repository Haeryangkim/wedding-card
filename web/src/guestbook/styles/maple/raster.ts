/**
 * 작은 래스터 엔진: 색 인덱스 격자(Layer)에 도형을 찍고, 층마다 1px 외곽선을 둘러 합성(Comp)한다.
 * 층을 따로 찍기 때문에 머리카락·얼굴·상의·하의·신발·모자가 서로 겹치는 "장비 레이어" 느낌이 난다.
 * DOM 을 쓰지 않는다 (테스트 가능).
 */
import { MAPLE_H as H, MAPLE_W as W } from './dims'
import { ramp, type RGB } from './palette'

/** 재질 = 4톤. 값은 전역 색 표의 인덱스(1부터, 0 = 빈 칸) */
export interface Mat {
  hi: number
  b: number
  sh: number
  ln: number
}

const colors: RGB[] = [[0, 0, 0]]
const lineOf: number[] = [0]
const matCache = new Map<string, Mat>()

function reg(c: RGB): number {
  colors.push(c)
  lineOf.push(0)
  return colors.length - 1
}

/** 기본색에서 재질을 만든다 (캐시됨) */
export function mat(base: RGB): Mat {
  const key = base.join(',')
  const hit = matCache.get(key)
  if (hit) return hit
  const r = ramp(base)
  const m: Mat = { hi: reg(r[0]), b: reg(r[1]), sh: reg(r[2]), ln: reg(r[3]) }
  lineOf[m.hi] = lineOf[m.b] = lineOf[m.sh] = lineOf[m.ln] = m.ln
  matCache.set(key, m)
  return m
}

/** 4톤을 직접 지정한 재질 (웨딩드레스처럼 램프로 만들기 어려운 흰색 계열용) */
export function mat4(hi: RGB, b: RGB, sh: RGB, ln: RGB): Mat {
  const key = `m4|${hi.join(',')}|${b.join(',')}|${sh.join(',')}|${ln.join(',')}`
  const hit = matCache.get(key)
  if (hit) return hit
  const m: Mat = { hi: reg(hi), b: reg(b), sh: reg(sh), ln: reg(ln) }
  lineOf[m.hi] = lineOf[m.b] = lineOf[m.sh] = lineOf[m.ln] = m.ln
  matCache.set(key, m)
  return m
}

/** 한 톤 어둡게 쓴 재질 (3/4 측면의 먼 쪽 팔다리) */
export function dim(m: Mat): Mat {
  return { hi: m.b, b: m.sh, sh: m.sh, ln: m.ln }
}

/** 외곽선 색을 직접 정한 단색 (눈·입 등 세부용) */
export function flat(c: RGB, line?: RGB): number {
  const key = `f${c.join(',')}|${line ? line.join(',') : ''}`
  const hit = matCache.get(key)
  if (hit) return hit.b
  const id = reg(c)
  lineOf[id] = line ? reg(line) : id
  if (line) lineOf[lineOf[id]] = lineOf[id]
  matCache.set(key, { hi: id, b: id, sh: id, ln: lineOf[id] })
  return id
}

export class Layer {
  d = new Uint16Array(W * H)
  /** true 면 이미 칠해진 칸에만 그린다 (무늬·음영용) */
  clip = false
  /** 칠해진 영역의 경계 상자 (rim·stamp 가 이 안만 훑는다) */
  x0 = W
  y0 = H
  x1 = -1
  y1 = -1

  get(x: number, y: number): number {
    return x < 0 || y < 0 || x >= W || y >= H ? 0 : this.d[y * W + x]
  }
  set(x: number, y: number, c: number): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = y * W + x
    if (this.clip && !this.d[i]) return
    this.d[i] = c
    if (x < this.x0) this.x0 = x
    if (x > this.x1) this.x1 = x
    if (y < this.y0) this.y0 = y
    if (y > this.y1) this.y1 = y
  }
  /** 가로 줄 (양 끝 포함) */
  row(y: number, x0: number, x1: number, c: number): void {
    for (let x = Math.round(x0); x <= Math.round(x1); x++) this.set(x, y, c)
  }
  col(x: number, y0: number, y1: number, c: number): void {
    for (let y = Math.round(y0); y <= Math.round(y1); y++) this.set(x, y, c)
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: number): void {
    for (let y = Math.round(y0); y <= Math.round(y1); y++) this.row(y, x0, x1, c)
  }
  /** (초)타원. n = 2 타원, 클수록 네모에 가까워진다 */
  ell(cx: number, cy: number, rx: number, ry: number, c: number, n = 2): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = Math.abs(x - cx) / rx
        const v = Math.abs(y - cy) / ry
        if (Math.pow(u, n) + Math.pow(v, n) <= 1) this.set(x, y, c)
      }
  }
  /** 위에서 아래로 내려가는 팔다리: 왼쪽 모서리 x 가 (x0,y0) → (x1,y1) 로 변하는 폭 w 의 띠 */
  limb(x0: number, y0: number, x1: number, y1: number, w: number, c: number): void {
    const n = Math.max(1, y1 - y0)
    for (let y = y0; y <= y1; y++) {
      const x = Math.round(x0 + ((x1 - x0) * (y - y0)) / n)
      this.row(y, x, x + w - 1, c)
    }
  }
  /** 행마다 중심·반폭을 주는 좌우 대칭 실루엣 (치마 등) */
  span(y0: number, y1: number, cx: number, half: (t: number) => number, c: number): void {
    const n = Math.max(1, y1 - y0)
    for (let y = y0; y <= y1; y++) {
      const hw = half((y - y0) / n)
      this.row(y, Math.ceil(cx - hw), Math.floor(cx + hw), c)
    }
  }
  /** 클립을 켠 채 실행 */
  on(fn: () => void): void {
    const prev = this.clip
    this.clip = true
    fn()
    this.clip = prev
  }
  /**
   * 자동 셀 셰이딩: 색 from 인 칸 중 (dx,dy) 방향으로 n 칸 안에 빈 칸이 있으면 to 로 바꾼다.
   * → 실루엣의 한쪽 가장자리에 음영 띠가 생긴다.
   */
  rim(from: number, to: number, dx: number, dy: number, n = 1): void {
    const hits: number[] = []
    for (let y = this.y0; y <= this.y1; y++)
      for (let x = this.x0; x <= this.x1; x++) {
        if (this.d[y * W + x] !== from) continue
        for (let k = 1; k <= n; k++)
          if (!this.get(x + dx * k, y + dy * k)) {
            hits.push(y * W + x)
            break
          }
      }
    for (const i of hits) this.d[i] = to
  }
  /** 지우기 (clip 과 무관) */
  erase(x: number, y: number): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= W || y >= H) return
    this.d[y * W + x] = 0
  }
  /** 색 바꾸기 */
  swap(from: number, to: number): void {
    for (let i = 0; i < this.d.length; i++) if (this.d[i] === from) this.d[i] = to
  }
}

export class Comp {
  d = new Uint16Array(W * H)

  /** 층을 (dx,dy) 만큼 옮겨 찍는다. outline 이면 층 바깥 4방향 이웃에 외곽선을 두른다 */
  stamp(l: Layer, dx = 0, dy = 0, outline = true, tint?: (under: number, c: number) => number | undefined): void {
    const put = (x: number, y: number, c: number) => {
      x += dx
      y += dy
      if (x < 0 || y < 0 || x >= W || y >= H) return
      // tint: 아래에 깔린 색에 따라 비쳐 보이는 색으로 바꾼다 (베일 너머의 머리카락)
      const t = tint?.(this.d[y * W + x], c)
      this.d[y * W + x] = t ?? c
    }
    if (outline)
      for (let y = l.y0; y <= l.y1; y++)
        for (let x = l.x0; x <= l.x1; x++) {
          const c = l.d[y * W + x]
          if (!c) continue
          const ln = lineOf[c]
          if (!l.get(x - 1, y)) put(x - 1, y, ln)
          if (!l.get(x + 1, y)) put(x + 1, y, ln)
          if (!l.get(x, y - 1)) put(x, y - 1, ln)
          if (!l.get(x, y + 1)) put(x, y + 1, ln)
        }
    for (let y = l.y0; y <= l.y1; y++)
      for (let x = l.x0; x <= l.x1; x++) {
        const c = l.d[y * W + x]
        if (c) put(x, y, c)
      }
  }

  toRGBA(flip: boolean): Uint8ClampedArray {
    const out = new Uint8ClampedArray(W * H * 4)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = this.d[y * W + (flip ? W - 1 - x : x)]
        if (!c) continue
        const rgb = colors[c]
        const o = (y * W + x) * 4
        out[o] = rgb[0]
        out[o + 1] = rgb[1]
        out[o + 2] = rgb[2]
        out[o + 3] = 255
      }
    return out
  }
}
