/**
 * 몸: 머리(얼굴), 다리+신발, 팔+손. 좌표는 오른쪽을 보는 3/4 측면(side) 또는 정면/뒷면 기준의 절대 좌표.
 *   머리  x 12..35, y 15..35 (폭 24 · 높이 21)   머리카락 포함 시 y 10 부터 → 전체 키의 절반
 *   몸통  x 18..29, y 35..48                      다리 y 47..57, 신발 y 58..61
 */
import type { Frame, View } from './dims'
import { FOOT_Y } from './dims'
import type { Layer, Mat } from './raster'

export const CX = 23.5
export const HEAD = { cy: 25, rx: 12, ry: 10.5, n: 2.5 } as const

export interface Pose {
  view: View
  /** 얼굴이 향하는 쪽으로 이목구비가 밀리는 정도 (side = 1) */
  f: 0 | 1
  frame: Frame
  /** 걷기 프레임에서 상체가 내려가는 픽셀 */
  bob: number
  legA: { dx: number; lift: number }
  legB: { dx: number; lift: number }
  /** 손 위치 오프셋 */
  armL: { dx: number; dy: number }
  armR: { dx: number; dy: number }
}

export function makePose(view: View, frame: Frame): Pose {
  const p: Pose = {
    view,
    f: view === 'side' ? 1 : 0,
    frame,
    bob: frame === 0 ? 0 : 1,
    legA: { dx: 0, lift: 0 },
    legB: { dx: 0, lift: 0 },
    armL: { dx: 0, dy: 0 },
    armR: { dx: 0, dy: 0 },
  }
  if (view === 'side') {
    if (frame === 1) {
      p.legA = { dx: -3, lift: 1 }
      p.legB = { dx: 3, lift: 0 }
      p.armL = { dx: 3, dy: -1 }
      p.armR = { dx: -2, dy: 0 }
    } else if (frame === 2) {
      p.legA = { dx: 4, lift: 0 }
      p.legB = { dx: -4, lift: 1 }
      p.armL = { dx: -3, dy: -1 }
      p.armR = { dx: 3, dy: -1 }
    }
  } else {
    if (frame === 1) {
      p.legA.lift = 2
      p.armL.dy = 1
      p.armR.dy = -1
    } else if (frame === 2) {
      p.legB.lift = 2
      p.armL.dy = -1
      p.armR.dy = 1
    }
  }
  return p
}

export function drawHead(L: Layer, skin: Mat, p: Pose): void {
  // 귀 (머리카락에 대부분 가려진다)
  if (p.view !== 'side') L.ell(35.2, 27, 1.6, 2.4, skin.b)
  L.ell(11.8, 27, 1.6, 2.4, skin.b)
  L.ell(CX, HEAD.cy, HEAD.rx, HEAD.ry, skin.b, HEAD.n)
  // 턱 아래·뒤쪽 가장자리 음영
  L.rim(skin.b, skin.sh, 0, 1, 1)
  if (p.view === 'side') L.rim(skin.b, skin.sh, -1, 0, 1)
}

export interface FaceColors {
  eye: number
  iris: number
  white: number
  brow: number
  mouth: number
  blush: number
}

/** 눈의 왼쪽 x 와 폭 (정면은 좌우 대칭, 3/4 측면은 먼 쪽 눈이 1px 좁다) */
export function eyeBoxes(f: 0 | 1): { x: number; w: number }[] {
  return f
    ? [
        { x: 18, w: 4 },
        { x: 30, w: 3 },
      ]
    : [
        { x: 16, w: 4 },
        { x: 28, w: 4 },
      ]
}
export const EYE_Y0 = 24
export const EYE_Y1 = 29

