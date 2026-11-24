/**
 * "네모 친구" 벡터 캐릭터 스타일 — nonemo "Character Creation Asset Pack" (CC0) 의 납작한 도형을 Canvas 2D 로 직접 그린다.
 * 다른 그림체와 같은 계약: PART_DEFS / randomAppearance / normalizeAppearance / getSprite(kind, dir, frame, scale).
 *
 * 원본은 정면 한 자세뿐이라, 팔·다리·몸통·머리(+머리카락·얼굴)를 따로 움직이는 컷아웃 리그로 걷기를 만든다.
 *  - down : 한 발씩 들어 올리고, 반대쪽으로 팔을 흔들고, 몸이 살짝 뜨고 머리가 기운다
 *  - left/right : 다리를 앞뒤로 벌린 옆걸음 (left 는 right 의 좌우 반전). 눈·입·볼을 가는 쪽으로 밀고 뒤쪽 귀만 그린다
 *  - up : 얼굴 없이 머리카락이 뒤통수를 덮는다
 * 프레임 0 = 서 있기, 1·2 = 걷기 (장면은 1,0,2,0 순서로 돌린다).
 *
 * 좌표: 팩의 머리 칸(145x143)을 그대로 쓰고, 그 칸을 160x168 디자인 상자의 (7.5, 4)에 둔다. 명목 크기는 그 1/4 (40x42).
 * 경로·치수·색은 ./data.ts (art/nemo/build.py 가 팩의 SVG 에서 뽑아 만든다). 옷·액세서리의 추가 모양은 이 파일에서 그린다.
 */
import type { Appearance, PartKey } from '../../types'
import {
  FACES,
  GEOM as G,
  GLASSES,
  HAIR_COLORS,
  MOUSTACHE,
  OURS_BACK,
  OURS_FRONT,
  OUTFIT_COLORS,
  PACK_BACK,
  PACK_FRONT,
  PANTS_BLUE,
  SKINS,
  type Face,
  type Prim,
  type SkinTone,
} from './data'

/* ── 치수 · 공개 타입 ─────────────────────────────────── */
/** 명목(논리) 크기. getSprite 캔버스는 이 크기 x scale 픽셀 */
export const NEMO_W = 40
export const NEMO_H = 42
/** 명목 1단위당 디자인 단위 */
export const DESIGN_PER_UNIT = 4
const DESIGN_W = NEMO_W * DESIGN_PER_UNIT
/** 디자인 상자 안에서 머리 칸의 왼쪽 위 */
const OX = (DESIGN_W - G.headW) / 2
const OY = 4
/** 머리 칸 좌표의 가로 중심, 발바닥 */
const CX = G.headW / 2
const GROUND = G.legY + G.legH
/** 명목 단위 기준 발바닥(접지) y, 가로 중심 x — 월드 배치 앵커 */
export const NEMO_FOOT_Y = (GROUND + OY) / DESIGN_PER_UNIT
export const NEMO_CENTER_X = NEMO_W / 2

export type Dir = 'down' | 'left' | 'right' | 'up'
/** 0 = 정지, 1·2 = 걷기 프레임 */
export type Frame = 0 | 1 | 2
export type SpriteKind = Appearance | 'groom' | 'bride'
/** 실제로 그리는 3방향 (left 는 right 의 좌우반전) */
export type View = 'front' | 'side' | 'back'
export interface PartDef {
  key: PartKey
  label: string
  options: { label: string; swatch?: string }[]
}

/* ── 그리기 도우미 ────────────────────────────────────── */
type C = CanvasRenderingContext2D
const DEG = Math.PI / 180
const BLACK = '#000000'
const WHITE = '#ffffff'

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
function luma(hex: string): number {
  const [r, g, b] = parse(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}
function dist(a: string, b: string): number {
  const p = parse(a)
  const q = parse(b)
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}
/** 같은 색의 한 톤 어두운 면 (아주 어두운 색은 반대로 밝게 — 검정 옷에서도 주머니·깃이 보이게) */
function tone(c: string): string {
  return luma(c) < 0.2 ? mix(c, WHITE, 0.24) : mix(c, '#1b1340', 0.2)
}
/** 옆모습에서 몸 뒤쪽 팔다리 — 살짝 어둡게 해 겹쳐도 구분되게 */
const far = (c: string): string => mix(c, '#24143a', 0.16)

const svgCache = new Map<string, Path2D>()
function svg(d: string): Path2D {
  let p = svgCache.get(d)
  if (!p) {
    p = new Path2D(d)
    svgCache.set(d, p)
  }
  return p
}
/** 모서리별 반지름을 주는 둥근 사각형 [왼위, 오른위, 오른아래, 왼아래] */
function rr(x: number, y: number, w: number, h: number, r: number | [number, number, number, number]): Path2D {
  const [tl, tr, br, bl] = typeof r === 'number' ? [r, r, r, r] : r
  const p = new Path2D()
  p.moveTo(x + tl, y)
  p.lineTo(x + w - tr, y)
  p.arcTo(x + w, y, x + w, y + tr, tr)
  p.lineTo(x + w, y + h - br)
  p.arcTo(x + w, y + h, x + w - br, y + h, br)
  p.lineTo(x + bl, y + h)
  p.arcTo(x, y + h, x, y + h - bl, bl)
  p.lineTo(x, y + tl)
  p.arcTo(x, y, x + tl, y, tl)
  p.closePath()
  return p
}
function circle(x: number, y: number, r: number): Path2D {
  const p = new Path2D()
  p.arc(x, y, r, 0, Math.PI * 2)
  return p
}
function poly(...pts: number[]): Path2D {
  const p = new Path2D()
  p.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1])
  p.closePath()
  return p
}
function fill(ctx: C, p: Path2D, color: string, alpha = 1): void {
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fill(p)
  ctx.globalAlpha = 1
}
/** 팩에서 옮긴 원시 도형(사각형·원·경로)을 그린다 */
function drawPrims(ctx: C, prims: Prim[]): void {
  for (const q of prims) {
    const p =
      q.t === 'rect'
        ? rr(q.x ?? 0, q.y ?? 0, q.w ?? 0, q.h ?? 0, q.rx ?? 0)
        : q.t === 'circle'
          ? circle(q.x ?? 0, q.y ?? 0, q.r ?? 0)
          : svg(q.d ?? '')
    if (q.fill) fill(ctx, p, q.fill)
    if (q.stroke) {
      ctx.strokeStyle = q.stroke
      ctx.lineWidth = q.sw ?? 1
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke(p)
    }
  }
}
/** dx 만큼 옮겨서 그리기 (mirror 면 머리 칸을 좌우로 뒤집는다 — 뒷모습용) */
function shifted(ctx: C, dx: number, fn: () => void, mirror = false): void {
  ctx.save()
  if (mirror) {
    ctx.translate(G.headW + dx, 0)
    ctx.scale(-1, 1)
  } else {
    ctx.translate(dx, 0)
  }
  fn()
  ctx.restore()
}

