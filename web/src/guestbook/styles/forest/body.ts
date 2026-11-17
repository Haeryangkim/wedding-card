/**
 * 몸: 그림자, 다리, 팔, 머리, 얼굴. 좌표는 디자인 단위(가로 중심 x = 0 으로 이동된 상태).
 * 'side' 뷰는 완전한 옆모습이 아니라 3/4 뷰(오른쪽을 봄): 두 눈이 모두 보이고 얼굴이 +x 쪽으로 쏠린다.
 */
import type { Frame, View } from './dims'
import { capsule, circle, darken, ellipse, flat, line, mix, shape, type Box, type C } from './draw'
import { BLUSH, INK } from './palette'

export const GROUND_Y = 104

/** 걷기 자세 값. 프레임 1·2 는 서로 거울상 */
export interface Gait {
  /** 상체 위아래 흔들림(음수 = 위) */
  bob: number
  /** 상체 기울기(rad) — 정면/뒤: 좌우 뒤뚱, 3/4: 앞으로 살짝 */
  tilt: number
  /** 3/4 뷰 다리/팔 스윙 각(rad). 정면/뒤에서는 ±1 부호만 사용 */
  swing: number
}
export function gait(view: View, frame: Frame): Gait {
  if (frame === 0) return { bob: 0, tilt: 0, swing: 0 }
  const s = frame === 1 ? 1 : -1
  if (view === 'side') return { bob: frame === 1 ? -2 : -1.2, tilt: 0.065, swing: s * 0.6 }
  return { bob: -1.8, tilt: s * 0.05, swing: s }
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
  /** 구두 광택(신랑) */
  shine?: boolean
}

function shoe(ctx: C, x: number, y: number, rx: number, rot: number, col: string, shine?: boolean): void {
  shape(ctx, ellipse(x, y, rx, 4.7, rot), col, [x - 4, y - 4, x + 5, y + 5])
  if (shine) line(ctx, [x - rx * 0.5, y - 2, x - rx * 0.1, y - 2.8], '#ffffff', 1.3, 0.55)
}

