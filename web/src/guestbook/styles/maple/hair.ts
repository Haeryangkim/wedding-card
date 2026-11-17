/**
 * 머리 모양. 한 스타일은
 *   - cap  : 머리 위를 덮는 큰 덩어리. 얼굴 창(이목구비가 보이는 구간)에서는 bang 표(20칸, 손으로 다듬은 앞머리 선)
 *            까지만 내려오고 창 바깥(옆머리)은 side 길이까지 내려온다. crown 으로 정수리 실루엣(뻗친 머리·가르마 골·볼륨)을 다듬는다.
 *   - back : 몸 뒤로 넘어가는 긴 머리·묶은 머리 (정면/측면에서는 몸 뒤, 뒷모습에서는 몸 앞에 찍힌다)
 *   - extra: 캡 뒤에 따로 외곽선을 갖는 덩어리 (당고머리 등)
 *   - gloss: 스타일마다 다른 윤기 (천사링·가닥 윤기·결 따라 흐르는 윤기…)
 * 로 이뤄진다. 3/4 측면에서는 얼굴 창이 진행 방향으로 2px, 캡은 반대쪽으로 1px 밀린다 → 정면/측면/뒷면이 한 정의에서 나온다.
 */
import type { View } from './dims'
import { CX } from './body'
import type { Layer, Mat } from './raster'

export interface HairCtx {
  view: View
  f: 0 | 1
  /** 캡 중심 x */
  hx: number
  m: Mat
  /** 머리끈·장식 색 */
  tie: Mat
}

type Tips = 'taper' | 'in' | 'blunt'

export interface HairDef {
  label: string
  /** 캡 맨 위 y (작을수록 볼륨이 크다) */
  top: number
  rx: number
  /** 앞머리 끝 y — 얼굴 중심 기준 x(−9.5..9.5)를 20칸으로 나눈 표 */
  bang: number[]
  sideL: number
  sideR: number
  tips?: Tips
  /** 정수리 실루엣 보정: u = 캡 중심 기준 x, 반환값만큼 위로 솟는다(음수 = 골) */
  crown?: (u: number) => number
  /** 뒷모습에서 머리카락이 내려오는 y, napeFn 으로 목덜미 선을 다듬는다 */
  nape: number
  napeFn?: (u: number) => number
  back?: (L: Layer, h: HairCtx) => void
  /** true 면 뒷모습에서 back 을 캡과 한 덩어리로 그린다 (이음매 없는 긴 머리) */
  backMerge?: boolean
  extra?: (L: Layer, h: HairCtx) => void
  /** 캡에 덧그리기 (음영 전) */
  deco?: (L: Layer, h: HairCtx) => void
  /** 윤기·결 (음영 후) */
  gloss: (L: Layer, h: HairCtx, d: HairDef) => void
}

const RY = 11.5
const N = 2.3

function capDy(d: HairDef, hx: number, x: number): number {
  const u = Math.abs(x - hx) / d.rx
  return RY * Math.pow(Math.max(0, 1 - Math.pow(u, N)), 1 / N)
}
function topY(d: HairDef, hx: number, x: number): number {
  const dy = capDy(d, hx, x)
  const lift = dy > 4.5 ? (d.crown?.(x - hx) ?? 0) : 0
  return Math.round(d.top + RY - dy - lift)
}
function bangAt(d: HairDef, i: number): number {
  return d.bang[Math.max(0, Math.min(19, Math.round(i + 9.5)))]
}