/* ── 걸음새 ───────────────────────────────────────────── */
export interface Pose {
  /** 상체(몸통·팔·머리)의 세로/가로 이동. 발은 땅에 남는다 */
  bob: number
  shiftX: number
  /** 머리 기울기 (라디안, 턱 중심) */
  tilt: number
  /** 다리: 들어 올린 높이(dy, 음수 = 위)와 엉덩이 중심 회전(rot, 옆모습에서 양수 = 가는 쪽) */
  legA: { dy: number; rot: number }
  legB: { dy: number; rot: number }
  /** 팔 회전 (라디안). 앞·뒤: A = 화면 왼팔, B = 오른팔 (양수 = 바깥). 옆: A = 앞쪽 팔, B = 뒤쪽 팔 (양수 = 가는 쪽) */
  armA: number
  armB: number
  /** 치마 밑단·뒷머리가 한 박자 늦게 따라오는 양 (단위) */
  sway: number
}
/** 옆모습에서 다리를 벌리는 각도, 엉덩이 관절에서 발바닥까지 길이 */
const STRIDE = 30
const HIP_DROP = 3
const LEG_REACH = G.legH - HIP_DROP

export function poseOf(view: View, frame: Frame): Pose {
  const s = frame === 1 ? 1 : frame === 2 ? -1 : 0
  if (view === 'side') {
    // 다리를 벌린 만큼 엉덩이가 내려가야 두 발이 땅에 닿는다
    const drop = s === 0 ? 0 : LEG_REACH * (1 - Math.cos(STRIDE * DEG))
    return {
      bob: drop,
      shiftX: s === 0 ? 0 : 1.5,
      tilt: s === 0 ? 0 : 2.5 * DEG,
      legA: { dy: drop, rot: s * STRIDE * DEG },
      legB: { dy: drop, rot: -s * STRIDE * DEG },
      armA: (4 - s * 36) * DEG,
      armB: (-4 + s * 36) * DEG,
      sway: s === 0 ? 0 : -2.5 - s,
    }
  }
  // 뒷모습은 같은 걸음을 뒤에서 본 것 — 좌우가 바뀐다
  const k = view === 'back' ? -s : s
  return {
    bob: k === 0 ? 0 : -2.5,
    shiftX: k * 1.2,
    tilt: k * 3.5 * DEG,
    legA: { dy: k > 0 ? -6 : 0, rot: 0 },
    legB: { dy: k < 0 ? -6 : 0, rot: 0 },
    armA: (G.armSpread + k * 16) * DEG,
    armB: (G.armSpread - k * 16) * DEG,
    sway: -k * 2.2,
  }
}

/* ── 옷 ──────────────────────────────────────────────── */
interface Pal {
  top: string
  sleeve: string
  leg: string
  skirt: string
  shoe: string
  /** null 이면 양말 띠 없음 */
  sock: string | null
  accent: string
  /** top 의 한 톤 어두운 면 (주머니·깃·밑단) */
  shade: string
}
interface Skirt {
  top: number
  bottom: number
  wTop: number
  wBottom: number
  /** 밑단 띠 높이 (shade 색) */
  hem?: number
}
interface OutfitDef {
  label: string
  /** 팩에 있던 옷이면 true, 우리가 더한 옷이면 false */
  pack: boolean
  /** 치마·원피스 (랜덤에서 긴 머리와 잘 묶인다) */
  feminine: boolean
  sleeve: 'none' | 'short' | 'long'
  legs: 'long' | 'shorts' | 'bare'
  /** 몸통 사각형을 그릴지 (팩의 원피스는 사다리꼴이 몸통을 대신한다) */
  body: boolean
  /** 몸통 아래쪽을 바지색으로 (팩의 티셔츠: 위 14 만 윗옷) */
  split?: number
  skirt?: Skirt
  pal: (c: string) => Pal
  /** 몸통 위 무늬 (몸통 모양으로 잘린다). cx = 앞판 중심 */
  detail?: (ctx: C, view: View, pal: Pal, cx: number) => void
  /** 팔까지 그린 뒤 얹는 것 (부케) */
  over?: (ctx: C, view: View, pal: Pal, cx: number) => void
}

const BODY_TOP = G.bodyY
const BODY_BOTTOM = G.bodyY + G.bodyH
const TUX = '#1e1e28'
/** 흰 윗옷과 짝이 되는 색: 고른 색이 흰색이면 윗옷을 분홍으로 */
const lightTop = (c: string): string => (luma(c) > 0.93 ? '#ffc7d8' : WHITE)
/** 티셔츠에 받쳐 입는 바지: 팩의 파랑. 윗옷이 파랑·남색이면 겹치지 않게 바꾼다 */
function pantsFor(c: string): string {
  if (dist(c, PANTS_BLUE) < 60) return '#2d3270'
  if (dist(c, '#2d3270') < 60) return '#e9cfa6'
  return PANTS_BLUE
}
const basePal = (c: string): Pal => ({ top: c, sleeve: c, leg: c, skirt: c, shoe: BLACK, sock: WHITE, accent: WHITE, shade: tone(c) })

