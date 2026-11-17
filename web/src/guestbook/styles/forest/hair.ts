/**
 * 머리 모양. 스타일마다 수치(볼륨·길이·앞머리 종류·부가 요소)만 다르고 공통 생성기가 3방향을 만든다.
 * under = 몸/머리 뒤에 깔리는 층, over = 머리 위에 덮는 층.
 */
import type { View } from './dims'
import { bez, circle, darken, ellipse, lighten, line, luma, mix, shape, type Box, type C } from './draw'

type Fringe = 'side' | 'part' | 'bangs' | 'up' | 'buzz' | 'curly'
type Extra = 'pony' | 'bun' | 'twin' | 'quiff'

interface HairSpec {
  label: string
  /** 정수리 볼륨 */
  vol: number
  /** 옆 볼륨 */
  wide: number
  fringe: Fringe
  /** 뒷머리 끝 y (60 = 짧음, 66 = 단발, 86 = 김) */
  len: number
  /** 정면에서 얼굴 옆으로 내려오는 옆머리 끝 y (0 = 없음) */
  locks?: number
  wavy?: boolean
  extra?: Extra
}

export const HAIRS: HairSpec[] = [
  { label: '숏컷', vol: 3, wide: 1, fringe: 'side', len: 60 },
  { label: '가르마', vol: 4, wide: 1.6, fringe: 'part', len: 61, locks: 51 },
  { label: '단발', vol: 3, wide: 2.6, fringe: 'bangs', len: 67, locks: 63 },
  { label: '긴 생머리', vol: 3, wide: 2.4, fringe: 'part', len: 87, locks: 62 },
  { label: '긴 웨이브', vol: 4, wide: 3.4, fringe: 'side', len: 84, locks: 60, wavy: true },
  { label: '포니테일', vol: 2.6, wide: 1, fringe: 'side', len: 60, extra: 'pony' },
  { label: '올림머리', vol: 2.2, wide: 0.8, fringe: 'up', len: 60, extra: 'bun' },
  { label: '곱슬 펌', vol: 4, wide: 2.4, fringe: 'curly', len: 61 },
  { label: '반삭', vol: 0, wide: 0, fringe: 'buzz', len: 57 },
  { label: '양갈래', vol: 3, wide: 1.4, fringe: 'bangs', len: 60, extra: 'twin' },
  { label: '포마드', vol: 4.2, wide: 0.6, fringe: 'up', len: 60, extra: 'quiff' },
]

const G: Box = [-22, 8, 22, 70]
const TIE = '#e8707c'

/* ── 정면 ───────────────────────────────────────────── */
function capFront(h: HairSpec): Path2D[] {
  const X = 27.4 + h.wide
  const T = 13.6 - h.vol
  if (h.fringe === 'curly') {
    const ps: Path2D[] = []
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (1.02 + (0.96 * i) / 8)
      ps.push(circle(Math.cos(a) * 23.5, 39 + Math.sin(a) * 21.5, 9.2))
    }
    for (const [x, y, r] of [[-17, 30, 7], [-6, 27.5, 7.4], [6, 27.5, 7.4], [17, 30, 7], [0, 22, 10], [-12, 22, 9], [12, 22, 9]]) {
      ps.push(circle(x, y, r))
    }
    return ps
  }
  const buzz = h.fringe === 'buzz'
  const p = new Path2D()
  const X0 = buzz ? 27.2 : X
  const T0 = buzz ? 14.4 : T
  const y0 = buzz ? 43 : 45
  p.moveTo(-X0, y0)
  p.bezierCurveTo(-X0, 24 - h.vol * 0.4, -17, T0, 0, T0)
  p.bezierCurveTo(17, T0, X0, 24 - h.vol * 0.4, X0, y0)
  switch (h.fringe) {
    case 'side':
      p.quadraticCurveTo(25, 33, 14, 29.5)
      p.quadraticCurveTo(-3, 40.5, -19.5, 38.5)
      p.quadraticCurveTo(-24.5, 40, -X, 45)
      break
    case 'part':
      p.lineTo(24.6, 41)
      p.quadraticCurveTo(21, 37, 5, 24.5)
      p.quadraticCurveTo(-15, 38, -24.6, 41)
      p.lineTo(-X, 45)
      break
    case 'bangs':
      p.lineTo(25, 40.5)
      p.quadraticCurveTo(12, 37.5, 0, 37.5)
      p.quadraticCurveTo(-12, 37.5, -25, 40.5)
      p.lineTo(-X, 45)
      break
    case 'up':
      p.quadraticCurveTo(25.5, 29, 0, 26.5)
      p.quadraticCurveTo(-25.5, 29, -X, 45)
      break
    default:
      p.quadraticCurveTo(24.5, 28, 0, 26)
      p.quadraticCurveTo(-24.5, 28, -X0, y0)
  }
  p.closePath()
  const out = [p]
  if (h.locks) {
    for (const s of [-1, 1]) {
      const l = new Path2D()
      const Y = h.locks
      l.moveTo(s * X, 40)
      l.lineTo(s * X, Y - 5)
      l.quadraticCurveTo(s * X, Y, s * (X - 4.5), Y)
      l.quadraticCurveTo(s * (X - 8.5), Y, s * (X - 8), Y - 7)
      l.lineTo(s * (X - 6.5), 38)
      l.closePath()
      out.push(l)
    }
  }
  return out
}

