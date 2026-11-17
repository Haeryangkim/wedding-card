/** 몸: 그림자, 다리, 팔, 머리, 얼굴. 좌표는 디자인 단위(가로 중심 x = 0 으로 이동된 상태). */
import type { Frame, View } from './dims'
import { capsule, circle, darken, ellipse, flat, line, mix, shape, type C } from './draw'
import { BLUSH, INK } from './palette'

export const GROUND_Y = 104

/** 걷기 자세 값. 프레임 1·2 는 서로 거울상 */
export interface Gait {
  /** 상체 위아래 흔들림(음수 = 위) */
  bob: number
  /** 상체 기울기(rad) — 정면/뒤: 좌우 뒤뚱, 옆: 앞으로 살짝 */
  tilt: number
  /** 옆모습 다리/팔 스윙 각(rad). 정면/뒤에서는 ±1 부호만 사용 */
  swing: number
}
export function gait(view: View, frame: Frame): Gait {
  if (frame === 0) return { bob: 0, tilt: 0, swing: 0 }
  const s = frame === 1 ? 1 : -1
  if (view === 'side') return { bob: -1.6, tilt: 0.05, swing: s * 0.5 }
  return { bob: -1.4, tilt: s * 0.045, swing: s }
}

export function drawShadow(ctx: C, w = 21): void {
  const g = ctx.createRadialGradient(0, GROUND_Y, 1, 0, GROUND_Y, w)
  g.addColorStop(0, 'rgba(70,45,50,0.30)')
  g.addColorStop(0.7, 'rgba(70,45,50,0.16)')
  g.addColorStop(1, 'rgba(70,45,50,0)')
  ctx.save()
  ctx.translate(0, GROUND_Y)
  ctx.scale(1, 0.24)
  ctx.translate(0, -GROUND_Y)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, GROUND_Y, w, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export interface LegLook {
  /** 바지/스타킹 색. null 이면 맨다리(피부색) */
  leg: string | null
  shoe: string
  skin: string
  /** 통 넓은 바지(남자 한복) */
  wide?: boolean
}

export function drawLegs(ctx: C, view: View, frame: Frame, look: LegLook): void {
  const col = look.leg ?? look.skin
  const w = look.wide ? 12.5 : look.leg ? 10.6 : 8.4
  const sw = gait(view, frame).swing
  if (view === 'side') {
    for (const near of [false, true]) {
      const a = frame === 0 ? 0 : near ? sw : -sw
      const px = frame === 0 ? (near ? 2.2 : -3) : near ? 0.8 : -0.8
      const ex = px + Math.sin(a) * 12
      const ey = 85 + Math.cos(a) * 12 - (a > 0 ? 0.6 : 0)
      const c = near ? col : darken(col, 0.1)
      const sc = near ? look.shoe : darken(look.shoe, 0.1)
      shape(ctx, capsule(px, 85, ex, ey, w), c, [px - 5, 82, px + 5, 100])
      shape(ctx, ellipse(ex + 2.6, ey + 3.4, 7.8, 4.5, -a * 0.45), sc, [ex - 4, ey - 1, ex + 6, ey + 8])
    }
    return
  }
  for (const s of [-1, 1]) {
    // 정면: 화면 왼쪽 다리가 프레임1에서 들림. 뒷모습은 반대
    const lifted = frame !== 0 && sw * (view === 'back' ? -1 : 1) === -s
    const lift = lifted ? 4.2 : 0
    const x = s * 6.7
    shape(ctx, capsule(x, 84, x, 96.2 - lift, w), col, [x - 6, 82, x + 6, 100])
    const rx = view === 'back' ? 6.6 : 7.5
    shape(ctx, ellipse(x * 1.12, 100.2 - lift, rx, 4.7), look.shoe, [x - 5, 96 - lift, x + 5, 105 - lift])
  }
}

export type Sleeve = 'long' | 'short' | 'none'
export interface ArmLook {
  sleeve: Sleeve
  color: string
  skin: string
  /** 소매 굵기 (한복은 넓게) */
  width?: number
  /** 소맷부리 끝동 색 */
  cuff?: string
}

function arm(ctx: C, x0: number, y0: number, ang: number, len: number, look: ArmLook, dim = 0): void {
  const dx = Math.sin(ang)
  const dy = Math.cos(ang)
  const ex = x0 + dx * len
  const ey = y0 + dy * len
  const skin = dim ? darken(look.skin, dim) : look.skin
  const col = dim ? darken(look.color, dim) : look.color
  const g: [number, number, number, number] = [x0 - 5, y0 - 4, x0 + 5, y0 + len + 4]
  const sw = look.width ?? 9.2
  if (look.sleeve !== 'long') shape(ctx, capsule(x0, y0, ex, ey, 7.4), skin, g)
  shape(ctx, circle(ex, ey, 4.7), skin, [ex - 4, ey - 4, ex + 4, ey + 5])
  if (look.sleeve === 'none') return
  const k = look.sleeve === 'long' ? 0.8 : 0.4
  const sx = x0 + dx * len * k
  const sy = y0 + dy * len * k
  shape(ctx, capsule(x0, y0, sx, sy, sw), col, g)
  if (look.cuff) {
    line(ctx, [sx - dy * sw * 0.42, sy + dx * sw * 0.42, sx + dy * sw * 0.42, sy - dx * sw * 0.42], look.cuff, 2.6)
  }
}

export type ArmPass = 'far' | 'near' | 'both'
/** hold = 두 손을 앞으로 모음(신부 부케) */
export function drawArms(ctx: C, view: View, frame: Frame, look: ArmLook, pass: ArmPass, hold = false): void {
  const sw = gait(view, frame).swing
  if (view === 'side') {
    if (hold) {
      if (pass !== 'far') arm(ctx, 0, 68, 0.75, 14, look)
      return
    }
    if (pass === 'far') arm(ctx, -1, 68, frame === 0 ? -0.12 : sw * 1.15, 16, look, 0.1)
    if (pass === 'near') arm(ctx, -1, 68, frame === 0 ? 0.1 : -sw * 1.15, 16, look)
    return
  }
  for (const s of [-1, 1]) {
    if (hold && view === 'front') {
      arm(ctx, s * 12, 68, s * -0.6, 14.5, look)
      continue
    }
    if (hold) {
      arm(ctx, s * 12.2, 68, s * 0.06, 12, look)
      continue
    }
    // 앞으로 나온 팔은 짧게(원근) + 바깥으로 벌어짐
    const fwd = frame !== 0 && sw * (view === 'back' ? -1 : 1) === s
    const ang = frame === 0 ? 0.2 : fwd ? 0.42 : 0.1
    const len = frame === 0 ? 16.5 : fwd ? 14 : 17
    arm(ctx, s * 12.2, 68, s * ang, len, look)
  }
}

export function headPath(): Path2D {
  const p = new Path2D()
  p.moveTo(0, 15)
  p.bezierCurveTo(16, 15, 27, 26, 27, 41)
  p.bezierCurveTo(27, 56, 15, 65, 0, 65)
  p.bezierCurveTo(-15, 65, -27, 56, -27, 41)
  p.bezierCurveTo(-27, 26, -16, 15, 0, 15)
  p.closePath()
  return p
}

function eye(ctx: C, x: number, y: number, rx: number): void {
  flat(ctx, ellipse(x, y, rx, 3.7), INK)
  flat(ctx, circle(x - rx * 0.3, y - 1.4, rx * 0.36), '#ffffff', 0.9)
}

export function drawHead(ctx: C, view: View, skin: string): void {
  const head = headPath()
  const noseC = darken(skin, 0.2)
  const mouthC = mix2(skin)
  if (view === 'front') {
    shape(ctx, [circle(-26.6, 46.5, 4.2), circle(26.6, 46.5, 4.2)], skin, [-30, 42, 30, 51])
    shape(ctx, head, skin, [-27, 15, 27, 65], { radial: [-9, 29, 40] })
    flat(ctx, circle(-17.5, 52.5, 4.6), BLUSH, 0.36)
    flat(ctx, circle(17.5, 52.5, 4.6), BLUSH, 0.36)
    eye(ctx, -11.5, 45.5, 2.7)
    eye(ctx, 11.5, 45.5, 2.7)
    const n = new Path2D()
    n.moveTo(0, 49)
    n.quadraticCurveTo(2.6, 52.6, 0, 52.8)
    n.quadraticCurveTo(-2.6, 52.6, 0, 49)
    flat(ctx, n, noseC)
    line(ctx, [-3.4, 56.4, 0, 59, 3.4, 56.4], mouthC, 1.5)
  } else if (view === 'side') {
    shape(ctx, [circle(25.6, 50, 3), head], skin, [-27, 15, 27, 65], { radial: [-4, 29, 40] })
    flat(ctx, circle(18, 53, 4.2), BLUSH, 0.36)
    eye(ctx, 16, 45.5, 2.2)
    line(ctx, [14.6, 56.8, 17, 59, 19.8, 57.6], mouthC, 1.4)
    shape(ctx, circle(-5, 47.5, 4.3), skin, [-9, 43, -1, 52])
  } else {
    shape(ctx, [circle(-26.6, 46.5, 4.2), circle(26.6, 46.5, 4.2)], skin, [-30, 42, 30, 51])
    shape(ctx, head, skin, [-27, 15, 27, 65], { radial: [-9, 29, 40] })
  }
}

function mix2(skin: string): string {
  return mix(darken(skin, 0.55), '#a8444c', 0.35)
}