/** 셔츠 깃이 보이는 V 자 앞섶 */
function shirtFront(ctx: C, cx: number): void {
  fill(ctx, poly(cx - 9.5, BODY_TOP, cx + 9.5, BODY_TOP, cx, BODY_TOP + 19), WHITE)
}
function bowTie(ctx: C, cx: number, color: string): void {
  const y = BODY_TOP + 5
  fill(ctx, poly(cx, y, cx - 6.5, y - 4, cx - 6.5, y + 4), color)
  fill(ctx, poly(cx, y, cx + 6.5, y - 4, cx + 6.5, y + 4), color)
  fill(ctx, circle(cx, y, 2.2), color)
}
function necktie(ctx: C, cx: number, color: string): void {
  fill(ctx, poly(cx - 2.6, BODY_TOP + 1, cx + 2.6, BODY_TOP + 1, cx + 3.6, BODY_TOP + 13, cx, BODY_TOP + 17, cx - 3.6, BODY_TOP + 13), color)
}
function bouquet(ctx: C, view: View, cx: number): void {
  if (view === 'back') return
  const x = cx + (view === 'side' ? 9 : 0)
  const y = BODY_TOP + 15
  fill(ctx, circle(x - 5, y + 3.5, 3.6), '#3ddc84')
  fill(ctx, circle(x + 5, y + 3.5, 3.6), '#3ddc84')
  fill(ctx, circle(x - 4.2, y, 4.6), '#ff8db4')
  fill(ctx, circle(x + 4.2, y, 4.6), '#ff8db4')
  fill(ctx, circle(x, y - 3.2, 4.6), '#ff5c8a')
  fill(ctx, circle(x, y + 2.4, 4.2), '#ffe3ec')
}

export const OUTFITS: OutfitDef[] = [
  {
    label: '턱시도',
    pack: false,
    feminine: false,
    sleeve: 'long',
    legs: 'long',
    body: true,
    pal: () => ({ top: TUX, sleeve: TUX, leg: TUX, skirt: TUX, shoe: BLACK, sock: null, accent: BLACK, shade: tone(TUX) }),
    detail: (ctx, view, pal, cx) => {
      if (view === 'back') return
      shirtFront(ctx, cx)
      bowTie(ctx, cx, pal.accent)
      // 부토니에
      fill(ctx, circle(cx - 12, BODY_TOP + 9, 2.6), '#ff8db4')
    },
  },
  {
    label: '웨딩드레스',
    pack: false,
    feminine: true,
    sleeve: 'short',
    legs: 'bare',
    body: true,
    skirt: { top: BODY_TOP + 9, bottom: GROUND - 3, wTop: 33, wBottom: 66, hem: 5 },
    pal: () => ({ top: WHITE, sleeve: WHITE, leg: WHITE, skirt: WHITE, shoe: '#ffb3c8', sock: null, accent: '#ff8db4', shade: '#e6dcf3' }),
    over: (ctx, view, _pal, cx) => bouquet(ctx, view, cx),
  },
  {
    label: '티셔츠와 바지',
    pack: true,
    feminine: false,
    sleeve: 'short',
    legs: 'long',
    body: true,
    split: G.teeH,
    pal: (c) => ({ ...basePal(c), leg: pantsFor(c) }),
  },
  {
    label: '티셔츠와 반바지',
    pack: true,
    feminine: false,
    sleeve: 'short',
    legs: 'shorts',
    body: true,
    split: G.teeH,
    pal: (c) => ({ ...basePal(c), leg: pantsFor(c) }),
  },
  {
    label: '원피스',
    pack: true,
    feminine: true,
    sleeve: 'short',
    legs: 'bare',
    body: false,
    skirt: { top: BODY_TOP, bottom: BODY_BOTTOM, wTop: G.dressTopW, wBottom: G.dressBottomW },
    pal: basePal,
  },
  {
    label: '블라우스와 치마',
    pack: false,
    feminine: true,
    sleeve: 'short',
    legs: 'bare',
    body: true,
    skirt: { top: BODY_TOP + 12, bottom: BODY_BOTTOM + 4, wTop: 35, wBottom: 49 },
    pal: (c) => ({ ...basePal(c), top: lightTop(c), sleeve: lightTop(c), accent: c, shade: tone(lightTop(c)) }),
    detail: (ctx, view, pal, cx) => {
      if (view === 'back') return
      // 깃과 작은 리본
      fill(ctx, poly(cx - 8, BODY_TOP, cx, BODY_TOP, cx - 4, BODY_TOP + 6), pal.shade)
      fill(ctx, poly(cx + 8, BODY_TOP, cx, BODY_TOP, cx + 4, BODY_TOP + 6), pal.shade)
      fill(ctx, circle(cx, BODY_TOP + 7.5, 2.4), pal.accent)
    },
  },
  {
    label: '멜빵바지',
    pack: false,
    feminine: false,
    sleeve: 'short',
    legs: 'long',
    body: true,
    split: 16,
    pal: (c) => ({ ...basePal(c), top: lightTop(c), sleeve: lightTop(c), accent: '#ffc93c' }),
    detail: (ctx, view, pal, cx) => {
      if (view === 'back') {
        // 등에서 엇갈리는 끈
        fill(ctx, poly(cx - 12, BODY_TOP, cx - 7, BODY_TOP, cx + 6, BODY_TOP + 16, cx + 1, BODY_TOP + 16), pal.leg)
        fill(ctx, poly(cx + 12, BODY_TOP, cx + 7, BODY_TOP, cx - 6, BODY_TOP + 16, cx - 1, BODY_TOP + 16), pal.leg)
        return
      }
      fill(ctx, rr(cx - 11, BODY_TOP + 6, 22, 12, [3, 3, 0, 0]), pal.leg)
      fill(ctx, rr(cx - 11, BODY_TOP - 1, 4.5, 9, 0), pal.leg)
      fill(ctx, rr(cx + 6.5, BODY_TOP - 1, 4.5, 9, 0), pal.leg)
      fill(ctx, circle(cx - 8.6, BODY_TOP + 8.6, 1.7), pal.accent)
      fill(ctx, circle(cx + 8.6, BODY_TOP + 8.6, 1.7), pal.accent)
    },
  },
  {
    label: '후드티',
    pack: false,
    feminine: false,
    sleeve: 'long',
    legs: 'long',
    body: true,
    split: 20,
    pal: (c) => ({ ...basePal(c), leg: luma(c) < 0.25 || dist(c, '#3b3f5c') < 70 ? '#9aa0bd' : '#3b3f5c' }),
    detail: (ctx, view, pal, cx) => {
      if (view === 'back') {
        // 등 뒤로 넘긴 모자
        fill(ctx, rr(cx - 13, BODY_TOP - 4, 26, 15, [0, 0, 12, 12]), pal.shade)
        return
      }
      fill(ctx, rr(cx - 10, BODY_TOP - 4, 20, 9.5, [0, 0, 9, 9]), pal.shade)
      fill(ctx, rr(cx - 4.4, BODY_TOP + 5, 1.8, 6, 0.9), pal.accent)
      fill(ctx, rr(cx + 2.6, BODY_TOP + 5, 1.8, 6, 0.9), pal.accent)
      fill(ctx, rr(cx - 9, BODY_TOP + 13, 18, 7, [4, 4, 0, 0]), pal.shade)
    },
  },
  {
    label: '정장',
    pack: false,
    feminine: false,
    sleeve: 'long',
    legs: 'long',
    body: true,
    pal: (c) => ({ ...basePal(c), sock: null, accent: dist(c, '#ff3552') < 90 ? '#2d3270' : '#ff3552' }),
    detail: (ctx, view, pal, cx) => {
      if (view === 'back') return
      shirtFront(ctx, cx)
      necktie(ctx, cx, pal.accent)
    },
  },
  {
    label: '니트와 긴 치마',
    pack: false,
    feminine: true,
    sleeve: 'long',
    legs: 'bare',
    body: true,
    skirt: { top: BODY_TOP + 12, bottom: GROUND - 6, wTop: 35, wBottom: 53 },
    pal: (c) => {
      const knit = luma(c) > 0.8 ? '#ffb3c8' : '#fff1d6'
      return { ...basePal(c), top: knit, sleeve: knit, accent: c, shade: tone(knit) }
    },
    detail: (ctx, view, pal, cx) => {
      if (view === 'back') return
      // 둥근 목선
      fill(ctx, rr(cx - 8, BODY_TOP - 4, 16, 7.5, [0, 0, 7, 7]), pal.shade)
    },
  },
]
/** 신랑·신부 전용 (하객에게 주지 않는다) */
export const COUPLE_OUTFITS: readonly number[] = [0, 1]