/** 정수리 선을 따라 depth 만큼 안쪽에 흐르는 윤기 띠 (천사링). gaps = 끊기는 u */
function ring(L: Layer, h: HairCtx, d: HairDef, from: number, to: number, depth: number, gaps: number[] = []): void {
  L.on(() => {
    for (let u = from; u <= to; u++) {
      if (gaps.includes(u)) continue
      const x = Math.round(h.hx + u)
      const y = topY(d, h.hx, x) + depth
      if (L.get(x, y) === h.m.b) L.set(x, y, h.m.hi)
    }
  })
}
/** 짧은 사선·세로 윤기 가닥 */
function streak(L: Layer, h: HairCtx, x: number, y: number, len: number, slope = 0): void {
  L.on(() => {
    for (let k = 0; k < len; k++) {
      const px = Math.round(h.hx + x + k * slope)
      if (L.get(px, y + k) === h.m.b) L.set(px, y + k, h.m.hi)
    }
  })
}
/** 결(어두운 선) */
function groove(L: Layer, h: HairCtx, x: number, y: number, len: number, slope = 0): void {
  L.on(() => {
    for (let k = 0; k < len; k++) {
      const px = Math.round(h.hx + x + k * slope)
      const c = L.get(px, y + k)
      if (c === h.m.b || c === h.m.hi) L.set(px, y + k, h.m.sh)
    }
  })
}

export function drawCap(L: Layer, d: HairDef, h: HairCtx): void {
  const { m, view, f, hx } = h
  const cy = d.top + RY
  const fc = CX + 2 * f
  const wl = 14 + 3 * f
  const wr = 33 + f
  const x0 = Math.ceil(hx - d.rx)
  const x1 = Math.floor(hx + d.rx)
  const tips = d.tips ?? 'taper'
  for (let x = x0; x <= x1; x++) {
    const yTop = topY(d, hx, x)
    let yBot: number
    if (view === 'back') {
      yBot = Math.min(Math.round(cy + capDy(d, hx, x)), d.nape + Math.round(d.napeFn?.(x - hx) ?? 0))
    } else if (x >= wl && x <= wr) {
      yBot = bangAt(d, x - fc)
    } else {
      const len = x < wl ? d.sideL : d.sideR
      const e = x < wl ? x - x0 : x1 - x
      const innermost = x === wl - 1 || x === wr + 1
      if (tips === 'in') {
        // 끝이 얼굴 쪽으로 말린다: 바깥 모서리가 둥글고 안쪽 가닥이 가장 길다
        yBot = len - (e === 0 ? 3 : e === 1 ? 1 : 0)
      } else if (tips === 'blunt') {
        yBot = len - (e === 0 ? 1 : 0)
      } else {
        yBot = len - (e === 0 ? 3 : e === 1 ? 1 : 0) - (innermost ? 1 : 0)
      }
    }
    for (let y = yTop; y <= yBot; y++) L.set(x, y, m.b)
  }
  d.deco?.(L, h)
  if (view === 'back' && d.backMerge) d.back?.(L, h)
  // 셀 셰이딩: 뒤쪽(오른쪽) 가장자리와 앞머리 끝에 음영
  L.rim(m.b, m.sh, 1, 0, 2)
  L.rim(m.b, m.sh, 0, 1, 1)
  if (view !== 'back') {
    // 앞머리 가닥 선: 길이가 급히 바뀌는 곳에 세로 음영
    for (let x = wl + 1; x <= wr; x++) {
      const a = bangAt(d, x - fc)
      const b = bangAt(d, x - 1 - fc)
      if (Math.abs(a - b) >= 2) L.on(() => L.col(a < b ? x : x - 1, Math.min(a, b) - 2, Math.min(a, b), m.sh))
    }
  } else if (!d.backMerge) {
    backTexture(L, d, h)
  }
  d.gloss(L, h, d)
}

/** 뒷모습 캡: 가마에서 흘러내리는 가닥 결 */
function backTexture(L: Layer, d: HairDef, h: HairCtx): void {
  const m = h.m
  const y0 = d.top + 6
  L.on(() => {
    // 가마
    L.set(h.hx + 0.5, d.top + 3, m.sh)
    L.set(h.hx + 1.5, d.top + 4, m.sh)
    ;(d.deco ? [] : [-8, -3.5, 1.5, 6.5]).forEach((q, k) => {
      const yEnd = Math.min(d.nape - 1, 33)
      for (let y = y0 + (k % 3); y <= yEnd - (k % 2); y++) {
        if ((y + k * 4) % 7 === 0) continue
        const x = Math.round(h.hx + q * (1 + (y - y0) * 0.012))
        if (L.get(x, y) === m.b) L.set(x, y, m.sh)
      }
    })
  })
}