/** 머리 뒤로 내려오는 덩어리 (정면에서 얼굴/몸 뒤) */
function massFront(h: HairSpec): Path2D[] {
  const X = 27.4 + h.wide
  const L = h.len
  const p = new Path2D()
  p.moveTo(-X, 36)
  const R = L > 70 ? 9 : 13
  p.lineTo(-X - 0.5, L - R)
  p.quadraticCurveTo(-X - 0.5, L, -X + R + 1, L)
  p.lineTo(X - R - 1, L)
  p.quadraticCurveTo(X + 0.5, L, X + 0.5, L - R)
  p.lineTo(X, 36)
  p.closePath()
  const out = [p]
  if (h.wavy) {
    for (const s of [-1, 1]) for (let y = 50; y <= L - 3; y += 8.5) out.push(circle(s * (X - 1.5), y, 5.6))
    for (let x = -X + 6; x <= X - 6; x += 8) out.push(circle(x, L - 2, 5.2))
  }
  return out
}

/* ── 뒷모습 ─────────────────────────────────────────── */
function capBack(h: HairSpec): Path2D[] {
  const X = 27.6 + h.wide
  const T = 13.4 - h.vol
  const L = h.len
  const out: Path2D[] = []
  if (h.fringe === 'curly') {
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14
      out.push(circle(Math.cos(a) * 22, 37 + Math.sin(a) * 20, 9.4))
    }
    out.push(circle(0, 37, 22))
    return out
  }
  const p = new Path2D()
  p.moveTo(-X, 44)
  p.bezierCurveTo(-X, 24 - h.vol * 0.4, -17, T, 0, T)
  p.bezierCurveTo(17, T, X, 24 - h.vol * 0.4, X, 44)
  if (L <= 64) {
    // 목덜미: 가운데가 살짝 뾰족한 꼬리
    p.bezierCurveTo(X, 56, 17, L + 1.5, 7, L + 0.8)
    p.quadraticCurveTo(2.5, L + 0.6, 0, L + 3.6)
    p.quadraticCurveTo(-2.5, L + 0.6, -7, L + 0.8)
    p.bezierCurveTo(-17, L + 1.5, -X, 56, -X, 44)
  } else {
    const R = L > 70 ? 10 : 14
    p.lineTo(X + 0.5, L - R)
    p.quadraticCurveTo(X + 0.5, L, X - R, L)
    p.lineTo(-X + R, L)
    p.quadraticCurveTo(-X - 0.5, L, -X - 0.5, L - R)
  }
  p.closePath()
  out.push(p)
  if (h.wavy) {
    for (const s of [-1, 1]) for (let y = 50; y <= L - 3; y += 8.5) out.push(circle(s * (X - 1.5), y, 5.6))
    for (let x = -X + 6; x <= X - 6; x += 8) out.push(circle(x, L - 2, 5.2))
  }
  return out
}