function torsoPath(hw: number): Path2D {
  return rr(CX - hw, BODY_TOP, hw * 2, G.bodyH, [0, 0, G.bodyR, G.bodyR])
}
function skirtPath(sk: Skirt, squeeze: number, sway: number, top = sk.top): Path2D {
  const wt = (sk.wTop * squeeze) / 2
  const wb = (sk.wBottom * squeeze) / 2
  const r = 3.2
  const p = new Path2D()
  // top 이 치마 중간이면(밑단 띠) 그 높이의 폭으로 시작한다
  const f = (top - sk.top) / (sk.bottom - sk.top)
  const w0 = wt + (wb - wt) * f
  const x0 = CX + sway * f
  p.moveTo(x0 - w0, top)
  p.lineTo(x0 + w0, top)
  p.arcTo(CX + wb + sway, sk.bottom, CX + sway, sk.bottom, r)
  p.arcTo(CX - wb + sway, sk.bottom, x0 - w0, top, r)
  p.closePath()
  return p
}

function drawTorso(ctx: C, view: View, o: OutfitDef, pal: Pal, sway: number): void {
  const side = view === 'side'
  const hw = side ? 14.5 : G.bodyW / 2
  if (o.body) {
    const body = torsoPath(hw)
    fill(ctx, body, pal.top)
    ctx.save()
    ctx.clip(body)
    if (o.split != null) fill(ctx, rr(CX - hw, BODY_TOP + o.split, hw * 2, G.bodyH, 0), pal.leg)
    o.detail?.(ctx, view, pal, CX + (side ? 6 : 0))
    ctx.restore()
  }
  if (o.skirt) {
    const squeeze = side ? 0.86 : 1
    fill(ctx, skirtPath(o.skirt, squeeze, sway), pal.skirt)
    if (o.skirt.hem) fill(ctx, skirtPath(o.skirt, squeeze, sway, o.skirt.bottom - o.skirt.hem), pal.shade)
  }
}

/* ── 팔다리 ───────────────────────────────────────────── */
interface LegLook {
  skin: string
  kind: 'long' | 'shorts' | 'bare'
  color: string
  sock: string | null
  shoe: string
}
/** 다리 한 짝: (x, GEOM.legY) 가 위쪽 가운데. 엉덩이 관절(위에서 HIP_DROP)을 중심으로 돈다. toe = 옆모습의 신발 코 */
function drawLeg(ctx: C, x: number, look: LegLook, dy: number, rot: number, toe: boolean): void {
  const w = G.legW
  const h = G.legH
  ctx.save()
  ctx.translate(x, G.legY + HIP_DROP + dy)
  // 캔버스 회전은 시계 방향이 양수 → 발이 -x 로 간다. 가는 쪽(+x)이 양수가 되도록 뒤집는다
  ctx.rotate(-rot)
  ctx.translate(-w / 2, -HIP_DROP)
  const cap = w / 2
  fill(ctx, rr(0, 0, w, h, cap), look.kind === 'long' ? look.color : look.skin)
  if (look.kind === 'shorts') fill(ctx, rr(0, 0, w, G.shortsH, [cap, cap, 0, 0]), look.color)
  // 팩의 반바지 다리는 양말·신발 띠가 한 칸 아래에 있다
  const sockY = G.sockY + (look.kind === 'shorts' ? 1 : 0)
  const shoeY = sockY + G.sockH
  if (look.sock) fill(ctx, rr(0, sockY, w, G.sockH, 0), look.sock)
  fill(ctx, rr(0, shoeY, w + (toe ? 4.5 : 0), h - shoeY, [0, toe ? 5.5 : 0, cap, cap]), look.shoe)
  ctx.restore()
}
interface ArmLook {
  skin: string
  sleeve: 'none' | 'short' | 'long'
  color: string
}
/** 팔 한 짝: (x, y) 가 어깨(위쪽 둥근 끝의 중심). rot 양수 = 시계 방향(손이 화면 왼쪽으로) */
function drawArm(ctx: C, x: number, y: number, look: ArmLook, rot: number): void {
  const w = G.armW
  const cap = w / 2
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.translate(-cap, -cap)
  fill(ctx, rr(0, 0, w, G.armH, cap), look.skin)
  if (look.sleeve !== 'none') {
    fill(ctx, rr(0, 0, w, look.sleeve === 'short' ? G.sleeveShort : G.sleeveLong, [cap, cap, 0, 0]), look.color)
  }
  ctx.restore()
}

