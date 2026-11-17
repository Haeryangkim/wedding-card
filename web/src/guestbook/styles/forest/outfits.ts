/** 의상: 실루엣(하의 종류·소매)은 데이터, 무늬/디테일은 작은 그리기 함수. */
import type { Frame, View } from './dims'
import type { Sleeve } from './body'
import { bez, circle, darken, ellipse, flat, lighten, line, luma, outline, poly, quarter, shape, type C } from './draw'
import { CREAM } from './palette'

/** 디테일을 그리는 면: 3/4 뷰는 'front' 를 변환해 쓴다 */
export type Face = 'front' | 'back'
export type Lower = 'pants' | 'dress' | 'skirt' | 'long' | 'chima'

export interface OutfitPal {
  top: string
  bottom: string
  sleeve: string
  /** null = 맨다리 */
  leg: string | null
  shoe: string
  accent: string
  /** 사용자가 고른 원색 */
  base: string
}

export interface OutfitDef {
  label: string
  lower: Lower
  sleeve: Sleeve
  sleeveW?: number
  wideLegs?: boolean
  pal(c: string): Omit<OutfitPal, 'accent' | 'base'> & { accent?: string }
  cuff?(p: OutfitPal): string
  /** 몸통 위 디테일 (몸통 모양으로 클립된 상태). 3/4 뷰에서는 'front' 그림이 변환되어 재사용된다 */
  detail?(ctx: C, face: Face, p: OutfitPal): void
  /** 치마 위 디테일 (치마 모양으로 클립된 상태). sway = 걷기 때 치맛단 흔들림 */
  skirtDetail?(ctx: C, face: Face, p: OutfitPal, sway: number): void
  /** 클립 없이 몸통 위에 얹는 것 (고름·리본 등) */
  trim?(ctx: C, face: Face, p: OutfitPal): void
  /** 머리 뒤에 깔리는 것 (후드) */
  under?(ctx: C, view: View, p: OutfitPal): void
}