/* ── 3/4 뷰 (오른쪽을 봄) ─────────────────────────────
 * 얼굴은 x = -6 … 27 에 보이고, 뒤통수 쪽(-x)으로 머리 덩어리가 넘어간다.
 * 짧은 머리는 귀를 드러내는 홈 + 구레나룻, 단발/긴 머리는 귀를 덮고 어깨 앞뒤로 흐른다. */
function capSide(h: HairSpec): Path2D[] {
  const X = 27.6 + h.wide
  const BX = -(X + 1.4)
  const T = 13.4 - h.vol
  const L = h.len
  const out: Path2D[] = []
  if (h.fringe === 'curly') {
    for (let i = 0; i <= 11; i++) {
      const a = Math.PI * (0.7 + (1.12 * i) / 11)
      out.push(circle(-2 + Math.cos(a) * 23.5, 38 + Math.sin(a) * 21.5, 9.2))
    }
    for (const [x, y, r] of [[-9, 30, 17], [-17, 44, 10], [6, 25.5, 9.5], [16, 27.5, 7.6], [23, 32, 5.4], [-10.5, 47.5, 6.4], [-3, 33, 7]]) {
      out.push(circle(x, y, r))
    }
    return out
  }
  const buzz = h.fringe === 'buzz'
  const up = h.fringe === 'up'
  const FX = (buzz ? 25.4 : 26.5) + h.wide * 0.3
  const FY = buzz ? 35 : up ? 37 : 41
  const sx = buzz ? -7.4 : up ? -8.6 : -6.5
  const sy = buzz ? 37 : up ? 40 : 41
  const p = new Path2D()
  p.moveTo(FX, FY)
  p.bezierCurveTo(FX + 0.4, 25 - h.vol * 0.4, 16, T + 0.6, -1, T)
  p.bezierCurveTo(-19, T, BX, 23, BX, 43)
  if (L <= 64) {
    // 뒤통수 → 목덜미 → 귀 뒤 → 귀 위 → 구레나룻
    // 뒤통수 실루엣을 따라 귀 뒤에서 끝난다 (묶거나 올린 머리는 더 위에서)
    const N = h.extra === 'bun' || h.extra === 'pony' ? 53 : buzz ? 54 : 55.6
    p.bezierCurveTo(BX, 50, -27.4, N + 0.2, -22.6, N)
    p.quadraticCurveTo(-19.6, N - 0.6, -19.2, 50)
    p.quadraticCurveTo(-19.2, 43.2, -14.2, 43)
    p.quadraticCurveTo(-10.6, 43.2, -10.3, 47)
    p.quadraticCurveTo(-10.1, 50.6, -8.7, 50)
    p.quadraticCurveTo(-7.2, 48.4, sx, sy)
  } else if (L <= 70) {
    // 단발: 턱선에서 안으로 말린 끝
    p.lineTo(BX, L - 9)
    p.quadraticCurveTo(BX, L, BX + 9, L)
    p.lineTo(-11, L)
    p.quadraticCurveTo(-4.6, L, -5, L - 8)
    p.lineTo(sx, sy)
  } else {
    // 긴 머리: 뒤로는 등까지, 앞으로는 어깨 앞에 한 가닥
    const k = (h.locks ?? 60) + 5
    p.lineTo(BX, L - 8)
    p.quadraticCurveTo(BX, L, BX + 8, L)
    p.lineTo(-19, L)
    p.quadraticCurveTo(-14, L, -14, L - 6)
    p.lineTo(-13.4, k + 9)
    p.quadraticCurveTo(-12.6, k + 0.6, -8.6, k)
    p.quadraticCurveTo(-4.6, k - 0.4, -5, k - 7)
    p.lineTo(sx, sy)
    if (h.wavy) {
      for (let y = 50; y <= L - 3; y += 8.5) out.push(circle(BX + 1.4, y, 5.6))
      for (let x = BX + 5; x <= -18; x += 7) out.push(circle(x, L - 2, 5.2))
      out.push(circle(-7.4, k - 2.5, 4.6), circle(-12.4, k + 6, 4.2))
    }
  }
  switch (h.fringe) {
    case 'side':
      p.quadraticCurveTo(6.5, 41, 19.5, 29.4)
      p.quadraticCurveTo(25.6, 31.6, FX, FY)
      break
    case 'part':
      p.quadraticCurveTo(-3.5, 34.5, 13, 24.6)
      p.quadraticCurveTo(23.4, 31, FX, FY)
      break
    case 'bangs':
      p.quadraticCurveTo(-5.4, 38, 5, 38.2)
      p.quadraticCurveTo(18, 38, FX - 0.8, 40.4)
      break
    case 'up':
      p.quadraticCurveTo(-8.4, 27, 9, 25.6)
      p.quadraticCurveTo(22.6, 26.6, FX, FY)
      break
    default:
      p.quadraticCurveTo(-5, 26.6, 10, 25)
      p.quadraticCurveTo(21.6, 25.6, FX, FY)
  }
  p.closePath()
  out.push(p)
  return out
}
/** 3/4 뷰에서 몸 뒤로 넘어가는 긴 머리 */
function massSide(h: HairSpec): Path2D[] {
  const L = h.len
  const p = new Path2D()
  p.moveTo(-24, 40)
  p.lineTo(-24, L - 8)
  p.quadraticCurveTo(-24, L, -16, L)
  p.lineTo(-2, L)
  p.quadraticCurveTo(5, L, 5, L - 8)
  p.lineTo(5, 50)
  p.closePath()
  return [p]
}