/* ── 머리카락 ─────────────────────────────────────────── */
interface HairDef {
  label: string
  /** 앞·뒤 경로가 모두 팩의 것이면 true */
  pack: boolean
  front: string
  back?: string
  /** 옆모습에서 뒷머리를 좌우로 뒤집는다 (옆으로 묶은 머리가 뒤로 가도록) */
  flipSide?: boolean
  /** 뒷모습에서 뒤통수를 덮는 높이 (머리 꼭대기에서) */
  cap: number
  /** 정수리 위로 솟는 뒷머리 (모자를 쓰면 숨긴다) */
  topKnot?: boolean
}
export const HAIRS: HairDef[] = [
  { label: '가르마', pack: true, front: PACK_FRONT.regular, cap: 62 },
  { label: '삐침 머리', pack: true, front: PACK_FRONT.chupchik, cap: 62 },
  { label: '올린 머리', pack: true, front: PACK_FRONT.straight, cap: 60 },
  { label: '짧은 머리', pack: false, front: OURS_FRONT.crop, cap: 54 },
  { label: '옆가르마', pack: false, front: OURS_FRONT.sidepart, cap: 62 },
  { label: '볼륨 펌', pack: true, front: PACK_FRONT.elegant, cap: 64 },
  { label: '뽀글 머리', pack: true, front: PACK_FRONT.curly, back: PACK_BACK.curly, cap: 66 },
  { label: '단발', pack: true, front: PACK_FRONT.regular, back: PACK_BACK.short, cap: 66 },
  { label: '뱅 단발', pack: false, front: OURS_FRONT.bangs, back: PACK_BACK.short, cap: 66 },
  { label: '긴 웨이브', pack: true, front: PACK_FRONT.chupchik, back: PACK_BACK.long, cap: 66 },
  { label: '긴 생머리', pack: false, front: OURS_FRONT.bangs, back: OURS_BACK.straightLong, cap: 66 },
  { label: '똥머리', pack: false, front: OURS_FRONT.sidepart, back: OURS_BACK.bun, cap: 64, topKnot: true },
  { label: '포니테일', pack: false, front: OURS_FRONT.bangs, back: OURS_BACK.ponytail, flipSide: true, cap: 66 },
  { label: '양갈래', pack: false, front: PACK_FRONT.regular, back: OURS_BACK.twintails, cap: 64 },
]
/** 0 ~ SHORT_HAIRS-1 번이 짧은 머리, 그 뒤가 긴 머리 (랜덤에서 옷과 묶을 때 쓴다) */
export const SHORT_HAIRS = 7

/* ── 액세서리 ─────────────────────────────────────────── */
interface Look {
  skin: SkinTone
  hair: HairDef
  hairColor: string
  outfit: OutfitDef
  pal: Pal
  acc: AccDef
  face: Face
}
interface AccDef {
  label: string
  pack: boolean
  /** 눈 모양을 바꾸는 "표정" 옵션 */
  face?: Face
  /** 머리 꼭대기를 덮는다 — 앞머리의 삐침·똥머리를 숨긴다 */
  coversTop?: boolean
  /** 뒷머리보다 먼저(앞·옆모습에서 맨 뒤에) 그리는 것 */
  behind?: (ctx: C, view: View, look: Look) => void
  /** 머리카락 위에 그리는 것. fx = 옆모습에서 얼굴이 밀린 양 */
  draw?: (ctx: C, view: View, look: Look, fx: number) => void
}
const VEIL = 'M72.5 22C101 22 126 42 128.5 72L136 144C136.6 150 132.2 154.5 126.5 154.5H18.5C12.8 154.5 8.4 150 9 144L16.5 72C19 42 44 22 72.5 22Z'
const CAP_DOME = 'M23 64C23 45.8 37.8 31 56 31H89C107.2 31 122 45.8 122 64V66H23V64Z'
const CAP_BLUE = '#545af2'
const RIBBON = '#ff3d6e'

export const ACCESSORIES: AccDef[] = [
  { label: '없음', pack: true },
  {
    label: '둥근 안경',
    pack: true,
    draw: (ctx, view, _l, fx) => {
      if (view !== 'back') shifted(ctx, fx, () => drawPrims(ctx, GLASSES.round))
    },
  },
  {
    label: '네모 안경',
    pack: true,
    draw: (ctx, view, _l, fx) => {
      if (view !== 'back') shifted(ctx, fx, () => drawPrims(ctx, GLASSES.square))
    },
  },
  {
    label: '리본',
    pack: false,
    draw: (ctx, view) => {
      shifted(
        ctx,
        0,
        () => {
          const x = 101
          const y = 43
          fill(ctx, svg(`M${x} ${y}L${x - 15} ${y - 10}C${x - 19} ${y - 4} ${x - 19} ${y + 4} ${x - 15} ${y + 10}Z`), RIBBON)
          fill(ctx, svg(`M${x} ${y}L${x + 15} ${y - 10}C${x + 19} ${y - 4} ${x + 19} ${y + 4} ${x + 15} ${y + 10}Z`), RIBBON)
          fill(ctx, circle(x, y, 4.6), mix(RIBBON, '#1b1340', 0.22))
        },
        view === 'back',
      )
    },
  },
  {
    label: '꽃',
    pack: false,
    draw: (ctx, view, look) => {
      // 밝은 머리에서는 흰 꽃잎이 묻히므로 분홍 꽃잎
      const petal = luma(look.hairColor) > 0.75 ? '#ff8db4' : WHITE
      shifted(
        ctx,
        0,
        () => {
          const x = 41
          const y = 50
          for (let i = 0; i < 5; i++) {
            const a = (i * 72 - 90) * DEG
            fill(ctx, circle(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 5.6), petal)
          }
          fill(ctx, circle(x, y, 4.6), '#ffc93c')
        },
        view === 'back',
      )
    },
  },
  {
    label: '캡모자',
    pack: false,
    coversTop: true,
    draw: (ctx, view) => {
      const brim = mix(CAP_BLUE, '#1b1340', 0.3)
      fill(ctx, svg(CAP_DOME), CAP_BLUE)
      fill(ctx, circle(CX, 31.5, 3.6), brim)
      if (view === 'front') fill(ctx, rr(31, 58, 83, 11, 5.5), brim)
      else if (view === 'side') fill(ctx, rr(70, 58, 64, 11, 5.5), brim)
      else fill(ctx, rr(60, 55, 25, 11, [6, 6, 0, 0]), brim)
    },
  },
  {
    label: '콧수염',
    pack: true,
    draw: (ctx, view, look, fx) => {
      if (view !== 'back') shifted(ctx, fx, () => fill(ctx, svg(MOUSTACHE), look.hairColor))
    },
  },
  { label: '반짝 눈', pack: true, face: FACES.cute },
  { label: '웃는 눈', pack: true, face: FACES.happy },
  {
    label: '면사포',
    pack: false,
    behind: (ctx, view) => {
      shifted(ctx, view === 'side' ? -9 : 0, () => fill(ctx, svg(VEIL), '#f6f1ff', 0.82))
    },
    draw: (ctx, view) => {
      if (view === 'back') {
        fill(ctx, svg(VEIL), '#f6f1ff', 0.86)
        return
      }
      // 머리 위 작은 꽃 장식
      for (const [x, y] of [
        [57, 44],
        [72.5, 40],
        [88, 44],
      ]) {
        fill(ctx, circle(x, y, 4.4), WHITE)
        fill(ctx, circle(x, y, 1.9), '#ffc93c')
      }
    },
  },
]
/** 신랑·신부 전용 액세서리 (면사포) */
export const VEIL_ACCESSORY = 9
export const MOUSTACHE_ACCESSORY = 6

