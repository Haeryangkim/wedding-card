/**
 * 몸: 머리(얼굴), 다리+신발, 팔+손. 좌표는 오른쪽을 보는 3/4 측면(side) 또는 정면/뒷면 기준의 절대 좌표.
 *   머리  x 12..35, y 15..35 (폭 24 · 높이 21)   머리카락 포함 시 y 10 부터 → 전체 키의 절반
 *   몸통  x 18..29, y 35..48                      다리 y 46..57, 신발 y 58..61
 *
 * 측면 걷기는 "접지 포즈" 두 장이다: 두 다리가 같은 골반 지점에서 앞뒤로 벌어지고(∧ 모양),
 * 앞발은 뒤꿈치로 딛고(발끝이 들림) 뒷발은 뒤꿈치가 들린다. 팔은 다리와 반대로 흔든다.
 * 1(가까운 다리 앞) → 0 → 2(먼 다리 앞) → 0 순환에서 가까운 다리(밝음)와 먼 다리(어두움)가 번갈아 앞에 온다.
 */
import type { Frame, View } from './dims'
import { FOOT_Y } from './dims'
import { dim, type Layer, type Mat } from './raster'

export const CX = 23.5
export const HEAD = { cy: 25, rx: 12, ry: 10.5, n: 2.5 } as const

/** stand = 서 있음, fwd = 앞으로 내디딘 발, back = 뒤에 남은 발, up = (정면/뒷면) 들어 올린 발 */
export type Step = 'stand' | 'fwd' | 'back' | 'up'

