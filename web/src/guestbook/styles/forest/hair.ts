/**
 * 머리 모양. 스타일마다 수치(볼륨·길이·앞머리 종류·부가 요소)만 다르고 공통 생성기가 3방향을 만든다.
 * under = 몸/머리 뒤에 깔리는 층, over = 머리 위에 덮는 층.
 */
import type { View } from './dims'
import { circle, darken, lighten, line, mix, shape, type Box, type C } from './draw'

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
    p.bezierCurveTo(X, 55, 15, L + 1, 0, L + 1)
    p.bezierCurveTo(-15, L + 1, -X, 55, -X, 44)
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

/* ── 옆모습 (오른쪽을 봄) ────────────────────────────── */
function capSide(h: HairSpec): Path2D[] {
  const X = 27.6 + h.wide
  const T = 13.4 - h.vol
  const L = h.len
  const out: Path2D[] = []
  if (h.fringe === 'curly') {
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.62 + (1.12 * i) / 10)
      out.push(circle(-2 + Math.cos(a) * 23, 38 + Math.sin(a) * 21, 9.2))
    }
    for (const [x, y, r] of [[-8, 30, 17], [-16, 44, 10], [8, 26, 9], [19, 29, 6.4], [-8, 50, 7]]) out.push(circle(x, y, r))
    return out
  }
  let fx = 24.2
  let fy = 29.5
  if (h.fringe === 'bangs') {
    fx = 26.6
    fy = 38
  } else if (h.fringe === 'up') {
    fx = 19.5
    fy = 23.5
  } else if (h.fringe === 'buzz') {
    fx = 19
    fy = 22
  }
  const buzz = h.fringe === 'buzz'
  const p = new Path2D()
  p.moveTo(fx, fy)
  p.bezierCurveTo(fx - 3, T + 3, 10, T, -2, T)
  p.bezierCurveTo(-18, T, -X - 0.6, 24, -X - 0.6, 42)
  if (L <= 64) {
    // 짧은 머리: 뒤통수를 따라 목덜미까지, 귀를 비켜 구레나룻으로
    p.bezierCurveTo(-X - 0.6, 52, -24, L, -17.5, L - 0.5)
    p.quadraticCurveTo(-12, L - 3, -11.5, 51)
    p.quadraticCurveTo(-11, 40.5, -3, 40.5)
    p.lineTo(4, buzz ? 38 : 41)
  } else {
    // 단발/긴 머리: 귀를 덮고 턱선까지
    const b = Math.min(L, 66)
    p.lineTo(-X - 0.6, b - 12)
    p.quadraticCurveTo(-X - 0.6, b, -X + 12, b)
    p.lineTo(-2, b)
    p.quadraticCurveTo(4, b, 4.6, b - 7)
  }
  if (h.fringe === 'bangs') {
    p.quadraticCurveTo(7, 41, 14, 40.5)
    p.quadraticCurveTo(22, 41, fx, fy)
  } else if (h.fringe === 'up' || buzz) {
    p.quadraticCurveTo(9, 31, fx, fy)
  } else {
    p.quadraticCurveTo(9, 37.5, 14.5, 35)
    p.quadraticCurveTo(21, 35.5, fx, fy)
  }
  p.closePath()
  if (L > 68) {
    const f = new Path2D()
    f.moveTo(-X - 0.6, 40)
    f.lineTo(-X, L - 6)
    f.quadraticCurveTo(-X, L, -X + 7, L)
    f.lineTo(-11, L)
    f.quadraticCurveTo(-5, L, -5, L - 6)
    f.lineTo(-3, 56)
    f.closePath()
    out.push(f)
    if (h.wavy) {
      for (let y = 50; y <= L - 3; y += 8.5) out.push(circle(-X + 1, y, 5.6), circle(-5, Math.max(y, 62), 5))
      for (let x = -X + 5; x <= -8; x += 7) out.push(circle(x, L - 2, 5.2))
    }
  }
  out.push(p)
  return out
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
    const b = view === 'side' ? circle(-9, 9.5, 9.6) : circle(0, 8.5, 9.8)
    under.push(b)
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
          p.bezierCurveTo(-13, 40, -13, 72, 0, 72)
          p.bezierCurveTo(13, 72, 13, 40, 6, 22)
        }),
      )
      ties.push([0, 23])
    } else {
      under.push(
        path((p) => {
          p.moveTo(-20, 15)
          p.bezierCurveTo(-36, 8, -44, 32, -37, 56)
          p.bezierCurveTo(-35, 63, -30, 61, -31, 55)
          p.bezierCurveTo(-29, 42, -27, 32, -20, 27)
        }),
      )
      ties.push([-24.5, 20])
    }
  } else if (h.extra === 'twin') {
    const tail = (s: number) =>
      path((p) => {
        p.moveTo(s * 23, 32)
        p.bezierCurveTo(s * 44, 30, s * 45, 74, s * 34, 74)
        p.bezierCurveTo(s * 25, 74, s * 25, 52, s * 20, 42)
      })
    if (view === 'side') {
      over.push(
        path((p) => {
          p.moveTo(-14, 36)
          p.bezierCurveTo(-30, 36, -31, 75, -19, 75)
          p.bezierCurveTo(-9, 75, -8, 52, -5, 42)
        }),
      )
      ties.push([-10.5, 39])
    } else {
      under.push(tail(-1), tail(1))
      ties.push([-27.5, 36], [27.5, 36])
    }
  } else if (h.extra === 'quiff' && view !== 'back') {
    // 앞머리를 세워 넘긴 볼륨
    const q = new Path2D()
    if (view === 'front') q.ellipse(5, 15.5, 15, 7.5, -0.14, 0, Math.PI * 2)
    else q.ellipse(11, 15.5, 12, 7, 0.16, 0, Math.PI * 2)
    over.push(q)
  }
  return { under, over, ties }
}