function shadeBack(L: Layer, m: Mat): void {
  L.rim(m.b, m.sh, 1, 0, 2)
  L.rim(m.b, m.sh, 0, 1, 2)
  L.rim(m.b, m.hi, -1, 0, 1)
}

/** 아래로 늘어지는 긴 머리. end: round = 둥근 끝, blunt = 일자, wisp = 가닥가닥 뾰족한 끝 */
function fall(L: Layer, h: HairCtx, half: number, y1: number, flare = 0, end: 'round' | 'blunt' | 'wisp' = 'round'): void {
  const cx = h.hx - (h.view === 'side' ? 0.5 : 0)
  for (let y = 20; y <= y1; y++) {
    const t = (y - 20) / (y1 - 20)
    let hw = half + flare * t
    const fromEnd = y1 - y
    if (end !== 'blunt' && fromEnd < 3) hw -= [3, 1.5, 0.5][fromEnd]
    if (end === 'blunt' && fromEnd === 0) hw -= 1
    L.row(y, Math.ceil(cx - hw), Math.floor(cx + hw), h.m.b)
  }
  if (end === 'wisp') {
    // 끝이 가닥으로 갈라진다
    for (let x = Math.ceil(cx - half); x <= cx + half; x++) {
      const k = (((x - Math.ceil(cx - half)) % 5) + 5) % 5
      if (k === 4) {
        L.erase(x, y1)
        L.erase(x, y1 - 1)
      } else if (k === 0 || k === 3) L.erase(x, y1)
    }
  }
}

/**
 * 긴 머리의 결. 뒷모습에서는 길고 촘촘하게(가닥마다 길이가 다르고 일부는 밝은 가닥이 붙는다),
 * 정면/측면에서는 끝부분만.
 */
function strands(L: Layer, h: HairCtx, y0: number, y1: number, wave = 0): void {
  const m = h.m
  const cx = h.hx - (h.view === 'side' ? 0.5 : 0)
  const back = h.view === 'back'
  const qs = back ? [-9.5, -5, -0.5, 4, 8.5] : [-10, -5, 0, 5, 10]
  L.on(() => {
    qs.forEach((q, k) => {
      const a = back ? y0 + (k % 3) * 2 : y0
      for (let y = a; y <= y1 - (k % 2); y++) {
        if (back && (y + k * 5) % 13 === 0) continue
        const x = Math.round(cx + q * (1 + (y - y0) * 0.006) + (wave ? Math.sin(y / 2.7 + k * 1.3) * wave : 0))
        if (L.get(x, y) !== m.b) continue
        L.set(x, y, m.sh)
        if (back && k % 2 === 1 && y < a + (y1 - a) * 0.55 && L.get(x - 1, y) === m.b) L.set(x - 1, y, m.hi)
      }
    })
  })
}