/* ── 머리 ────────────────────────────────────────────── */
/** 옆모습에서 눈·입·볼을 가는 쪽으로 미는 양 */
const FACE_SHIFT = 11
const skullPath = (): Path2D => rr(G.skull.x, G.skull.y, G.skull.w, G.skull.h, G.skull.rx)

/** 뒷머리는 머리 꼭대기에 매달려 한 박자 늦게 따라온다: 옆모습은 뒤로 날리고, 앞·뒤 모습은 머리가 기운 만큼 덜 기운다 */
function hairLag(ctx: C, view: View, pose: Pose): void {
  ctx.translate(CX, 40)
  ctx.rotate(view === 'side' ? -pose.sway * 0.9 * DEG : -pose.tilt * 0.55)
  ctx.translate(-CX, -40)
}
function drawHairBack(ctx: C, look: Look, view: View, pose: Pose): void {
  const h = look.hair
  if (!h.back || (h.topKnot && look.acc.coversTop)) return
  ctx.save()
  hairLag(ctx, view, pose)
  // 옆모습: 뒤로 조금 밀고, 옆으로 묶은 머리는 뒤집어 뒤로 보낸다. 뒷모습: 좌우가 바뀐다
  const mirror = view === 'back' || (view === 'side' && h.flipSide === true)
  shifted(ctx, view === 'side' ? -5 : 0, () => fill(ctx, svg(h.back as string), look.hairColor), mirror)
  ctx.restore()
}
function drawHairFront(ctx: C, look: Look, mirror: boolean, dx: number): void {
  ctx.save()
  if (look.acc.coversTop) {
    // 모자 아래로 나온 부분만
    const clip = new Path2D()
    clip.rect(-20, 50, G.headW + 40, 120)
    ctx.clip(clip)
  }
  shifted(
    ctx,
    dx,
    () => {
      const p = svg(look.hair.front)
      fill(ctx, p, look.hairColor)
      // 머리 윤곽과 딱 맞닿는 가장자리에 피부색이 비치지 않게 아주 가는 테를 두른다
      ctx.strokeStyle = look.hairColor
      ctx.lineWidth = 0.9
      ctx.lineJoin = 'round'
      ctx.stroke(p)
    },
    mirror,
  )
  ctx.restore()
}

function drawHead(ctx: C, look: Look, view: View, pose: Pose): void {
  const { skin } = look
  const skull = skullPath()
  if (view === 'back') {
    fill(ctx, rr(G.ear.x, G.ear.y, G.ear.w, G.ear.h, G.ear.rx), skin.hex)
    fill(ctx, skull, skin.hex)
    drawHairFront(ctx, look, true, 0)
    fill(ctx, rr(G.skull.x, G.skull.y, G.skull.w, look.hair.cap, [G.skull.rx, G.skull.rx, 18, 18]), look.hairColor)
    drawHairBack(ctx, look, view, pose)
    look.acc.draw?.(ctx, view, look, 0)
    return
  }
  const side = view === 'side'
  const fx = side ? FACE_SHIFT : 0
  if (side) {
    // 뒤쪽(화면 왼쪽) 귀만 — 머리 안쪽으로 조금 들여 그린다
    fill(ctx, rr(G.ear.x + 6, G.ear.y, 40, G.ear.h, G.ear.rx), skin.hex)
    fill(ctx, rr(G.earIn.x + 6, G.earIn.y, 24, G.earIn.h, G.earIn.rx), skin.ear)
  } else {
    fill(ctx, rr(G.ear.x, G.ear.y, G.ear.w, G.ear.h, G.ear.rx), skin.hex)
    fill(ctx, rr(G.earIn.x, G.earIn.y, G.earIn.w, G.earIn.h, G.earIn.rx), skin.ear)
  }
  fill(ctx, skull, skin.hex)
  ctx.save()
  ctx.clip(skull)
  // 옆모습: 먼 쪽 볼·눈은 덜 밀어 얼굴이 돌아간 느낌을 낸다
  fill(ctx, circle(G.cheekL.x + fx, G.cheekL.y, G.cheekL.r), skin.cheek)
  fill(ctx, circle(G.cheekR.x + (side ? fx - 1 : 0), G.cheekR.y, G.cheekR.r), skin.cheek)
  shifted(ctx, fx + (side ? 1.5 : 0), () => drawPrims(ctx, look.face.eyeL))
  shifted(ctx, fx - (side ? 2 : 0), () => drawPrims(ctx, look.face.eyeR))
  shifted(ctx, fx + (side ? 1 : 0), () => drawPrims(ctx, look.face.mouth))
  ctx.restore()
  drawHairFront(ctx, look, false, 0)
  look.acc.draw?.(ctx, view, look, fx)
}