function extras(h: HairSpec, view: View): { under: Path2D[]; over: Path2D[]; ties: [number, number][] } {
  const under: Path2D[] = []
  const over: Path2D[] = []
  const ties: [number, number][] = []
  const path = (f: (p: Path2D) => void) => {
    const p = new Path2D()
    f(p)
    p.closePath()
    return p
  }
  if (h.extra === 'bun') {
    under.push(view === 'side' ? circle(-6, 8.6, 9.8) : circle(0, 8.5, 9.8))
  } else if (h.extra === 'pony') {
    if (view === 'front') {
      under.push(
        path((p) => {
          p.moveTo(14, 18)
          p.bezierCurveTo(30, 4, 43, 22, 37.5, 42)
          p.bezierCurveTo(36, 52, 30, 57, 28.5, 51)
          p.bezierCurveTo(31, 42, 27, 30, 18, 26)
        }),
      )
    } else if (view === 'back') {
      over.push(
        path((p) => {
          p.moveTo(-6, 22)
          p.bezierCurveTo(-14, 40, -12, 66, 1.5, 74)
          p.bezierCurveTo(12, 66, 14, 40, 6, 22)
        }),
      )
      ties.push([0, 23])
    } else {
      under.push(
        path((p) => {
          p.moveTo(-19, 14)
          p.bezierCurveTo(-36, 5, -45, 30, -38, 56)
          p.bezierCurveTo(-36, 64, -30, 62, -31, 55)
          p.bezierCurveTo(-28, 42, -27, 32, -20, 27)
        }),
      )
      ties.push([-24.5, 19.5])
    }
  } else if (h.extra === 'twin') {
    const tail = (s: number) =>
      path((p) => {
        p.moveTo(s * 23, 32)
        p.bezierCurveTo(s * 42.5, 30, s * 43.5, 74, s * 33.5, 74)
        p.bezierCurveTo(s * 25, 74, s * 25, 52, s * 20, 42)
      })
    if (view === 'side') {
      // 먼 쪽 꼬리는 얼굴 뒤로 살짝, 가까운 쪽 꼬리는 귀 뒤에서 앞으로
      under.push(
        path((p) => {
          p.moveTo(20, 30)
          p.bezierCurveTo(37, 30, 38, 68, 30, 70)
          p.bezierCurveTo(24, 70, 24, 54, 20, 44)
        }),
      )
      over.push(
        path((p) => {
          p.moveTo(-15, 35)
          p.bezierCurveTo(-36, 34, -36, 76, -24, 76)
          p.bezierCurveTo(-15, 76, -15, 54, -11.5, 43)
        }),
      )
      ties.push([-15.5, 38.5])
    } else {
      under.push(tail(-1), tail(1))
      ties.push([-27.5, 36], [27.5, 36])
    }
  } else if (h.extra === 'quiff' && view !== 'back') {
    // 앞머리를 세워 넘긴 볼륨
    over.push(view === 'front' ? ellipse(5, 15.5, 15, 7.5, -0.14) : ellipse(10, 15.6, 14, 7.4, 0.12))
  }
  return { under, over, ties }
}