/** 붉은 계열 옷에는 남색, 그 외에는 다홍 포인트 */
export function accentFor(c: string): string {
  const n = parseInt(c.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return r > g + 35 && r > b + 25 ? '#4b5a85' : '#cf5a64'
}

const DARK_SHOE = '#4a3a3c'
const BROWN_SHOE = '#8a5d48'

function topPath(k: number, b: number, h: number): Path2D {
  const p = new Path2D()
  const s = 12.8 * k
  const w = h * k
  p.moveTo(-s + 2.2, 61)
  p.quadraticCurveTo(-s, 61.5, -s, 66)
  p.lineTo(-w, b - 4)
  p.quadraticCurveTo(-w, b, -w + 4.5, b)
  p.lineTo(w - 4.5, b)
  p.quadraticCurveTo(w, b, w, b - 4)
  p.lineTo(s, 66)
  p.quadraticCurveTo(s, 61.5, s - 2.2, 61)
  p.closePath()
  return p
}
function skirtPath(k: number, y0: number, w0: number, y1: number, w1: number, sway: number): Path2D {
  const p = new Path2D()
  const a = w0 * k
  const b = w1 * k
  const m = y0 + (y1 - y0) * 0.4
  p.moveTo(-a, y0)
  p.bezierCurveTo(-a - 1, m, -b + sway, y1 - 9, -b + sway, y1 - 3.5)
  p.quadraticCurveTo(-b + sway, y1, -b + 4.5 + sway, y1)
  p.lineTo(b - 4.5 + sway, y1)
  p.quadraticCurveTo(b + sway, y1, b + sway, y1 - 3.5)
  p.bezierCurveTo(b + sway, y1 - 9, a + 1, m, a, y0)
  p.closePath()
  return p
}

/** 몸통(+치마)을 그리고, 상의 경로(머리 그림자 클립용)를 돌려준다 */
export function drawTorso(ctx: C, view: View, frame: Frame, def: OutfitDef, p: OutfitPal): Path2D {
  const k = view === 'side' ? 0.88 : 1
  const ks = view === 'side' ? 0.92 : 1
  // 긴 치마는 다리가 가려지므로 치맛단을 더 크게 흔들어 걸음을 보여 준다
  const amp = def.lower === 'long' || def.lower === 'chima' ? 2.8 : 1.8
  const sway = frame === 0 ? 0 : frame === 1 ? amp : -amp
  let top: Path2D
  let skirt: Path2D | null = null
  switch (def.lower) {
    case 'pants':
      top = topPath(k, 90, 14.6)
      break
    case 'dress':
      skirt = skirtPath(ks, 74, 12, 93.5, 19.5, sway)
      top = topPath(k, 78, 12.8)
      break
    case 'skirt':
      skirt = skirtPath(ks, 77, 13, 93.5, 19, sway)
      top = topPath(k, 80.5, 13.6)
      break
    case 'long':
      skirt = skirtPath(ks, 74, 12, 101.5, 21.5, sway)
      top = topPath(k, 78, 12.8)
      break
    default:
      skirt = skirtPath(ks, 69, 13, 102, 23.5, sway)
      top = topPath(k, 75.5, 13.6)
  }
  const face: Face = view === 'back' ? 'back' : 'front'
  const place = (fn: () => void) => (view === 'side' ? quarter(ctx, fn) : fn())
  const clipped = (path: Path2D, fn: () => void) => {
    ctx.save()
    ctx.clip(path)
    place(fn)
    ctx.restore()
  }
  if (skirt) {
    shape(ctx, skirt, p.bottom, [-14, 70, 16, 104])
    if (def.skirtDetail) clipped(skirt, () => def.skirtDetail?.(ctx, face, p, sway))
  }
  shape(ctx, top, p.top, [-12, 60, 13, 92])
  if (def.detail) clipped(top, () => def.detail?.(ctx, face, p))
  if (def.trim) place(() => def.trim?.(ctx, face, p))
  return top
}

function buttons(ctx: C, x: number, ys: number[], col: string, r = 1.4): void {
  for (const y of ys) flat(ctx, circle(x, y, r), col)
}
/** 치마 주름: 허리에서 단으로 퍼지는 선 */
function pleats(ctx: C, xs: number[], y0: number, y1: number, col: string, sway: number, spread = 1.9, a = 0.36): void {
  for (const x of xs) bez(ctx, [x, y0, x * 1.25, y0 + (y1 - y0) * 0.4, x * spread + sway * 0.5, y1 - 8, x * spread + sway, y1], col, 1.2, a)
}

export interface SuitOpts {
  bow?: boolean
  /** 라펠 색 (턱시도의 새틴 라펠) */
  lapel?: string
  /** 셔츠 앞 주름(턱시도) */
  pleated?: boolean
}
/** 셔츠 깃 + 넥타이 + 라펠이 보이는 V존 (정장·턱시도 공용) */
export function suitFront(ctx: C, face: Face, p: OutfitPal, o: SuitOpts = {}): void {
  const dk = darken(p.top, 0.45)
  /** V존 윗변 반폭 (턱시도는 셔츠가 더 넓게 보인다) */
  const V = o.pleated ? 9.4 : 7.6
  /** 어두운 옷감 위에서는 밝은 선이어야 보인다 */
  const ln = luma(p.top) < 0.3 ? lighten(p.top, 0.34) : dk
  if (face === 'back') {
    // 목 뒤로 살짝 보이는 셔츠 깃 + 등솔기 + 뒤트임
    line(ctx, [-9.6, 63.2, 0, 68.4, 9.6, 63.2], CREAM, 2.6)
    line(ctx, [0, 69, 0, 91], ln, 1.2, 0.5)
    // 어깨 솔기
    line(ctx, [-13.4, 66, -9.4, 64.6], ln, 1, 0.4)
    line(ctx, [13.4, 66, 9.4, 64.6], ln, 1, 0.4)
    return
  }
  flat(ctx, poly([-V, 59, V, 59, 0, 81.6]), CREAM)
  if (o.pleated) {
    line(ctx, [-2.2, 66, -1, 78], darken(CREAM, 0.22), 0.9, 0.7)
    line(ctx, [2.2, 66, 1, 78], darken(CREAM, 0.22), 0.9, 0.7)
    buttons(ctx, 0, [73, 77], darken(CREAM, 0.4), 0.9)
  }
  if (!o.bow) {
    flat(ctx, poly([-2.7, 64.4, 2.7, 64.4, 1.7, 67.6, 3.4, 75.4, 0, 79, -3.4, 75.4, -1.7, 67.6]), p.accent)
    line(ctx, [-1.9, 67.7, 1.9, 67.7], darken(p.accent, 0.4), 1, 0.7)
  }
  const lc = o.lapel ?? darken(p.top, 0.14)
  for (const s of [-1, 1]) {
    // 노치 라펠: 깃 → 어깨 → 노치 → 여밈
    const lapel = poly([s * V, 59, s * 14.6, 59, s * 14, 66.4, s * (V + 2.2), 66.8, s * (V + 3.4), 70.4, s * 0.3, 83, 0, 81.6])
    flat(ctx, lapel, lc)
    outline(ctx, lapel, ln, 1.2, 0.85)
    if (o.lapel) line(ctx, [s * 9.6, 61, s * 5.4, 72.4], lighten(o.lapel, 0.35), 1.1, 0.5)
  }
  line(ctx, [0, 83, 0, 92], ln, 1.2, 0.6)
  buttons(ctx, 0, [85.4, 88.8], ln, 1.5)
}

function goreum(ctx: C, face: Face, col: string): void {
  if (face === 'back') return
  const x = -2.4
  const dk = darken(col, 0.38)
  // 긴 고름 두 가닥 (짧은 것 위에 긴 것)
  for (const [ex, ey, w] of [[2.6, 88, 3.4], [-5.4, 95, 3.8]]) {
    line(ctx, [x, 72.5, ex, ey], dk, w + 1.6)
    line(ctx, [x, 72.5, ex, ey], col, w)
  }
  shape(ctx, [ellipse(x - 4, 71.8, 4, 2.4, -0.3), circle(x, 72.6, 2.6)], col, [x - 7, 69, x + 3, 76], { rim: 1.1 })
}
/** 동정(흰 깃). 왼쪽 깃이 오른쪽 위로 겹치는 y 자 */
function git(ctx: C, face: Face, edge: string): void {
  if (face === 'back') {
    line(ctx, [-9.8, 63, 0, 68.6, 9.8, 63], edge, 4.4)
    line(ctx, [-9.8, 63, 0, 68.6, 9.8, 63], CREAM, 3)
    return
  }
  for (const pts of [[7.4, 59.4, -2.6, 73], [-7.4, 59.4, 1.4, 71]]) {
    line(ctx, pts, edge, 4.6)
    line(ctx, pts, CREAM, 3.2)
  }
}

export const OUTFITS: OutfitDef[] = [
  {
    label: '정장',
    lower: 'pants',
    sleeve: 'long',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: darken(c, 0.14), shoe: DARK_SHOE }),
    detail: (ctx, f, p) => suitFront(ctx, f, p),
  },
  {
    label: '셔츠',
    lower: 'pants',
    sleeve: 'long',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: luma(c) < 0.5 ? '#cdbfa8' : '#5e6377', shoe: BROWN_SHOE }),
    detail(ctx, f, p) {
      const lt = lighten(p.top, 0.5)
      const dk = darken(p.top, 0.38)
      if (f === 'front') {
        for (const s of [-1, 1]) {
          const wing = poly([s * 7.4, 59, 0, 66.4, s * 4.6, 72])
          flat(ctx, wing, lt)
          outline(ctx, wing, dk, 1, 0.6)
        }
        line(ctx, [0, 67, 0, 86], dk, 1.2, 0.6)
        buttons(ctx, 0, [71.6, 77, 82.4], lt, 1.4)
      } else {
        line(ctx, [-9.6, 63.2, 0, 68.4, 9.6, 63.2], lt, 2.8)
        // 등 요크선
        line(ctx, [-30, 71, 0, 73.4, 30, 71], dk, 1.1, 0.42)
      }
      // 벨트 (바지에 넣어 입은 셔츠)
      line(ctx, [-30, 88.6, 30, 88.6], p.shoe, 3.4, 0.95)
      if (f === 'front') flat(ctx, poly([-2, 86.9, 2, 86.9, 2, 90.3, -2, 90.3]), '#e9cf86')
    },
  },
  {
    label: '가디건',
    lower: 'pants',
    sleeve: 'long',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: luma(c) < 0.5 ? '#b9ab97' : '#77695f', shoe: BROWN_SHOE }),
    detail(ctx, f, p) {
      const dk = darken(p.top, 0.38)
      const lt = lighten(p.top, 0.6)
      if (f === 'front') {
        const inner = poly([-6.6, 59, 6.6, 59, 3.4, 77, 3.4, 92, -3.4, 92, -3.4, 77])
        flat(ctx, inner, CREAM)
        outline(ctx, inner, dk, 1.2, 0.75)
        buttons(ctx, 6.8, [79, 84.6], lt, 1.5)
        // 주머니
        line(ctx, [-12.4, 82.4, -6.6, 82.4], dk, 1.1, 0.5)
        line(ctx, [8.6, 86.6, 12.4, 86.6], dk, 1.1, 0.3)
      } else {
        line(ctx, [-9.6, 63.2, 0, 68.4, 9.6, 63.2], CREAM, 2.4)
        line(ctx, [0, 69, 0, 88], dk, 1, 0.3)
      }
      // 밑단 고무단
      line(ctx, [-30, 88, 30, 88], dk, 1, 0.34)
    },
  },
  {
    label: '원피스',
    lower: 'dress',
    sleeve: 'short',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: null, shoe: darken(c, 0.3) }),
    detail(ctx, _f, p) {
      line(ctx, [-30, 76.6, 30, 76.6], darken(p.top, 0.38), 2.4, 0.85)
    },
    skirtDetail(ctx, _f, p, sway) {
      pleats(ctx, [-5, 5], 79, 92, darken(p.bottom, 0.34), sway, 1.7, 0.3)
      line(ctx, [-30 + sway, 90.4, 30 + sway, 90.4], lighten(p.bottom, 0.6), 1.6, 0.9)
    },
    trim(ctx, f) {
      if (f === 'front') {
        shape(ctx, [ellipse(-4.8, 65.6, 5.2, 3.1, 0.4), ellipse(4.8, 65.6, 5.2, 3.1, -0.4)], CREAM, [-9, 63, 9, 69], { rim: 1 })
      } else {
        shape(ctx, ellipse(0, 65.4, 9.6, 2.8), CREAM, [-9, 63, 9, 68], { rim: 1 })
      }
    },
  },
  {
    label: '롱드레스',
    lower: 'long',
    sleeve: 'none',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: null, shoe: lighten(c, 0.3) }),
    detail(ctx, f, p) {
      if (f === 'front') {
        // 하트 네크라인
        line(ctx, [-9, 62.4, -4.5, 66.4, 0, 63.6], lighten(p.top, 0.5), 1.4, 0.8)
        line(ctx, [9, 62.4, 4.5, 66.4, 0, 63.6], lighten(p.top, 0.5), 1.4, 0.8)
      }
      line(ctx, [-30, 76.4, 30, 76.4], lighten(p.top, 0.6), 2.8, 0.95)
    },
    skirtDetail(ctx, _f, p, sway) {
      pleats(ctx, [-5.4, 0.4, 5.6], 80, 100, darken(p.bottom, 0.34), sway, 1.8)
      line(ctx, [-30 + sway, 97.4, 30 + sway, 97.4], lighten(p.bottom, 0.6), 1.5, 0.8)
    },
    trim(ctx, f, p) {
      const c = lighten(p.top, 0.6)
      const x = f === 'back' ? 0 : 8.4
      shape(ctx, [ellipse(x - 3, 76.4, 3.4, 2.3, 0.3), ellipse(x + 3, 76.4, 3.4, 2.3, -0.3)], c, [x - 5, 74, x + 5, 79], { rim: 1 })
      if (f === 'back') {
        line(ctx, [-0.6, 77, -2.4, 86], c, 1.8)
        line(ctx, [0.6, 77, 2.4, 86], c, 1.8)
      }
    },
  },
  {
    label: '블라우스',
    lower: 'skirt',
    sleeve: 'long',
    pal: (c) => ({ top: CREAM, bottom: c, sleeve: CREAM, leg: null, shoe: darken(c, 0.3) }),
    cuff: (p) => p.bottom,
    detail(ctx, f) {
      const dk = darken(CREAM, 0.3)
      if (f === 'front') line(ctx, [0, 70, 0, 80], dk, 1, 0.5)
      else line(ctx, [-9.6, 63.2, 0, 68.4, 9.6, 63.2], dk, 1.3, 0.6)
    },
    skirtDetail(ctx, _f, p, sway) {
      line(ctx, [-30, 80.4, 30, 80.4], darken(p.bottom, 0.3), 2, 0.6)
      pleats(ctx, [-8, -2.8, 2.8, 8], 81, 93, darken(p.bottom, 0.36), sway, 1.5, 0.42)
    },
    trim(ctx, f, p) {
      if (f === 'back') return
      const c = p.bottom
      shape(ctx, [poly([0, 67.5, -6, 64.2, -6, 70.8]), poly([0, 67.5, 6, 64.2, 6, 70.8])], c, [-5, 64, 5, 71], { rim: 1.1 })
      line(ctx, [0, 68, -2, 75.4], c, 2.2)
      line(ctx, [0, 68, 2, 75.4], c, 2.2)
    },
  },
  {
    label: '한복',
    lower: 'chima',
    sleeve: 'long',
    sleeveW: 11.4,
    pal: (c) => ({ top: lighten(c, 0.74), bottom: c, sleeve: lighten(c, 0.74), leg: null, shoe: CREAM }),
    cuff: (p) => p.accent,
    skirtDetail(ctx, _f, p, sway) {
      pleats(ctx, [-9, -4.6, 0, 4.6, 9], 76, 100.6, darken(p.bottom, 0.36), sway, 1.9, 0.34)
      // 금박 단
      line(ctx, [-34 + sway, 97.2, 34 + sway, 97.2], '#f2dc9a', 2, 0.9)
    },
    trim(ctx, f, p) {
      git(ctx, f, darken(p.top, 0.34))
      goreum(ctx, f, p.accent)
    },
  },
  {
    label: '남자 한복',
    lower: 'pants',
    sleeve: 'long',
    sleeveW: 11.4,
    wideLegs: true,
    pal: (c) => ({ top: lighten(c, 0.62), bottom: c, sleeve: lighten(c, 0.62), leg: '#ece4d6', shoe: DARK_SHOE }),
    cuff: (p) => lighten(p.base, 0.2),
    detail(ctx, f, p) {
      // 배자(조끼): 원색, 앞이 벌어져 저고리가 보인다
      const c = p.base
      const dk = darken(c, 0.42)
      if (f === 'front') {
        for (const s of [-1, 1]) {
          const q = poly([s * 30, 56, s * 6.4, 56, s * 2.2, 75, s * 2.2, 94, s * 30, 94])
          flat(ctx, q, c)
          line(ctx, [s * 6.4, 58, s * 2.2, 75, s * 2.2, 92], dk, 1.3, 0.8)
          line(ctx, [s * 8.6, 58, s * 4.6, 75, s * 4.6, 92], lighten(c, 0.45), 1, 0.55)
        }
      } else {
        flat(ctx, poly([-30, 56, 30, 56, 30, 94, -30, 94]), c)
        line(ctx, [0, 66, 0, 91], dk, 1.1, 0.34)
      }
    },
    trim(ctx, f, p) {
      git(ctx, f, darken(p.base, 0.3))
      if (f === 'back') return
      // 매듭 단추 + 술
      line(ctx, [0, 77.4, -0.8, 86], p.accent, 2)
      shape(ctx, circle(0, 77, 2.6), p.accent, [-2, 74, 2, 80], { rim: 1 })
    },
  },
  {
    label: '투피스',
    lower: 'skirt',
    sleeve: 'long',
    pal: (c) => ({ top: c, bottom: darken(c, 0.07), sleeve: c, leg: null, shoe: darken(c, 0.35) }),
    cuff: (p) => lighten(p.base, 0.62),
    detail(ctx, f, p) {
      const lt = lighten(p.top, 0.62)
      if (f === 'front') {
        // 트위드 재킷: 깃 없는 라운드넥 + 앞단 파이핑
        line(ctx, [-6.6, 60.4, 0, 65.6, 6.6, 60.4], lt, 1.8, 0.95)
        line(ctx, [0, 65.6, 0, 82], lt, 1.8, 0.95)
        buttons(ctx, 3.6, [69.4, 75.4], '#f2dc9a', 1.6)
        buttons(ctx, -3.6, [69.4, 75.4], '#f2dc9a', 1.6)
      } else {
        line(ctx, [-9.6, 63.2, 0, 68.4, 9.6, 63.2], lt, 1.9, 0.95)
      }
      line(ctx, [-30, 79.2, 30, 79.2], lt, 1.8, 0.9)
    },
    skirtDetail(ctx, _f, p, sway) {
      line(ctx, [-30 + sway, 91.4, 30 + sway, 91.4], lighten(p.bottom, 0.62), 1.6, 0.85)
    },
  },
  {
    label: '후드티',
    lower: 'pants',
    sleeve: 'long',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: '#6f87aa', shoe: '#f5efe4' }),
    under(ctx, v, p) {
      if (v === 'front') shape(ctx, ellipse(0, 63.5, 17.5, 7), darken(p.top, 0.1), [-16, 58, 16, 70])
      else if (v === 'side') shape(ctx, ellipse(-4, 64.4, 14, 7, 0.12), darken(p.top, 0.08), [-16, 58, 8, 72])
    },
    detail(ctx, f, p) {
      const dk = darken(p.top, 0.38)
      if (f === 'front') {
        outline(ctx, poly([-7.4, 79, 7.4, 79, 10, 87.6, -10, 87.6]), dk, 1.3, 0.75)
        line(ctx, [-3, 61, -3.6, 73], CREAM, 1.7)
        line(ctx, [3, 61, 3.6, 73], CREAM, 1.7)
        flat(ctx, circle(-3.6, 73.4, 1.3), CREAM)
        flat(ctx, circle(3.6, 73.4, 1.3), CREAM)
      }
      line(ctx, [-30, 87.8, 30, 87.8], dk, 1, f === 'front' ? 0 : 0.34)
    },
    trim(ctx, f, p) {
      if (f === 'back') {
        shape(ctx, ellipse(0, 68.5, 12.5, 7), darken(p.top, 0.04), [-12, 62, 12, 76], { rim: 1.2 })
        line(ctx, [-6, 66.4, 0, 70.4, 6, 66.4], darken(p.top, 0.36), 1.1, 0.5)
      }
    },
  },
]

export function paletteFor(def: OutfitDef, c: string): OutfitPal {
  const q = def.pal(c)
  return { ...q, accent: q.accent ?? accentFor(c), base: c }
}
