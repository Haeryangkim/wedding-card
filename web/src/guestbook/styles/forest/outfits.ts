/** 의상: 실루엣(하의 종류·소매)은 데이터, 무늬/디테일은 작은 그리기 함수. */
import type { Frame, View } from './dims'
import type { Sleeve } from './body'
import { circle, darken, ellipse, flat, lighten, line, luma, shape, type C } from './draw'
import { CREAM } from './palette'

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
  /** 몸통 위 디테일 (몸통 모양으로 클립된 상태) */
  detail?(ctx: C, view: View, p: OutfitPal): void
  /** 클립 없이 몸통 위에 얹는 것 (고름·리본 등) */
  trim?(ctx: C, view: View, p: OutfitPal): void
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
  const k = view === 'side' ? 0.74 : 1
  const sway = frame === 0 ? 0 : frame === 1 ? 1.5 : -1.5
  let top: Path2D
  let skirt: Path2D | null = null
  switch (def.lower) {
    case 'pants':
      top = topPath(k, 90, 14.6)
      break
    case 'dress':
      skirt = skirtPath(k, 74, 12, 93.5, 19.5, sway)
      top = topPath(k, 78, 12.8)
      break
    case 'skirt':
      skirt = skirtPath(k, 77, 13, 93.5, 19, sway)
      top = topPath(k, 80.5, 13.6)
      break
    case 'long':
      skirt = skirtPath(k, 74, 12, 101.5, 21, sway)
      top = topPath(k, 78, 12.8)
      break
    default:
      skirt = skirtPath(k, 69, 13, 102, 23.5, sway)
      top = topPath(k, 75.5, 13.6)
  }
  if (skirt) {
    shape(ctx, skirt, p.bottom, [-14, 70, 16, 104])
    if (def.lower === 'chima' || def.lower === 'long') {
      // 굵은 주름 두 줄
      const dk = darken(p.bottom, 0.3)
      for (const s of view === 'side' ? [0.3] : [-1, 1]) {
        line(ctx, [s * 5 * k, 80, s * 7.5 * k + sway * 0.5, 91, s * 9 * k + sway, 99.5], dk, 1.1, 0.35)
      }
    }
  }
  shape(ctx, top, p.top, [-12, 60, 13, 92])
  if (def.detail) {
    ctx.save()
    ctx.clip(top)
    def.detail(ctx, view, p)
    ctx.restore()
  }
  def.trim?.(ctx, view, p)
  return top
}

function poly(pts: number[]): Path2D {
  const p = new Path2D()
  p.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1])
  p.closePath()
  return p
}
function buttons(ctx: C, x: number, ys: number[], col: string, r = 1.2): void {
  for (const y of ys) flat(ctx, circle(x, y, r), col)
}

/** 셔츠 깃 + 넥타이가 보이는 V존 (정장·턱시도 공용) */
export function suitFront(ctx: C, view: View, p: OutfitPal, bow = false): void {
  const dk = darken(p.top, 0.4)
  if (view === 'front') {
    flat(ctx, poly([-6, 60, 6, 60, 0, 78]), CREAM)
    if (!bow) flat(ctx, poly([-1.9, 65.5, 1.9, 65.5, 2.7, 74.5, 0, 77, -2.7, 74.5]), p.accent)
    line(ctx, [-6, 61, 0, 78], dk, 1.2, 0.8)
    line(ctx, [6, 61, 0, 78], dk, 1.2, 0.8)
    line(ctx, [0, 78, 0, 90], dk, 1, 0.5)
    buttons(ctx, 0, [82, 86.5], dk)
  } else if (view === 'side') {
    flat(ctx, poly([4.5, 60, 11, 60, 11, 77]), CREAM)
    if (!bow) flat(ctx, poly([8, 65, 11, 65, 11, 76]), p.accent)
    line(ctx, [4.5, 61, 9.4, 78], dk, 1.1, 0.7)
  } else {
    line(ctx, [0, 81, 0, 90], dk, 1, 0.45)
  }
}

function goreum(ctx: C, view: View, col: string): void {
  if (view === 'back') return
  const x = view === 'side' ? 7.5 : -2.2
  const dk = darken(col, 0.35)
  for (const [ex, ey] of view === 'side' ? [[9.5, 88], [6.5, 84]] : [[-4.6, 91], [2.2, 86.5]]) {
    line(ctx, [x, 72.5, ex, ey], dk, 4)
    line(ctx, [x, 72.5, ex, ey], col, 2.8)
  }
  shape(ctx, [ellipse(x - 3.4, 72, 3.4, 2, -0.3), circle(x, 72.6, 2.2)], col, [x - 6, 70, x + 3, 75], { rim: 1 })
}
function git(ctx: C, view: View): void {
  // 동정(흰 깃). 왼쪽 깃이 오른쪽 위로 겹치는 y 자
  if (view === 'front') {
    line(ctx, [-6.4, 60, 1.2, 70.5], CREAM, 2.6)
    line(ctx, [6.6, 60, -2.2, 72.5], CREAM, 2.6)
  } else if (view === 'side') {
    line(ctx, [4, 60, 9.8, 71], CREAM, 2.4)
  }
}