/* ── 결·윤기 (실루엣 위에 얹는 선) ────────────────────── */
/** 가닥 선 색: 어두운 머리에는 밝은 선, 밝은 머리에는 어두운 선 (군중 속 뒷모습이 덩어리로 뭉치지 않게) */
function strand(col: string): string {
  return luma(col) < 0.36 ? lighten(col, 0.42) : darken(col, 0.34)
}
function sheen(ctx: C, pts: number[], col: string): void {
  bez(ctx, pts, lighten(col, 0.5), 4.6, 0.22)
  bez(ctx, pts, lighten(col, 0.62), 2, 0.42)
}
/** 좌우 대칭 가닥 */
function pair(ctx: C, pts: number[], col: string, w = 1.1, a = 0.42): void {
  bez(ctx, pts, col, w, a)
  bez(ctx, pts.map((v, i) => (i % 2 ? v : -v)), col, w, a)
}
function curls(ctx: C, pts: number[][], col: string): void {
  for (const [x, y, r] of pts) {
    ctx.save()
    ctx.globalAlpha *= 0.42
    ctx.strokeStyle = col
    ctx.lineWidth = 1.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(x, y, r, Math.PI * 0.15, Math.PI * 1.25)
    ctx.stroke()
    ctx.restore()
  }
}

function frontDetail(ctx: C, h: HairSpec, col: string): void {
  const dk = strand(col)
  const T = 13.6 - h.vol
  if (h.fringe === 'curly') {
    curls(ctx, [[-13, 23, 4], [0, 20, 4.4], [13, 23, 4], [-21, 33, 3.4], [21, 33, 3.4], [-6, 29, 3], [7, 29, 3]], dk)
    sheen(ctx, [-15, 20, -9, 14.5, 0, 13, 8, 15.5], col)
    return
  }
  if (h.fringe === 'buzz') return
  sheen(ctx, [-18, T + 10.5, -12, T + 4, 0, T + 2.8, 9, T + 4.4], col)
  if (h.fringe === 'bangs') {
    line(ctx, [-9, 30, -8.4, 37.6], dk, 1.1, 0.5)
    line(ctx, [8, 30, 8.6, 37.6], dk, 1.1, 0.5)
    line(ctx, [-0.4, 31.5, 0, 37.4], dk, 1, 0.35)
  } else if (h.fringe === 'side') {
    bez(ctx, [13, 29.5, 4, 32, -6, 37, -15, 37.6], dk, 1.1, 0.42)
    bez(ctx, [12, 25, 2, 26, -10, 30, -19, 34.6], dk, 1, 0.3)
  } else if (h.fringe === 'part') {
    bez(ctx, [5, 24.5, 5.4, 20, 4, 17, 2.6, T + 0.6], dk, 1.2, 0.5)
    bez(ctx, [3, 26, -6, 29, -14, 34, -21, 38.6], dk, 1, 0.32)
    bez(ctx, [7.4, 26, 13, 29, 18, 33, 22.4, 38.4], dk, 1, 0.32)
  } else if (h.extra === 'quiff') {
    bez(ctx, [-8, 15.6, -2, 10.5, 9, 10, 17, 14], dk, 1.1, 0.42)
    bez(ctx, [-12, 24, -4, 20.5, 8, 20.5, 19, 24.5], dk, 1, 0.3)
  } else {
    // 올림머리: 뒤로 빗어 넘긴 결
    pair(ctx, [-6, 26.4, -6.6, 22, -5.6, 18, -4, T + 1.2], dk, 1, 0.34)
    pair(ctx, [-16, 28.6, -15.6, 24, -13, 19, -10, T + 2.4], dk, 1, 0.3)
  }
}

