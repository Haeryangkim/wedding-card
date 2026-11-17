/** 벡터 그리기 도우미: 색 혼합, 클레이풍 그라데이션 채우기, 기본 도형 경로. */
export type C = CanvasRenderingContext2D
export type Box = [x0: number, y0: number, x1: number, y1: number]

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function mix(a: string, b: string, t: number): string {
  const p = parse(a)
  const q = parse(b)
  const h = (i: number) =>
    Math.round(p[i] + (q[i] - p[i]) * t)
      .toString(16)
      .padStart(2, '0')
  return `#${h(0)}${h(1)}${h(2)}`
}
/** 따뜻한 크림색 쪽으로 밝게 */
export const lighten = (c: string, t: number) => mix(c, '#fff6e8', t)
/** 자두빛 어두운 색 쪽으로 어둡게 (검정 대신 → 무광 장난감 느낌) */
export const darken = (c: string, t: number) => mix(c, '#3b2434', t)
export function rgba(hex: string, a: number): string {
  const [r, g, b] = parse(hex)
  return `rgba(${r},${g},${b},${a})`
}
/** 대략적 밝기 0..1 */
export function luma(hex: string): number {
  const [r, g, b] = parse(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export interface ShapeOpts {
  /** 테두리(rim) 두께. 0 이면 없음 */
  rim?: number
  /** 명암 세기 배율 */
  depth?: number
  /** 방사형 그라데이션: [하이라이트 x, y, 반지름] */
  radial?: [number, number, number]
}

/**
 * 한 덩어리로 보이는 도형(들)을 칠한다. 먼저 모든 경로의 테두리를 긋고 그 위에 채워서
 * 겹친 경로 사이의 내부 선이 보이지 않는다(합집합처럼 보임). g = 빛(좌상단)→그늘 방향 선분.
 */
export function shape(ctx: C, paths: Path2D | Path2D[], base: string, g: Box, o: ShapeOpts = {}): void {
  const list = Array.isArray(paths) ? paths : [paths]
  const rim = o.rim ?? 1.5
  const d = o.depth ?? 1
  if (rim > 0) {
    ctx.strokeStyle = darken(base, 0.42)
    ctx.lineWidth = rim
    ctx.lineJoin = 'round'
    for (const p of list) ctx.stroke(p)
  }
  let grad: CanvasGradient
  if (o.radial) {
    const [hx, hy, r] = o.radial
    grad = ctx.createRadialGradient(hx, hy, r * 0.08, (g[0] + g[2]) / 2, (g[1] + g[3]) / 2, r)
    grad.addColorStop(0, lighten(base, 0.2 * d))
    grad.addColorStop(0.55, base)
    grad.addColorStop(1, darken(base, 0.16 * d))
  } else {
    grad = ctx.createLinearGradient(g[0], g[1], g[2], g[3])
    grad.addColorStop(0, lighten(base, 0.16 * d))
    grad.addColorStop(0.5, base)
    grad.addColorStop(1, darken(base, 0.17 * d))
  }
  ctx.fillStyle = grad
  for (const p of list) ctx.fill(p)
}

export function capsule(x0: number, y0: number, x1: number, y1: number, w: number): Path2D {
  const p = new Path2D()
  const a = Math.atan2(y1 - y0, x1 - x0)
  p.arc(x0, y0, w / 2, a + Math.PI / 2, a + (3 * Math.PI) / 2)
  p.arc(x1, y1, w / 2, a - Math.PI / 2, a + Math.PI / 2)
  p.closePath()
  return p
}
export function ellipse(x: number, y: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D()
  p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
  return p
}
export const circle = (x: number, y: number, r: number) => ellipse(x, y, r, r)

/** 단색 채우기 (작은 디테일용) */
export function flat(ctx: C, p: Path2D, color: string, alpha = 1): void {
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.fillStyle = color
  ctx.fill(p)
  ctx.restore()
}
export function line(ctx: C, pts: number[], color: string, w: number, alpha = 1): void {
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pts[0], pts[1])
  if (pts.length === 6) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5])
  else for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
  ctx.stroke()
  ctx.restore()
}

/** 다섯 꽃잎의 작은 꽃 (부토니에·화관·꽃핀·부케 공용) */
export function flower(ctx: C, x: number, y: number, r: number, petal: string, core = '#f3c94f'): void {
  const ps: Path2D[] = []
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
    ps.push(circle(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.52))
  }
  shape(ctx, ps, petal, [x - r, y - r, x + r, y + r], { rim: r > 3 ? 1 : 0.7, depth: 0.7 })
  flat(ctx, circle(x, y, r * 0.36), core)
}

/** 3차 베지어 한 줄 (머릿결·주름 등). pts = [x0,y0, c1x,c1y, c2x,c2y, x1,y1] */
export function bez(ctx: C, pts: number[], color: string, w: number, alpha = 1): void {
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(pts[0], pts[1])
  ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7])
  ctx.stroke()
  ctx.restore()
}
/** 경로 외곽선만 */
export function outline(ctx: C, p: Path2D, color: string, w: number, alpha = 1): void {
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke(p)
  ctx.restore()
}
export function poly(pts: number[]): Path2D {
  const p = new Path2D()
  p.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1])
  p.closePath()
  return p
}

/**
 * 3/4 뷰(옆으로 걷는 모습)용 변환: 정면 기준으로 그린 몸통 디테일을
 * 보는 방향(+x)으로 밀고 가로를 줄여 그대로 재사용한다.
 */
export const Q_SHIFT = 3.6
export const Q_SCALE = 0.8
export function quarter(ctx: C, fn: () => void): void {
  ctx.save()
  ctx.transform(Q_SCALE, 0, 0, 1, Q_SHIFT, 0)
  fn()
  ctx.restore()
}