export function drawFace(L: Layer, p: Pose, c: FaceColors): void {
  const s = p.f * 2
  L.on(() => {
    const eyes = eyeBoxes(p.f)
    eyes.forEach(({ x, w }, k) => {
      const x1 = x + w - 1
      L.row(21, x, x1, c.brow)
      // 세로로 긴 눈: 위는 진한 속눈썹선, 아래로 갈수록 홍채색, 아래 모서리는 둥글게
      L.rect(x, EYE_Y0, x1, EYE_Y1 - 1, c.eye)
      L.row(EYE_Y1, x + 1, x1 - 1, c.iris)
      L.row(EYE_Y1 - 1, x + 1, x1, c.iris)
      L.set(x1, EYE_Y1 - 2, c.iris)
      // 반짝임
      L.set(x, EYE_Y0 + 1, c.white)
      L.set(x + 1, EYE_Y0 + 1, c.white)
      L.set(x, EYE_Y0 + 2, c.white)
      L.set(x1, EYE_Y1 - 1, c.white)
      // 속눈썹 꼬리 (바깥쪽 위)
      L.set(k === 0 ? x - 1 : x1 + 1, EYE_Y0, c.eye)
    })
    // 입 (작은 미소)
    L.row(33, 23 + s, 24 + s, c.mouth)
    L.set(22 + s, 32, c.mouth)
    L.set(25 + s, 32, c.mouth)
    // 볼터치
    L.row(31, 13 + s, 15 + s, c.blush)
    L.row(31, 32 + s, 34 + s, c.blush)
  })
}

const HIP_A = 18
const HIP_B = 25
const LEG_W = 5

/** 다리 한 쪽 + 신발 */
export function drawLeg(L: Layer, which: 'A' | 'B', p: Pose, leg: Mat, shoe: Mat, wide = false): void {
  const side = p.view === 'side'
  const s = which === 'A' ? p.legA : p.legB
  let hip = which === 'A' ? HIP_A : HIP_B
  if (side) hip += which === 'A' ? 1 : 0 // 3/4: 두 다리가 조금 모인다
  const w = wide ? LEG_W + 1 : LEG_W
  const hx = wide && which === 'A' ? hip - 1 : hip
  const ankle = FOOT_Y - 4 - s.lift
  L.limb(hx, 46, hx + s.dx, ankle, w, leg.b)
  L.rim(leg.b, leg.sh, 1, 0, 1)
  // 신발: 측면은 앞코가 진행 방향으로, 정면은 바깥쪽으로 1px
  const fx = hip + s.dx
  let x0 = fx
  let x1 = fx + LEG_W - 1
  if (side) x1 += 2
  else if (which === 'A') x0 -= 1
  else x1 += 1
  const top = ankle + 1
  L.rect(x0, top, x1, top + 3, shoe.b)
  if (side) L.set(x1, top, 0)
  L.row(top + 3, x0, x1, shoe.sh)
  L.set(side ? x1 - 1 : which === 'A' ? x0 + 1 : x1 - 1, top + 1, shoe.hi)
}

export type Sleeve = 'long' | 'short' | 'none' | 'wide'

/** 팔 한 쪽 + 벙어리장갑 손 */
export function drawArm(L: Layer, which: 'L' | 'R', p: Pose, sleeve: Sleeve, cloth: Mat, skin: Mat, cuff?: number): void {
  const side = p.view === 'side'
  const o = which === 'L' ? p.armL : p.armR
  const w = sleeve === 'wide' ? 4 : 3
  let sx = which === 'L' ? 15 : 30
  if (side) sx += which === 'L' ? 1 : -1
  if (sleeve === 'wide' && which === 'L') sx -= 1
  const out = side ? 0 : which === 'L' ? -1 : 1 // 정면: 손이 살짝 바깥으로
  const hy = 45 + o.dy
  const hxEdge = sx + out + o.dx
  const end = sleeve === 'long' || sleeve === 'wide' ? hy - 1 : sleeve === 'short' ? 40 : 36
  const n = hy - 37
  for (let y = 37; y <= hy; y++) {
    const x = Math.round(sx + ((hxEdge - sx) * (y - 37)) / n)
    const c = y <= end ? cloth.b : skin.b
    L.row(y, x, x + w - 1, c)
    if (cuff && y === end && (sleeve === 'long' || sleeve === 'wide')) L.row(y, x, x + w - 1, cuff)
    if (sleeve === 'short' && y === end) L.row(y, x, x + w - 1, cloth.sh)
  }
  L.rim(cloth.b, cloth.sh, 1, 0, 1)
  L.rim(skin.b, skin.sh, 1, 0, 1)
  // 손
  const hm = skin
  const hc = hxEdge + (w - 1) / 2
  L.ell(hc, hy + 1.5, 2.1, 2.1, hm.b)
  L.set(Math.round(hc + 1), hy + 3, hm.sh)
  L.set(Math.round(hc + 1.6), hy + 2, hm.sh)
}