export function drawLegs(ctx: C, view: View, frame: Frame, look: LegLook): void {
  const col = look.leg ?? look.skin
  const w = look.wide ? 12.5 : look.leg ? 10.6 : 8.4
  const sw = gait(view, frame).swing
  if (view === 'side') {
    // 먼 다리(+x 쪽, 어둡게) → 가까운 다리 순서
    for (const near of [false, true]) {
      const a = frame === 0 ? 0 : near ? sw : -sw
      const px = near ? -4.4 : 4.4
      const ex = px + Math.sin(a) * 12.5
      const ey = 85 + Math.cos(a) * 12 - (a < 0 ? 2.4 : 0)
      const c = near ? col : darken(col, 0.12)
      const sc = near ? look.shoe : darken(look.shoe, 0.12)
      shape(ctx, capsule(px, 85, ex, ey, w), c, [px - 5, 82, px + 5, 100])
      // 앞으로 내민 발은 발끝이 들리고, 뒤로 찬 발은 뒤꿈치가 들린다
      shoe(ctx, ex + 2.4, ey + 3.4, 7.7, -a * 0.55, sc, look.shine && near)
    }
    return
  }
  for (const s of [-1, 1]) {
    // 정면: 화면 왼쪽 다리가 프레임1에서 들림. 뒷모습은 반대
    const lifted = frame !== 0 && sw * (view === 'back' ? -1 : 1) === -s
    const lift = lifted ? 5.4 : 0
    const x = s * 6.7
    const lc = frame !== 0 && !lifted ? darken(col, 0.05) : col
    shape(ctx, capsule(x, 84, x, 96.2 - lift, w), lc, [x - 6, 82, x + 6, 100])
    const rx = (view === 'back' ? 6.6 : 7.5) + (lifted && view === 'front' ? 0.5 : 0)
    shoe(ctx, x * 1.12, 100.2 - lift, rx, 0, look.shoe, look.shine && view === 'front')
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
  const g: Box = [x0 - 5, y0 - 4, x0 + 5, y0 + len + 4]
  const sw = look.width ?? 9.2
  if (look.sleeve !== 'long') shape(ctx, capsule(x0, y0, ex, ey, 7.4), skin, g)
  shape(ctx, circle(ex, ey, 4.7), skin, [ex - 4, ey - 4, ex + 4, ey + 5])
  if (look.sleeve === 'none') return
  const k = look.sleeve === 'long' ? 0.8 : 0.4
  const sx = x0 + dx * len * k
  const sy = y0 + dy * len * k
  shape(ctx, capsule(x0, y0, sx, sy, sw), col, g)
  if (look.cuff) {
    line(ctx, [sx - dy * sw * 0.44, sy + dx * sw * 0.44, sx + dy * sw * 0.44, sy - dx * sw * 0.44], look.cuff, 3.2)
  }
}

export type ArmPass = 'far' | 'near' | 'both'
/** hold = 두 손을 앞으로 모음(신부 부케) */
export function drawArms(ctx: C, view: View, frame: Frame, look: ArmLook, pass: ArmPass, hold = false): void {
  const sw = gait(view, frame).swing
  if (view === 'side') {
    if (hold) {
      if (pass === 'far') arm(ctx, 10.2, 68, 0.1, 11.5, look, 0.1)
      else arm(ctx, -10.6, 68, 1.02, 15.5, look)
      return
    }
    // 팔은 같은 쪽 다리와 반대로 흔든다
    if (pass === 'far') arm(ctx, 10.4, 67.6, frame === 0 ? 0.16 : sw * 0.95 + 0.05, 15.5, look, 0.12)
    if (pass === 'near') arm(ctx, -10.8, 68, frame === 0 ? -0.12 : -sw * 0.95 - 0.02, 16.2, look)
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
    // 앞으로 나온 팔은 짧게(원근) + 바깥으로 크게 벌어짐, 뒤로 간 팔은 몸에 붙음
    const fwd = frame !== 0 && sw * (view === 'back' ? -1 : 1) === s
    const ang = frame === 0 ? 0.2 : fwd ? 0.62 : 0.04
    const len = frame === 0 ? 16.5 : fwd ? 13.2 : 17.2
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

/** 3/4 뷰 머리: 보는 쪽(+x) 볼이 살짝 더 통통하고 턱이 그쪽으로 쏠린다 */
function head34Path(): Path2D {
  const p = new Path2D()
  p.moveTo(0, 15)
  p.bezierCurveTo(16, 15, 26.8, 25, 27, 40)
  p.bezierCurveTo(27.4, 53, 19.5, 65, 2.5, 65)
  p.bezierCurveTo(-13.5, 65, -27, 56, -27, 41)
  p.bezierCurveTo(-27, 26, -16, 15, 0, 15)
  p.closePath()
  return p
}

function eye(ctx: C, x: number, y: number, rx: number): void {
  flat(ctx, ellipse(x, y, rx, 3.7), INK)
  flat(ctx, circle(x - rx * 0.3, y - 1.4, rx * 0.36), '#ffffff', 0.9)
}

/** 3/4 뷰에서 보이는 가까운 쪽 귀 (머리카락이 위를 덮는다) */
function ear34(ctx: C, skin: string): void {
  const x = -14.4
  const y = 48.2
  shape(ctx, ellipse(x, y, 3.9, 4.9, -0.12), mix(skin, BLUSH, 0.1), [x - 4, y - 5, x + 4, y + 5], { rim: 1.2 })
  line(ctx, [x + 1.2, y - 2.4, x - 2, y - 0.2, x + 0.8, y + 2.4], darken(skin, 0.3), 1.1, 0.75)
}

/** 3/4 뷰 눈·코·입 좌표 (안경 등 액세서리가 맞춰 쓴다) */
export const FACE34 = { nearEye: 2.6, farEye: 20.2, eyeY: 45.5 }

export function drawHead(ctx: C, view: View, skin: string): void {
  const noseC = darken(skin, 0.22)
  const mouthC = mix(darken(skin, 0.55), '#a8444c', 0.35)
  if (view === 'side') {
    // 보는 쪽(+x) 볼이 살짝 도드라진 실루엣
    const h34 = head34Path()
    shape(ctx, h34, skin, [-27, 15, 27, 65], { radial: [-5, 29, 40] })
    ctx.save()
    ctx.clip(h34)
    flat(ctx, ellipse(22.6, 53.4, 3, 3.6), BLUSH, 0.32)
    ctx.restore()
    flat(ctx, circle(-2.4, 53, 4.6), BLUSH, 0.36)
    eye(ctx, FACE34.nearEye, FACE34.eyeY, 2.7)
    eye(ctx, FACE34.farEye, FACE34.eyeY, 2.05)
    // 코: 보는 쪽으로 볼록한 작은 호
    line(ctx, [13.4, 49.4, 16.6, 51.6, 13.4, 52.8], noseC, 1.5, 0.9)
    line(ctx, [9.6, 56.6, 12.6, 59, 15.6, 56.6], mouthC, 1.5)
    ear34(ctx, skin)
    return
  }
  shape(ctx, [circle(-26.6, 46.5, 4.2), circle(26.6, 46.5, 4.2)], skin, [-30, 42, 30, 51])
  shape(ctx, headPath(), skin, [-27, 15, 27, 65], { radial: [-9, 29, 40] })
  if (view !== 'front') return
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
}