/* ── 합성 ────────────────────────────────────────────── */
const GROOM: Appearance = { skin: 1, hairStyle: 4, hairColor: 0, outfit: 0, outfitColor: 10, accessory: 0 }
const BRIDE: Appearance = { skin: 0, hairStyle: 11, hairColor: 1, outfit: 1, outfitColor: 11, accessory: VEIL_ACCESSORY }

function lookOf(kind: SpriteKind): Look {
  const a = kind === 'groom' ? GROOM : kind === 'bride' ? BRIDE : normalizeAppearance(kind)
  const outfit = OUTFITS[a.outfit]
  const acc = ACCESSORIES[a.accessory]
  return {
    skin: SKINS[a.skin],
    hair: HAIRS[a.hairStyle],
    hairColor: HAIR_COLORS[a.hairColor].hex,
    outfit,
    pal: outfit.pal(OUTFIT_COLORS[a.outfitColor].hex),
    acc,
    face: acc.face ?? (kind === 'bride' ? FACES.cute : FACES.smile),
  }
}

/** 머리 칸 좌표계에서 한 장면을 그린다 (좌우 반전·배율은 호출하는 쪽이 건다) */
export function render(ctx: C, look: Look, view: View, frame: Frame): void {
  const pose = poseOf(view, frame)
  const { outfit: o, pal, skin } = look
  const upper = (fn: () => void): void => {
    ctx.save()
    ctx.translate(pose.shiftX, pose.bob)
    fn()
    ctx.restore()
  }
  /** 머리는 상체와 함께 움직이고 턱 중심으로 기운다 */
  const headXf = (fn: () => void): void =>
    upper(() => {
      ctx.translate(CX, G.skull.y + G.skull.h)
      ctx.rotate(pose.tilt)
      ctx.translate(-CX, -(G.skull.y + G.skull.h))
      fn()
    })
  const leg: LegLook = { skin: skin.hex, kind: o.legs, color: pal.leg, sock: pal.sock, shoe: pal.shoe }
  const arm: ArmLook = { skin: skin.hex, sleeve: o.sleeve, color: pal.sleeve }
  const shoulderY = G.armPivotY
  const legAX = G.legLX + G.legW / 2
  const legBX = G.legRX + G.legW / 2

  if (view === 'side') {
    const farLeg: LegLook = { skin: far(leg.skin), kind: leg.kind, color: far(leg.color), sock: leg.sock && far(leg.sock), shoe: leg.shoe }
    const farArm: ArmLook = { skin: far(arm.skin), sleeve: arm.sleeve, color: far(arm.color) }
    headXf(() => {
      look.acc.behind?.(ctx, view, look)
      drawHairBack(ctx, look, view, pose)
    })
    upper(() => drawArm(ctx, CX + 3, shoulderY + 1, farArm, -pose.armB))
    drawLeg(ctx, CX + 2, farLeg, pose.legB.dy, pose.legB.rot, true)
    drawLeg(ctx, CX - 2, leg, pose.legA.dy, pose.legA.rot, true)
    upper(() => {
      drawTorso(ctx, view, o, pal, pose.sway)
      drawArm(ctx, CX - 2, shoulderY + 1, arm, -pose.armA)
      o.over?.(ctx, view, pal, CX)
    })
    headXf(() => drawHead(ctx, look, view, pose))
    return
  }
  const arms = (): void => {
    drawArm(ctx, G.bodyX + 2.5, shoulderY, arm, pose.armA)
    drawArm(ctx, G.bodyX + G.bodyW - 2.5, shoulderY, arm, -pose.armB)
  }
  if (view === 'front') {
    headXf(() => {
      look.acc.behind?.(ctx, view, look)
      drawHairBack(ctx, look, view, pose)
    })
  }
  drawLeg(ctx, legAX, leg, pose.legA.dy, 0, false)
  drawLeg(ctx, legBX, leg, pose.legB.dy, 0, false)
  if (view === 'front') {
    upper(() => {
      drawTorso(ctx, view, o, pal, pose.sway)
      arms()
      o.over?.(ctx, view, pal, CX)
    })
    headXf(() => drawHead(ctx, look, view, pose))
  } else {
    // 뒷모습: 머리카락(과 면사포)이 등과 팔을 덮는다
    upper(() => {
      drawTorso(ctx, view, o, pal, pose.sway)
      arms()
    })
    headXf(() => drawHead(ctx, look, view, pose))
  }
}

/* ── 캐시된 캔버스 (LRU) ───────────────────────────────── */
/** 기본 배율: 명목 1단위 = 2px (80x84) */
export const DEFAULT_SCALE = 2
/** getSprite 가 실제로 굽는 배율 상한 (명목 1단위당 픽셀) */
export const MAX_SCALE = 12
/** 캐시 상한: 개수와 총 픽셀 수(메모리) 둘 다 지킨다. 넘치면 가장 오래 안 쓴 것부터 버린다 */
export const CACHE_MAX_ENTRIES = 900
export const CACHE_MAX_PIXELS = 8_000_000

interface Entry {
  canvas: HTMLCanvasElement
  px: number
}
const cache = new Map<string, Entry>()
let cachePixels = 0

/** 캐시 키가 잘게 쪼개지지 않도록 0.05 단위로 맞추고 상·하한을 건다 */
function quantize(scale: number): number {
  const s = Number.isFinite(scale) ? scale : DEFAULT_SCALE
  return Math.min(MAX_SCALE, Math.max(0.25, Math.round(s * 20) / 20))
}
function keyOf(kind: SpriteKind, dir: Dir, frame: Frame, scale: number): string {
  const tail = `|${dir}|${frame}|${scale}`
  if (kind === 'groom' || kind === 'bride') return kind + tail
  const a = normalizeAppearance(kind)
  return `${a.skin},${a.hairStyle},${a.hairColor},${a.outfit},${a.outfitColor},${a.accessory}${tail}`
}