export function drawHair(ctx: C, layer: 'under' | 'over', view: View, style: number, color: string, skin: string): void {
  const h = HAIRS[style] ?? HAIRS[0]
  const col = h.fringe === 'buzz' ? mix(color, skin, 0.12) : color
  const ex = extras(h, view)
  if (layer === 'under') {
    const ps = [...ex.under]
    if (view === 'front' && h.len > 64) ps.push(...massFront(h))
    if (ps.length) shape(ctx, ps, darken(col, 0.1), G)
    return
  }
  const paths = view === 'front' ? capFront(h) : view === 'back' ? capBack(h) : capSide(h)
  const all = view === 'back' ? [...ex.under, ...paths, ...ex.over] : [...paths, ...ex.over]
  shape(ctx, all, col, G, { rim: h.fringe === 'buzz' ? 0.8 : 1.5 })
  // 광택 띠 (장난감 같은 윤기)
  if (h.fringe !== 'buzz') {
    const T = 13.6 - h.vol
    const x = view === 'side' ? -4 : 0
    line(ctx, [x - 17, T + 9.5, x - 6, T + 3.2, x + 8, T + 3.6], lighten(col, 0.42), 2.6, 0.5)
  }
  // 결(가닥) 표현
  const dk = darken(col, 0.3)
  if (view === 'front' && h.fringe === 'bangs') {
    line(ctx, [-9, 31, -8.4, 37.6], dk, 1, 0.5)
    line(ctx, [8, 31, 8.6, 37.6], dk, 1, 0.5)
  }
  if (view === 'back' && h.len > 64 && !h.wavy) {
    line(ctx, [-9, 48, -9.5, h.len - 5], dk, 1, 0.4)
    line(ctx, [9, 48, 9.5, h.len - 5], dk, 1, 0.4)
  }
  for (const [tx, ty] of ex.ties) tie(ctx, tx, ty)
}

function tie(ctx: C, x: number, y: number): void {
  shape(ctx, circle(x, y, 3.2), TIE, [x - 3, y - 3, x + 3, y + 3], { rim: 0.8 })
}