function sideDetail(ctx: C, h: HairSpec, col: string): void {
  const dk = strand(col)
  const T = 13.4 - h.vol
  const L = h.len
  if (h.fringe === 'curly') {
    curls(ctx, [[-16, 23, 4.2], [-3, 19, 4.4], [10, 21.5, 4], [-23, 35, 3.6], [-12, 33, 3.4], [2, 29, 3.2], [16, 29, 3], [-17, 48, 3.4]], dk)
    sheen(ctx, [-17, 19, -10, 13.5, 0, 12.4, 8, 15], col)
    return
  }
  if (h.fringe === 'buzz') return
  sheen(ctx, [-17, T + 10.6, -10, T + 3.8, 3, T + 2.6, 13, T + 5.6], col)
  // 정수리에서 뒤통수로 흐르는 결
  bez(ctx, [-5, T + 6, -17, T + 9, -24, 30, -25.4, 45], dk, 1.1, 0.4)
  bez(ctx, [-2, T + 11, -11, T + 14, -16, 31, -16.4, 41.6], dk, 1, 0.3)
  switch (h.fringe) {
    case 'side':
      bez(ctx, [18, 29.6, 10, 31, 2, 35.6, -4.6, 39.4], dk, 1.1, 0.45)
      bez(ctx, [17, 25, 7, 25.4, -3, 30, -10, 37], dk, 1, 0.3)
      break
    case 'part':
      bez(ctx, [13, 24.6, 13.4, 20, 11, 16.4, 8, T + 0.8], dk, 1.2, 0.5)
      bez(ctx, [11, 26, 4, 28, -2, 32.6, -5.6, 38], dk, 1, 0.34)
      bez(ctx, [15.4, 26, 20, 28.6, 23, 33, 25, 38], dk, 1, 0.3)
      break
    case 'bangs':
      line(ctx, [-1, 30.5, -0.6, 37.8], dk, 1.1, 0.48)
      line(ctx, [9, 31, 9.4, 37.8], dk, 1.1, 0.48)
      line(ctx, [18, 31.5, 18.4, 37.8], dk, 1, 0.4)
      break
    default:
      if (h.extra === 'quiff') {
        bez(ctx, [-3, 16, 3, 10.6, 13, 10.2, 21, 14.6], dk, 1.1, 0.42)
        bez(ctx, [-6, 24.6, 2, 21, 12, 20.6, 21.4, 24], dk, 1, 0.3)
      } else {
        // 뒤로 빗어 넘긴 결
        bez(ctx, [6, 26.4, 3, 21, -2, 17, -8, T + 2.6], dk, 1, 0.36)
        bez(ctx, [16, 26.6, 13, 21, 8, 16.4, 2, T + 1.4], dk, 1, 0.32)
      }
  }
  if (L > 70) {
    const k = (h.locks ?? 60) + 5
    if (h.wavy) {
      bez(ctx, [-22, 46, -26, 56, -18, 66, -22.5, L - 5], dk, 1.1, 0.4)
      bez(ctx, [-9.6, 44, -12, 51, -7.4, 56, -9.4, k - 3], dk, 1, 0.36)
    } else {
      bez(ctx, [-21.6, 47, -22.4, 58, -22, 70, -21, L - 5], dk, 1.1, 0.4)
      bez(ctx, [-9.6, 44, -10.2, 50, -9.8, 57, -9, k - 3], dk, 1, 0.36)
    }
  } else if (L > 64) {
    bez(ctx, [-20, 46, -20.6, 54, -19.4, 60, -16, L - 3], dk, 1.1, 0.4)
    bez(ctx, [-10.4, 44, -10.8, 51, -10, 58, -8.4, L - 3], dk, 1, 0.36)
  }
  if (h.extra === 'pony') {
    bez(ctx, [-25, 22, -36, 26, -37, 44, -34, 56], dk, 1.1, 0.4)
  } else if (h.extra === 'twin') {
    bez(ctx, [-17, 42, -29, 46, -28, 64, -23, 72], dk, 1.1, 0.4)
  } else if (h.extra === 'bun') {
    line(ctx, [-12, 6.4, -6, 1.6, 0, 7], dk, 1.1, 0.42)
    line(ctx, [-9.6, 10.4, -5, 6.6, -1.6, 10.6], dk, 1, 0.34)
  }
}