/**
 * 스프라이트 캔버스 (NEMO_W*scale x NEMO_H*scale 픽셀, 올림). 벡터라 어떤 scale 에서도 선명하다.
 * scale = 명목 1단위당 픽셀 수. 0.05 단위로 반올림, MAX_SCALE 로 제한.
 * (외형, 방향, 프레임, 배율)별로 LRU 캐시되므로 매 프레임 불러도 된다. 'left' 는 'right' 의 좌우 반전.
 */
export function getSprite(kind: SpriteKind, dir: Dir, frame: Frame, scale: number = DEFAULT_SCALE): HTMLCanvasElement {
  const sc = quantize(scale)
  const key = keyOf(kind, dir, frame, sc)
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit.canvas
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(NEMO_W * sc)
  canvas.height = Math.ceil(NEMO_H * sc)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const s = sc / DESIGN_PER_UNIT
    if (dir === 'left') ctx.setTransform(-s, 0, 0, s, (DESIGN_W - OX) * s, OY * s)
    else ctx.setTransform(s, 0, 0, s, OX * s, OY * s)
    const view: View = dir === 'down' ? 'front' : dir === 'up' ? 'back' : 'side'
    render(ctx, lookOf(kind), view, frame)
  }
  const px = canvas.width * canvas.height
  cache.set(key, { canvas, px })
  cachePixels += px
  for (const [k, e] of cache) {
    if (cache.size <= CACHE_MAX_ENTRIES && cachePixels <= CACHE_MAX_PIXELS) break
    if (k === key) break
    cache.delete(k)
    cachePixels -= e.px
  }
  return canvas
}
/** 배율이 바뀌었을 때(리사이즈 등) 이전 배율 캔버스를 비운다 */
export function clearSpriteCache(): void {
  cache.clear()
  cachePixels = 0
}
/** 캐시 상태 (개발·테스트용) */
export function spriteCacheStats(): { entries: number; pixels: number } {
  return { entries: cache.size, pixels: cachePixels }
}

/** 스타일 등록 정보 (registry.ts 의 STYLE_META 에 옮겨 적을 값) */
export const STYLE_INFO = {
  id: 'nemo',
  label: '네모 친구',
  nominalW: NEMO_W,
  nominalH: NEMO_H,
  footY: NEMO_FOOT_Y,
  pixelated: false,
  /** 머리카락 꼭대기(보통 y≈27)에서 발바닥까지 ÷ 전체 높이 */
  headFrac: (GROUND - 27) / (NEMO_H * DESIGN_PER_UNIT),
} as const

/* ── 랜덤 / 보정 ─────────────────────────────────────── */
const COUNTS: Record<PartKey, number> = {
  skin: SKINS.length,
  hairStyle: HAIRS.length,
  hairColor: HAIR_COLORS.length,
  outfit: OUTFITS.length,
  outfitColor: OUTFIT_COLORS.length,
  accessory: ACCESSORIES.length,
}
function randInt(rand: () => number, n: number): number {
  return Math.floor(rand() * n) % n
}
/**
 * 하객용 랜덤 외형. 신랑·신부 몫(턱시도·웨딩드레스·면사포)은 뽑지 않는다.
 * 치마·원피스는 긴 머리(SHORT_HAIRS 번부터)와, 바지 차림은 짧은 머리와 주로 묶고(4번 중 3번), 콧수염은 바지 차림 + 짧은 머리에만 준다.
 */
export function randomAppearance(rand: () => number = Math.random): Appearance {
  const outfit = COUPLE_OUTFITS.length + randInt(rand, COUNTS.outfit - COUPLE_OUTFITS.length)
  const feminine = OUTFITS[outfit].feminine
  const longCount = COUNTS.hairStyle - SHORT_HAIRS
  let hairStyle: number
  if (rand() < 0.75) hairStyle = feminine ? SHORT_HAIRS + randInt(rand, longCount) : randInt(rand, SHORT_HAIRS)
  else hairStyle = randInt(rand, COUNTS.hairStyle)
  // 면사포(마지막 번호)는 빼고 고른다
  let accessory = rand() < 0.45 ? 0 : 1 + randInt(rand, VEIL_ACCESSORY - 1)
  if (accessory === MOUSTACHE_ACCESSORY && (feminine || hairStyle >= SHORT_HAIRS)) accessory = 0
  return {
    skin: randInt(rand, COUNTS.skin),
    hairStyle,
    hairColor: randInt(rand, COUNTS.hairColor),
    outfit,
    outfitColor: randInt(rand, COUNTS.outfitColor),
    accessory,
  }
}
function clampIndex(v: unknown, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (Number.isNaN(n)) return 0
  const i = Math.round(n)
  if (!(i >= 0)) return 0
  if (i > max - 1) return max - 1
  return i
}
export function normalizeAppearance(input: unknown): Appearance {
  const o = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  return {
    skin: clampIndex(o.skin, COUNTS.skin),
    hairStyle: clampIndex(o.hairStyle, COUNTS.hairStyle),
    hairColor: clampIndex(o.hairColor, COUNTS.hairColor),
    outfit: clampIndex(o.outfit, COUNTS.outfit),
    outfitColor: clampIndex(o.outfitColor, COUNTS.outfitColor),
    accessory: clampIndex(o.accessory, COUNTS.accessory),
  }
}

export const PART_DEFS: PartDef[] = [
  { key: 'hairStyle', label: '머리 모양', options: HAIRS.map((h) => ({ label: h.label })) },
  { key: 'hairColor', label: '머리 색', options: HAIR_COLORS.map((c) => ({ label: c.label, swatch: c.hex })) },
  { key: 'outfit', label: '의상', options: OUTFITS.map((o) => ({ label: o.label })) },
  { key: 'outfitColor', label: '의상 색', options: OUTFIT_COLORS.map((c) => ({ label: c.label, swatch: c.hex })) },
  { key: 'accessory', label: '액세서리', options: ACCESSORIES.map((a) => ({ label: a.label })) },
  { key: 'skin', label: '피부', options: SKINS.map((c) => ({ label: c.label, swatch: c.hex })) },
]
export { SKINS, HAIR_COLORS, OUTFIT_COLORS }