export interface Pose {
  view: View
  /** 얼굴이 향하는 쪽으로 이목구비가 밀리는 정도 (side = 1) */
  f: 0 | 1
  frame: Frame
  /** 걷기 프레임에서 상체가 내려가는 픽셀 */
  bob: number
  /** 치맛자락·고름이 흔들리는 방향 (−1, 0, 1) */
  sway: -1 | 0 | 1
  legA: { dx: number; step: Step }
  legB: { dx: number; step: Step }
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
    sway: frame === 1 ? -1 : frame === 2 ? 1 : 0,
    legA: { dx: 0, step: 'stand' },
    legB: { dx: 0, step: 'stand' },
    armL: { dx: 0, dy: 0 },
    armR: { dx: 0, dy: 0 },
  }
  if (view === 'side') {
    // A = 가까운 다리 · L = 가까운 팔
    if (frame === 1) {
      p.legA = { dx: 5, step: 'fwd' }
      p.legB = { dx: -5, step: 'back' }
      p.armL = { dx: -3, dy: -1 }
      p.armR = { dx: 4, dy: -1 }
    } else if (frame === 2) {
      p.legA = { dx: -5, step: 'back' }
      p.legB = { dx: 5, step: 'fwd' }
      p.armL = { dx: 4, dy: -1 }
      p.armR = { dx: -3, dy: -1 }
    }
  } else {
    if (frame === 1) {
      p.legA.step = 'up'
      p.armL.dy = 1
      p.armR.dy = -2
    } else if (frame === 2) {
      p.legB.step = 'up'
      p.armL.dy = -2
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
  /** 어두운 피부용: 흰자와 밝은 눈꺼풀 선 (없으면 그리지 않는다) */
  sclera?: number
  lid?: number
  /** 속눈썹을 길게 (신부) */
  lash?: boolean
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
      const outer = k === 0 ? x - 1 : x1 + 1
      const inner = k === 0 ? x1 + 1 : x - 1
      L.row(21, x, x1, c.brow)
      if (c.sclera !== undefined) {
        // 흰자: 눈동자 양옆 아래쪽 — 어두운 피부에서 눈 윤곽을 또렷하게
        L.col(inner, EYE_Y0 + 3, EYE_Y1 - 1, c.sclera)
        L.col(outer, EYE_Y0 + 3, EYE_Y1 - 1, c.sclera)
      }
      if (c.lid !== undefined) {
        L.row(EYE_Y0 - 1, x, x1, c.lid)
        L.row(EYE_Y1 + 1, x + 1, x1 - 1, c.lid)
      }
      // 세로로 긴 눈: 위는 진한 속눈썹선, 아래로 갈수록 홍채색, 아래 모서리는 둥글게
      L.rect(x, EYE_Y0, x1, EYE_Y1 - 1, c.eye)
      L.row(EYE_Y1, x + 1, x1 - 1, c.iris)
      L.row(EYE_Y1 - 1, x + 1, x1, c.iris)
      L.set(x1, EYE_Y1 - 2, c.iris)
      if (c.sclera !== undefined) L.row(EYE_Y1 - 2, x + 1, x1, c.iris)
      // 반짝임
      L.set(x, EYE_Y0 + 1, c.white)
      L.set(x + 1, EYE_Y0 + 1, c.white)
      L.set(x, EYE_Y0 + 2, c.white)
      L.set(x1, EYE_Y1 - 1, c.white)
      // 속눈썹 꼬리 (바깥쪽 위)
      L.set(outer, EYE_Y0, c.eye)
      if (c.lash) L.set(outer + (k === 0 ? -1 : 1), EYE_Y0 - 1, c.eye)
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

export type LegStyle = 'slim' | 'wide' | 'baji'

/** 다리 한 쪽 + 신발. tie = 대님(발목 끈) 색 */
export function drawLeg(
  L: Layer,
  which: 'A' | 'B',
  p: Pose,
  legM: Mat,
  shoeM: Mat,
  style: LegStyle = 'slim',
  tie?: number,
): void {
  const side = p.view === 'side'
  const s = which === 'A' ? p.legA : p.legB
  const far = side && which === 'B'
  const leg = far ? dim(legM) : legM
  const shoe = far ? dim(shoeM) : shoeM
  // 측면: 서 있을 때는 3/4 로 살짝 어긋나고, 걸을 때는 두 다리가 거의 한 골반 지점에서 ∧ 로 벌어진다 (교차하지 않게 앞다리 골반이 2px 앞)
  const hip = side ? (s.step === 'fwd' ? 22 : s.step === 'back' ? 20 : which === 'A' ? 20 : 23) : which === 'A' ? HIP_A : HIP_B
  const rise = s.step === 'back' ? 2 : s.step === 'up' ? 2 : 0
  const ankle = FOOT_Y - 4 - rise
  const n = ankle - 46
  for (let y = 46; y <= ankle; y++) {
    const t = (y - 46) / n
    const x = Math.round(hip + s.dx * t)
    let l = x
    let r = x + LEG_W - 1
    if (style === 'wide') l -= which === 'A' || side ? 1 : 0
    if (style === 'wide' && which === 'B' && !side) r += 1
    if (style === 'baji') {
      // 풍성한 바지통이 발목에서 대님으로 조여진다
      const puff = ankle - y >= 3 ? 1 : 0
      l -= puff
      r += puff
      if (ankle - y === 2) {
        if (which === 'A' || side) l -= 1
        else r += 1
      }
    }
    L.row(y, l, r, leg.b)
    if (style === 'baji' && tie !== undefined && ankle - y === 1) L.row(y, l, r, tie)
  }
  L.rim(leg.b, leg.sh, 1, 0, 1)
  if (style === 'baji') L.rim(leg.b, leg.sh, 0, 1, 1)
  // 신발: 측면은 앞코가 진행 방향으로, 정면은 바깥쪽으로 1px
  const x0 = hip + s.dx - (!side && which === 'A' ? 1 : 0)
  const x1 = hip + s.dx + LEG_W - 1 + (side ? 2 : which === 'B' ? 1 : 0)
  const top = FOOT_Y - 3 - (s.step === 'up' ? rise : 0)
  for (let x = x0; x <= x1; x++) {
    let yo = 0
    if (s.step === 'fwd' && x >= x1 - 1) yo = -1 // 뒤꿈치로 딛고 발끝이 들린다
    if (s.step === 'back') yo = x <= x0 + 1 ? -2 : x <= x0 + 3 ? -1 : 0 // 뒤꿈치가 들린다
    const underLeg = x >= hip + s.dx && x <= hip + s.dx + LEG_W - 1
    const t0 = underLeg ? ankle + 1 : top + yo + (side && x === x1 ? 1 : 0)
    L.col(x, t0, top + 3 + yo, shoe.b)
    L.set(x, top + 3 + yo, shoe.sh)
  }
  L.set(side ? x1 - 1 : which === 'A' ? x0 + 1 : x1 - 1, top + 1 + (s.step === 'fwd' ? -1 : 0), shoe.hi)
}

export type Sleeve = 'long' | 'short' | 'none' | 'wide'

/** 한복 소매(배래): 어깨에서 넓어졌다가 소매 끝으로 둥글게 모이는 폭 (어깨부터 행마다 바깥으로 더해지는 px) */
const BAERAE = [0, 1, 2, 3, 3, 3, 2, 1, 1, 1]

/** 팔 한 쪽 + 벙어리장갑 손 */
export function drawArm(
  L: Layer,
  which: 'L' | 'R',
  p: Pose,
  sleeve: Sleeve,
  clothM: Mat,
  skinM: Mat,
  cuff?: number,
): void {
  const side = p.view === 'side'
  const far = side && which === 'R'
  const cloth = far ? dim(clothM) : clothM
  const skin = far ? dim(skinM) : skinM
  const o = which === 'L' ? p.armL : p.armR
  const w = 3
  let sx = which === 'L' ? 15 : 30
  if (side) sx += which === 'L' ? 1 : -1
  const out = side ? 0 : which === 'L' ? -1 : 1 // 정면: 손이 살짝 바깥으로
  const hy = 45 + o.dy
  const hxEdge = sx + out + o.dx
  const end = sleeve === 'long' || sleeve === 'wide' ? hy - 1 : sleeve === 'short' ? 40 : 36
  const n = hy - 37
  for (let y = 37; y <= hy; y++) {
    const x = Math.round(sx + ((hxEdge - sx) * (y - 37)) / n)
    const c = y <= end ? cloth.b : skin.b
    let l = x
    let r = x + w - 1
    if (sleeve === 'wide' && y <= end) {
      // 소매 주머니는 몸 바깥쪽(가까운 팔은 등 쪽)으로 늘어진다
      const e = BAERAE[Math.max(0, Math.min(y - 37, BAERAE.length - 1))]
      if (which === 'L') l -= e
      else r += e
    }
    L.row(y, l, r, c)
    if (cuff !== undefined && y === end && (sleeve === 'long' || sleeve === 'wide')) L.row(y, l, r, cuff)
    if (sleeve === 'short' && y === end) L.row(y, l, r, cloth.sh)
  }
  L.rim(cloth.b, cloth.sh, 1, 0, 1)
  if (sleeve === 'wide') L.rim(cloth.b, cloth.sh, 0, 1, 1)
  L.rim(skin.b, skin.sh, 1, 0, 1)
  // 손
  const hc = hxEdge + (w - 1) / 2
  L.ell(hc, hy + 1.5, 2.1, 2.1, skin.b)
  L.set(Math.round(hc + 1), hy + 3, skin.sh)
  L.set(Math.round(hc + 1.6), hy + 2, skin.sh)
}