function backDetail(ctx: C, h: HairSpec, col: string): void {
  const dk = strand(col)
  const T = 13.4 - h.vol
  const L = h.len
  if (h.fringe === 'curly') {
    curls(ctx, [[-13, 22, 4.4], [1, 19, 4.6], [14, 23, 4.2], [-21, 34, 3.8], [-7, 31, 4], [8, 32, 4], [21, 36, 3.6], [-14, 45, 4], [1, 44, 4.2], [15, 47, 3.8], [-5, 55, 3.4], [8, 56, 3.2]], dk)
    sheen(ctx, [-17, 20, -11, 14, -1, 12.6, 7, 15], col)
    return
  }
  if (h.fringe === 'buzz') {
    line(ctx, [-13, 52, 0, 56.6, 13, 52], dk, 1.1, 0.3)
    line(ctx, [-3, 20, 0, 22.4, 3.4, 20.4], dk, 1, 0.3)
    return
  }
  sheen(ctx, [-19, T + 13, -13, T + 5.4, 0, T + 3.4, 10, T + 6.4], col)
  if (h.extra === 'pony') {
    // 묶은 곳으로 모이는 결 + 꼬리 가닥
    pair(ctx, [-25.4, 42, -22, 31, -11, 25.4, -4, 23.6], dk)
    pair(ctx, [-17, 57, -13, 44, -8, 32, -4.4, 26.4], dk, 1, 0.34)
    pair(ctx, [-2.4, 15.4, -2.6, 18, -2.4, 20, -1.6, 21.6], dk, 1, 0.34)
    bez(ctx, [-3, 30, -6.6, 44, -4, 60, 0.6, 70], dk, 1.1, 0.42)
    bez(ctx, [3.4, 29, 6.6, 44, 6, 58, 3, 67], dk, 1, 0.34)
    return
  }
  if (h.extra === 'bun') {
    // 위로 쓸어 올린 결 + 똬리
    pair(ctx, [-25, 40, -21, 26, -11, 18.4, -4.6, T + 3.4], dk)
    pair(ctx, [-14, 57.4, -11, 42, -6.4, 28, -2.4, T + 5], dk, 1, 0.34)
    line(ctx, [-6.4, 6, 0, 0.8, 6.4, 6.6], dk, 1.2, 0.46)
    line(ctx, [-4, 11, 1, 13.4, 5.6, 8.6], dk, 1, 0.38)
    return
  }
  if (h.extra === 'twin') {
    // 가운데 가르마에서 양옆 묶음으로
    bez(ctx, [0, T + 0.6, 0.6, 26, -0.6, 42, 0, 57], dk, 1.3, 0.5)
    pair(ctx, [-2.4, T + 6, -12, T + 9, -21, 25, -25.4, 34], dk)
    pair(ctx, [-2.6, 34, -12, 34.4, -19, 35.4, -25, 37.4], dk, 1, 0.34)
    pair(ctx, [-31, 42, -37.6, 50, -37, 64, -33.4, 71], dk, 1.1, 0.4)
    return
  }
  if (h.fringe === 'part') {
    bez(ctx, [0, T + 0.6, 0.8, 20, -0.4, 26, 0.4, 32], dk, 1.3, 0.5)
    pair(ctx, [-2.4, T + 6, -13, T + 10, -21.4, 28, -23.6, 42], dk)
    pair(ctx, [-2.6, 30, -8, 33, -11.4, 39, -12, 46], dk, 1, 0.32)
  } else if (h.fringe === 'up') {
    // 포마드: 한쪽으로 빗어 넘긴 결
    bez(ctx, [-15, T + 7, -3, T + 3.4, 12, T + 6.4, 20.4, 25], dk, 1.1, 0.42)
    bez(ctx, [-21, 27.4, -8, 22, 9, 25, 22, 36], dk, 1, 0.34)
    bez(ctx, [-23.4, 39, -11, 33, 7, 36, 21.4, 46.4], dk, 1, 0.3)
  } else {
    // 가마(정수리 소용돌이)에서 퍼지는 결
    ctx.save()
    ctx.globalAlpha *= 0.4
    ctx.strokeStyle = dk
    ctx.lineWidth = 1.1
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(2, 25.8, 1.9, Math.PI * 1.0, Math.PI * 2.2)
    ctx.stroke()
    ctx.restore()
    bez(ctx, [-0.6, 26.4, -8, 28, -17, 33, -22.4, 43], dk, 1.1, 0.42)
    bez(ctx, [4.6, 26.4, 11, 28.4, 18, 34, 22.6, 43], dk, 1.1, 0.42)
    bez(ctx, [1.6, 28.6, 1.2, 34, 0.4, 40, 0.6, 46], dk, 1, 0.32)
  }
  if (L <= 64) {
    // 목덜미로 모이는 결
    pair(ctx, [-12.4, 48, -11, 53, -7.4, 57, -3.4, L], dk, 1, 0.36)
  } else if (h.wavy) {
    for (const x of [-19, -7, 6, 18]) bez(ctx, [x, 48, x - 4.4, 57, x + 4.4, 68, x, L - 5], dk, 1.1, 0.38)
  } else {
    for (const x of [-18.4, -6.4, 6.4, 18.4]) bez(ctx, [x, 48, x * 1.03, 56, x * 1.04, L - 12, x * 1.02, L - 4.4], dk, 1.1, 0.38)
    if (L <= 70) line(ctx, [-24, L - 4.6, 0, L - 2.6, 24, L - 4.6], dk, 1, 0.26)
  }
}