export const OUTFITS: OutfitDef[] = [
  {
    label: '정장',
    lower: 'pants',
    sleeve: 'long',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: darken(c, 0.14), shoe: DARK_SHOE }),
    detail: (ctx, v, p) => suitFront(ctx, v, p),
  },
  {
    label: '셔츠',
    lower: 'pants',
    sleeve: 'long',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: luma(c) < 0.5 ? '#cdbfa8' : '#5e6377', shoe: BROWN_SHOE }),
    detail(ctx, v, p) {
      const lt = lighten(p.top, 0.45)
      const dk = darken(p.top, 0.35)
      if (v === 'front') {
        flat(ctx, poly([-6.5, 60, 0, 66.5, -3.6, 70.5]), lt)
        flat(ctx, poly([6.5, 60, 0, 66.5, 3.6, 70.5]), lt)
        line(ctx, [0, 67, 0, 90], dk, 1, 0.55)
        buttons(ctx, 0, [72, 78, 84], lt, 1.15)
      } else if (v === 'side') {
        flat(ctx, poly([4, 60, 11, 60, 8, 70]), lt)
      }
      // 허리선(바지에 넣어 입은 셔츠)
      line(ctx, [-16, 86.5, 16, 86.5], dk, 1, 0.35)
    },
  },
  {
    label: '가디건',
    lower: 'pants',
    sleeve: 'long',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: luma(c) < 0.5 ? '#b9ab97' : '#77695f', shoe: BROWN_SHOE }),
    detail(ctx, v, p) {
      const dk = darken(p.top, 0.35)
      if (v === 'front') {
        flat(ctx, poly([-6, 60, 6, 60, 3.6, 91, -3.6, 91]), CREAM)
        line(ctx, [-6, 60, -3.6, 91], dk, 1.1, 0.7)
        line(ctx, [6, 60, 3.6, 91], dk, 1.1, 0.7)
        buttons(ctx, 6.4, [74, 80, 86], lighten(p.top, 0.6), 1.2)
      } else if (v === 'side') {
        flat(ctx, poly([6.5, 60, 12, 60, 12, 91, 8, 91]), CREAM)
        line(ctx, [6.5, 60, 8, 91], dk, 1.1, 0.7)
      }
    },
  },
  {
    label: '원피스',
    lower: 'dress',
    sleeve: 'short',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: null, shoe: darken(c, 0.3) }),
    detail(ctx, _v, p) {
      line(ctx, [-14, 76.6, 14, 76.6], darken(p.top, 0.35), 2.2, 0.8)
    },
    trim(ctx, v) {
      if (v === 'front') {
        shape(ctx, [ellipse(-4.6, 66, 4.8, 2.9, 0.4), ellipse(4.6, 66, 4.8, 2.9, -0.4)], CREAM, [-9, 63, 9, 69], { rim: 0.9 })
      } else if (v === 'side') {
        shape(ctx, ellipse(5.5, 66, 4.4, 2.8, -0.4), CREAM, [1, 63, 10, 69], { rim: 0.9 })
      }
    },
  },
  {
    label: '롱드레스',
    lower: 'long',
    sleeve: 'none',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: null, shoe: lighten(c, 0.3) }),
    detail(ctx, _v, p) {
      line(ctx, [-14, 76.4, 14, 76.4], lighten(p.top, 0.55), 2.4, 0.9)
    },
    trim(ctx, v, p) {
      if (v === 'back') return
      const x = v === 'side' ? 7 : 8.5
      const c = lighten(p.top, 0.55)
      shape(ctx, [ellipse(x - 2.6, 76.4, 3, 2, 0.3), ellipse(x + 2.6, 76.4, 3, 2, -0.3)], c, [x - 5, 74, x + 5, 79], { rim: 0.9 })
    },
  },
  {
    label: '블라우스',
    lower: 'skirt',
    sleeve: 'long',
    pal: (c) => ({ top: CREAM, bottom: c, sleeve: CREAM, leg: null, shoe: darken(c, 0.3) }),
    trim(ctx, v, p) {
      if (v === 'back') return
      const x = v === 'side' ? 8 : 0
      const c = p.bottom
      shape(ctx, [poly([x, 67.5, x - 5, 64.8, x - 5, 70.2]), poly([x, 67.5, x + 5, 64.8, x + 5, 70.2])], c, [x - 5, 64, x + 5, 71], { rim: 1 })
      line(ctx, [x, 68, x - 1.6, 74], c, 1.8)
      line(ctx, [x, 68, x + 1.6, 74], c, 1.8)
    },
  },
  {
    label: '한복',
    lower: 'chima',
    sleeve: 'long',
    sleeveW: 10.6,
    pal: (c) => ({ top: lighten(c, 0.74), bottom: c, sleeve: lighten(c, 0.74), leg: null, shoe: CREAM }),
    cuff: (p) => p.accent,
    trim(ctx, v, p) {
      git(ctx, v)
      goreum(ctx, v, p.accent)
    },
  },
  {
    label: '남자 한복',
    lower: 'pants',
    sleeve: 'long',
    sleeveW: 10.6,
    wideLegs: true,
    pal: (c) => ({ top: lighten(c, 0.62), bottom: c, sleeve: lighten(c, 0.62), leg: '#ece4d6', shoe: DARK_SHOE }),
    detail(ctx, v, p) {
      // 배자(조끼): 원색
      const c = p.base
      const dk = darken(c, 0.4)
      if (v === 'front') {
        for (const s of [-1, 1]) {
          const q = poly([s * 16, 58, s * 5.5, 58, s * 1.6, 75, s * 1.6, 92, s * 16, 92])
          flat(ctx, q, c)
          line(ctx, [s * 5.5, 58, s * 1.6, 75, s * 1.6, 92], dk, 1, 0.7)
        }
      } else if (v === 'side') {
        flat(ctx, poly([-12, 58, 4, 58, 7.5, 75, 7.5, 92, -12, 92]), c)
        line(ctx, [4, 58, 7.5, 75, 7.5, 92], dk, 1, 0.7)
      } else {
        flat(ctx, poly([-16, 58, 16, 58, 16, 92, -16, 92]), c)
      }
    },
    trim(ctx, v, p) {
      git(ctx, v)
      if (v !== 'back') {
        const x = v === 'side' ? 8.6 : 0
        shape(ctx, circle(x, 76.5, 2), p.accent, [x - 2, 74, x + 2, 79], { rim: 0.9 })
        line(ctx, [x, 77, x - 0.6, 84], p.accent, 1.6)
      }
    },
  },
  {
    label: '투피스',
    lower: 'skirt',
    sleeve: 'long',
    pal: (c) => ({ top: c, bottom: darken(c, 0.07), sleeve: c, leg: null, shoe: darken(c, 0.35) }),
    detail(ctx, v, p) {
      const lt = lighten(p.top, 0.6)
      if (v === 'front') {
        line(ctx, [0, 62, 0, 82], lt, 1.6, 0.9)
        buttons(ctx, 3.4, [69, 74.5], lt, 1.3)
        buttons(ctx, -3.4, [69, 74.5], lt, 1.3)
      } else if (v === 'side') {
        line(ctx, [8, 62, 8.6, 82], lt, 1.6, 0.9)
      }
      line(ctx, [-16, 79.4, 16, 79.4], lt, 1.4, 0.8)
    },
  },
  {
    label: '후드티',
    lower: 'pants',
    sleeve: 'long',
    pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: '#6f87aa', shoe: '#f5efe4' }),
    under(ctx, v, p) {
      if (v === 'front') shape(ctx, ellipse(0, 63.5, 17.5, 7), darken(p.top, 0.1), [-16, 58, 16, 70])
      else if (v === 'side') shape(ctx, ellipse(-9, 65, 8, 7, 0.3), darken(p.top, 0.06), [-16, 58, 0, 72])
    },
    detail(ctx, v, p) {
      const dk = darken(p.top, 0.35)
      if (v === 'front') {
        const q = poly([-7, 79.5, 7, 79.5, 9.5, 87.5, -9.5, 87.5])
        ctx.strokeStyle = dk
        ctx.lineWidth = 1.1
        ctx.lineJoin = 'round'
        ctx.globalAlpha = 0.7
        ctx.stroke(q)
        ctx.globalAlpha = 1
        line(ctx, [-3, 62, -3.4, 72.5], CREAM, 1.4)
        line(ctx, [3, 62, 3.4, 72.5], CREAM, 1.4)
      } else if (v === 'side') {
        line(ctx, [8, 62, 8.6, 72], CREAM, 1.4)
      }
    },
    trim(ctx, v, p) {
      if (v === 'back') shape(ctx, ellipse(0, 68.5, 12.5, 7), darken(p.top, 0.04), [-12, 62, 12, 76], { rim: 1.2 })
    },
  },
]

export function paletteFor(def: OutfitDef, c: string): OutfitPal {
  const q = def.pal(c)
  return { ...q, accent: q.accent ?? accentFor(c), base: c }
}