export const HAIRS: HairDef[] = [
  {
    label: '숏컷',
    top: 11,
    rx: 13.5,
    // 삐죽삐죽한 앞머리
    bang: [21, 22, 21, 20, 21, 22, 23, 22, 20, 19, 20, 21, 22, 21, 19, 20, 21, 22, 21, 20],
    sideL: 27,
    sideR: 27,
    // 뻗친 머리 두 가닥
    crown: (u) => (u >= 1 && u <= 3 ? 2 : u === 0 || u === 4 ? 1 : u >= -7 && u <= -5 ? 1 : 0),
    nape: 32,
    napeFn: (u) => (Math.abs(u) < 3 ? 1 : Math.abs(u) > 9 ? -2 : (Math.round(u) & 3) === 0 ? 1 : 0),
    gloss: (L, h, d) => {
      ring(L, h, d, -8, -4, 3)
      ring(L, h, d, 1, 3, 2)
      streak(L, h, -9, d.top + 6, 3, -0.4)
    },
  },
  {
    label: '가르마',
    top: 10,
    rx: 13.5,
    // 7:3 가르마 — 가르마 자리에서 이마가 드러난다
    bang: [22, 22, 22, 21, 21, 21, 20, 20, 19, 19, 18, 17, 16, 15, 16, 18, 19, 20, 21, 22],
    sideL: 29,
    sideR: 28,
    crown: (u) => (u >= 3 && u <= 5 ? -1 : u >= -7 && u <= 2 ? 1 : 0),
    nape: 33,
    napeFn: (u) => (Math.abs(u) < 5 ? 1 : Math.abs(u) > 9 ? -1 : 0),
    deco: (L, h) => {
      if (h.view === 'back') return
      // 가르마 선
      groove(L, h, 4 + 2 * h.f + h.f, 10, 6)
    },
    gloss: (L, h, d) => {
      ring(L, h, d, -9, 1, 4, [-4])
      ring(L, h, d, -9, -6, 5)
      ring(L, h, d, 7, 9, 4)
    },
  },
  {
    label: '단발',
    top: 11,
    rx: 14,
    // 시스루 뱅
    bang: [22, 22, 21, 22, 22, 21, 22, 22, 21, 22, 22, 21, 22, 22, 21, 22, 22, 21, 22, 22],
    sideL: 37,
    sideR: 37,
    tips: 'in',
    nape: 34,
    backMerge: true,
    back: (L, h) => {
      fall(L, h, 13.5, 38)
      shadeBack(L, h.m)
      if (h.view === 'back') strands(L, h, 21, 37)
    },
    gloss: (L, h, d) => {
      ring(L, h, d, -10, 9, 5, [-3, 4, 5])
      ring(L, h, d, -9, -5, 6)
    },
  },
  {
    label: '긴 생머리',
    top: 11,
    rx: 13.5,
    // 가운데 가르마 커튼 뱅
    bang: [21, 20, 20, 19, 19, 18, 18, 17, 16, 15, 15, 16, 17, 18, 18, 19, 19, 20, 20, 21],
    sideL: 40,
    sideR: 40,
    crown: (u) => (Math.abs(u) < 1 ? -1 : 0),
    nape: 34,
    backMerge: true,
    back: (L, h) => {
      fall(L, h, 13, 48, 0.5, 'wisp')
      shadeBack(L, h.m)
      strands(L, h, h.view === 'back' ? 21 : 41, 47)
    },
    gloss: (L, h, d) => {
      // 길게 흐르는 세로 윤기
      streak(L, h, -8, d.top + 4, 7, -0.15)
      streak(L, h, -6, d.top + 3, 4, -0.1)
      streak(L, h, 7, d.top + 5, 5, 0.15)
      if (h.view !== 'back') groove(L, h, 2 * h.f + h.f, d.top + 1, 4)
    },
  },
  {
    label: '긴 웨이브',
    top: 10,
    rx: 14.2,
    // 옆으로 넘긴 앞머리
    bang: [20, 19, 18, 17, 16, 16, 17, 18, 19, 19, 20, 20, 21, 21, 22, 22, 22, 21, 21, 20],
    sideL: 36,
    sideR: 36,
    crown: (u) => (u >= 0 && u <= 8 ? 1 : 0),
    nape: 34,
    backMerge: true,
    back: (L, h) => {
      const cx = h.hx - (h.view === 'side' ? 1.5 : 0)
      L.rect(cx - 11, 20, cx + 11, 46, h.m.b)
      for (let k = 0; k < 5; k++) {
        const y = 25 + k * 6
        const o = k % 2 ? 1.5 : 0
        L.ell(cx - 12.5 - o, y, 4, 4, h.m.b)
        L.ell(cx + 12.5 + o, y, 4, 4, h.m.b)
      }
      for (let k = -2; k <= 2; k++) L.ell(cx + k * 5.2, 47.5, 3.4, 3.4, h.m.b)
      shadeBack(L, h.m)
      if (h.view === 'back') strands(L, h, 21, 47, 1.5)
    },
    gloss: (L, h, d) => {
      // 물결 따라 끊어지는 윤기
      L.on(() => {
        for (let u = -9; u <= 6; u++) {
          if ((u + 9) % 4 === 3) continue
          const x = Math.round(h.hx + u)
          const y = topY(d, h.hx, x) + 3 + (((u + 9) % 4) === 1 ? 1 : 0)
          if (L.get(x, y) === h.m.b) L.set(x, y, h.m.hi)
        }
      })
    },
  },
  {
    label: '포니테일',
    top: 11,
    rx: 13.5,
    // 가볍게 내린 앞머리 + 긴 옆머리 한 가닥
    bang: [23, 22, 22, 21, 20, 21, 22, 21, 20, 21, 22, 21, 20, 21, 22, 21, 20, 21, 22, 22],
    sideL: 31,
    sideR: 27,
    nape: 31,
    napeFn: (u) => -Math.round(Math.abs(u) * 0.25),
    deco: (L, h) => {
      // 뒤로 당겨 묶은 결
      if (h.view === 'back') {
        for (const s of [-1, 1]) for (const k of [3, 6, 9]) groove(L, h, s * k, 26 - k * 0.3, 5, -s * 0.45)
      } else {
        groove(L, h, 3, 12, 4, 0.8)
        groove(L, h, 6, 14, 3, 0.8)
      }
    },
    back: (L, h) => {
      const m = h.m
      if (h.view === 'side') {
        // 뒤통수 위에서 뻗어 내려오는 꼬리
        L.ell(8.5, 20, 4, 4, m.b)
        L.ell(6.5, 26, 4, 5, m.b)
        L.ell(6, 33, 3.5, 5, m.b)
        L.ell(7.5, 39, 2.2, 3.5, m.b)
        shadeBack(L, m)
        L.on(() => {
          L.col(6, 23, 34, m.sh)
          L.col(4, 25, 30, m.hi)
        })
        L.rect(10, 17, 12, 20, h.tie.b)
        L.set(12, 20, h.tie.sh)
      } else if (h.view === 'front') {
        L.ell(h.hx + 2, 9.5, 4.5, 3, m.b)
        L.ell(37.5, 26, 3.5, 8, m.b)
        L.ell(38.5, 35, 2.5, 5, m.b)
        shadeBack(L, m)
      } else {
        L.ell(h.hx, 22, 4.5, 4, m.b)
        L.ell(h.hx, 30, 5, 8, m.b)
        L.ell(h.hx + 0.5, 40, 3.5, 5.5, m.b)
        L.ell(h.hx + 1, 46, 1.5, 2, m.b)
        shadeBack(L, m)
        L.on(() => {
          L.col(h.hx - 0.5, 25, 43, m.sh)
          L.col(h.hx - 2.5, 26, 36, m.hi)
          L.col(h.hx + 2.5, 28, 40, m.sh)
        })
        L.rect(h.hx - 3, 19, h.hx + 3, 21, h.tie.b)
        L.row(21, h.hx - 3, h.hx + 3, h.tie.sh)
      }
    },
    gloss: (L, h, d) => {
      ring(L, h, d, -8, -2, 3)
      ring(L, h, d, -8, -6, 4)
    },
  },
  {
    label: '올림머리',
    top: 11,
    rx: 13.3,
    // 우아하게 넘긴 앞머리 + 귀 옆 잔머리
    bang: [22, 21, 20, 20, 19, 19, 18, 18, 17, 17, 16, 16, 15, 15, 16, 17, 18, 19, 20, 21],
    sideL: 32,
    sideR: 30,
    nape: 30,
    napeFn: (u) => -Math.round(Math.abs(u) * 0.3) + (Math.abs(u) < 2 ? 1 : 0),
    deco: (L, h) => {
      if (h.view !== 'back') return
      // 위로 쓸어 올린 결
      for (const s of [-1, 1]) for (const k of [3, 8]) groove(L, h, s * k, 16, 11 - k * 0.5, s * 0.12)
    },
    extra: (L, h) => {
      const m = h.m
      const x = h.view === 'side' ? h.hx - 5 : h.hx
      L.ell(x, 8, 6, 5.5, m.b)
      L.rim(m.b, m.sh, 1, 0, 2)
      L.on(() => {
        // 틀어 올린 결
        for (let k = 0; k < 6; k++) L.set(x - 3 + k, 9 - Math.round(Math.sin((k / 5) * Math.PI) * 2.4), m.sh)
        L.set(x + 2, 9, m.sh)
        L.set(x - 3, 5, m.hi)
        L.set(x - 4, 6, m.hi)
        L.set(x - 4, 7, m.hi)
      })
      L.row(13, x - 5, x + 5, h.tie.b)
      L.row(14, x - 4, x + 4, h.tie.sh)
    },
    gloss: (L, h, d) => {
      ring(L, h, d, -9, -2, 5, [-5])
    },
  },
  {
    label: '양갈래',
    top: 11,
    rx: 13.5,
    // M자 앞머리
    bang: [20, 21, 22, 22, 22, 21, 20, 19, 20, 21, 21, 20, 19, 20, 21, 22, 22, 22, 21, 20],
    sideL: 27,
    sideR: 27,
    crown: (u) => (Math.abs(u) < 1 ? -1 : 0),
    nape: 32,
    napeFn: (u) => (Math.abs(u) < 2 ? 1 : 0),
    deco: (L, h) => {
      // 가운데 가르마가 뒤통수까지
      if (h.view === 'back') groove(L, h, 0, 12, 19)
      else groove(L, h, 3 * h.f, 11, 5)
    },
    back: (L, h) => {
      const m = h.m
      const s = h.view === 'side' ? -1 : 0
      for (const sx of [-1, 1]) {
        const x = h.hx + s + sx * (h.view === 'side' ? 14.5 : 15.5)
        L.ell(x, 25, 4, 5, m.b)
        L.ell(x + sx * 1, 32, 4.2, 6, m.b)
        L.ell(x + sx * 0.5, 40, 3, 4.5, m.b)
        L.ell(x, 45, 1.5, 2, m.b)
      }
      shadeBack(L, m)
      L.on(() => {
        for (const sx of [-1, 1]) {
          const x = Math.round(h.hx + s + sx * 15.5)
          L.col(x, 27, 41, m.sh)
          L.col(x - 2, 29, 35, m.hi)
        }
      })
      for (const sx of [-1, 1]) {
        const x = Math.round(h.hx + s + sx * 13.5)
        L.rect(x - 1, 20, x + 1, 22, h.tie.b)
        L.set(x + 1, 22, h.tie.sh)
      }
    },
    gloss: (L, h, d) => {
      ring(L, h, d, -9, -3, 4)
      ring(L, h, d, 3, 8, 4)
    },
  },
  {
    label: '곱슬 펌',
    top: 10,
    rx: 13.5,
    bang: [21, 22, 21, 20, 19, 20, 21, 22, 21, 20, 19, 20, 21, 22, 21, 20, 19, 20, 21, 22],
    sideL: 31,
    sideR: 30,
    nape: 34,
    deco: (L, h) => {
      const cy = 10 + RY
      // 몽글몽글한 실루엣: 큰 컬 덩어리를 성기게 얹는다
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI * (1.04 + (k / 6) * 0.92) // 왼쪽 → 위 → 오른쪽
        L.ell(h.hx + Math.cos(a) * 12.5, cy + Math.sin(a) * 10.5 + 1, 3.6, 3.4, h.m.b)
      }
      for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) L.ell(h.hx + sx * 13.5, 24 + k * 5, 3, 3, h.m.b)
      // 컬 무늬: 작은 갈고리 모양 음영
      const rows = h.view === 'back' ? 6 : 4
      L.on(() => {
        for (let r = 0; r < rows; r++)
          for (let k = -2; k <= 2; k++) {
            const x = Math.round(h.hx + k * 5 + (r % 2 ? 2.5 : 0))
            const y = 13 + r * 4
            if (L.get(x, y) !== h.m.b || L.get(x + 1, y + 2) !== h.m.b) continue
            L.set(x, y, h.m.sh)
            L.set(x + 1, y + 1, h.m.sh)
            L.set(x, y + 2, h.m.sh)
            L.set(x - 1, y + 1, h.m.hi)
          }
      })
    },
    gloss: () => {},
  },
  {
    label: '포마드',
    top: 10,
    rx: 13.2,
    // 이마를 드러내고 넘긴 머리
    bang: [20, 19, 18, 17, 16, 16, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 16, 17, 18, 19],
    sideL: 26,
    sideR: 25,
    // 앞쪽으로 솟은 볼륨(퀴프)
    crown: (u) => (u >= 2 && u <= 6 ? 3 : u >= 0 && u <= 8 ? 2 : u >= -3 && u <= 10 ? 1 : 0),
    nape: 31,
    napeFn: (u) => (Math.abs(u) > 8 ? -2 : Math.abs(u) > 5 ? -1 : 0),
    deco: (L, h) => {
      if (h.view === 'back') return
      // 빗어 넘긴 결
      groove(L, h, -7, 14, 5, 1.3)
      groove(L, h, -2, 13, 5, 1.3)
      groove(L, h, 4, 12, 4, 1.3)
    },
    gloss: (L, h, d) => {
      streak(L, h, -5, d.top + 3, 4, 1.3)
      streak(L, h, 1, d.top, 4, 1.3)
      streak(L, h, 2, d.top + 1, 3, 1.3)
    },
  },
  {
    label: '반삭',
    top: 13,
    rx: 12.7,
    bang: [19, 18, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 18, 19],
    sideL: 25,
    sideR: 24,
    tips: 'blunt',
    nape: 29,
    napeFn: (u) => (Math.abs(u) > 7 ? -1 : 0),
    deco: (L, h) => {
      // 옆·뒤를 짧게 친 페이드: 아래쪽을 점점 성기게
      const y0 = h.view === 'back' ? 24 : 20
      L.on(() => {
        for (let y = y0 + 1; y <= 31; y++)
          for (let x = 8; x <= 40; x++)
            if (L.get(x, y) === h.m.b && (x + y) % 2 === 0 && (y > y0 + 2 || x % 2 === 0)) L.set(x, y, h.m.hi)
      })
    },
    gloss: (L, h, d) => {
      streak(L, h, -6, d.top + 2, 2, -1)
    },
  },
  {
    label: '뱅 중단발',
    top: 11,
    rx: 14.2,
    // 일자 뱅 (히메컷)
    bang: [23, 23, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23, 23],
    sideL: 41,
    sideR: 41,
    tips: 'blunt',
    nape: 34,
    backMerge: true,
    back: (L, h) => {
      fall(L, h, 13.7, 44, 0.6, 'blunt')
      shadeBack(L, h.m)
      strands(L, h, h.view === 'back' ? 21 : 38, 43)
    },
    gloss: (L, h, d) => {
      // 넓은 천사링 두 줄
      ring(L, h, d, -11, 10, 6, [-2, 5])
      ring(L, h, d, -10, -4, 7)
      ring(L, h, d, 6, 9, 7)
    },
  },
]