export function drawHair(ctx: C, layer: 'under' | 'over', view: View, style: number, color: string, skin: string): void {
  const h = HAIRS[style] ?? HAIRS[0]
  const col = h.fringe === 'buzz' ? mix(color, skin, 0.12) : color
  const ex = extras(h, view)
  if (layer === 'under') {
    const ps = [...ex.under]
    if (view === 'front' && h.len > 64) ps.push(...massFront(h))
    if (view === 'side' && h.len > 70) ps.push(...massSide(h))
    if (ps.length) shape(ctx, ps, darken(col, 0.1), G)
    return
  }
  const paths = view === 'front' ? capFront(h) : view === 'back' ? capBack(h) : capSide(h)
  const all = view === 'back' ? [...ex.under, ...paths, ...ex.over] : [...paths, ...ex.over]
  shape(ctx, all, col, G, { rim: h.fringe === 'buzz' ? 0.8 : 1.5 })
  if (view === 'front') frontDetail(ctx, h, col)
  else if (view === 'side') sideDetail(ctx, h, col)
  else backDetail(ctx, h, col)
  for (const [tx, ty] of ex.ties) tie(ctx, tx, ty)
}

function tie(ctx: C, x: number, y: number): void {
  shape(ctx, circle(x, y, 3.4), TIE, [x - 3, y - 3, x + 3, y + 3], { rim: 0.9 })
}
