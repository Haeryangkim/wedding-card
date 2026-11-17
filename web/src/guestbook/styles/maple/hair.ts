/**
 * 머리 모양. 한 스타일은
 *   - cap  : 머리 위를 덮는 큰 덩어리. 얼굴 창(이목구비가 보이는 구간)에서는 bang(i) 까지만 내려오고
 *            창 바깥(옆머리)은 side 길이까지 내려온다. i = 얼굴 중심 기준 x 좌표(−9.5..9.5).
 *   - back : 몸 뒤로 넘어가는 긴 머리·묶은 머리 (정면/측면에서는 몸 뒤, 뒷모습에서는 몸 앞에 찍힌다)
 *   - extra: 캡 뒤에 따로 외곽선을 갖는 덩어리 (당고머리 등)
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

export interface HairDef {
  label: string
  /** 캡 맨 위 y (작을수록 볼륨이 크다) */
  top: number
  rx: number
  bang: (i: number) => number
  sideL: number
  sideR: number
  /** 뒷모습에서 머리카락이 내려오는 y */
  nape: number
  back?: (L: Layer, h: HairCtx) => void
  extra?: (L: Layer, h: HairCtx) => void
  /** 캡에 덧그리기 */
  deco?: (L: Layer, h: HairCtx) => void
}

const RY = 11.5
const N = 2.3

const tri = (i: number, period: number) => {
  const t = (((i % period) + period) % period) / period
  return t < 0.5 ? t * 2 : 2 - t * 2
}

export function drawCap(L: Layer, d: HairDef, h: HairCtx): void {
  const { m, view, f, hx } = h
  const cy = d.top + RY
  const fc = CX + 2 * f
  const wl = 14 + 3 * f
  const wr = 33 + f
  const x0 = Math.ceil(hx - d.rx)
  const x1 = Math.floor(hx + d.rx)
  for (let x = x0; x <= x1; x++) {
    const u = Math.abs(x - hx) / d.rx
    const dy = RY * Math.pow(Math.max(0, 1 - Math.pow(u, N)), 1 / N)
    const yTop = Math.round(cy - dy)
    let yBot: number
    if (view === 'back') {
      yBot = Math.min(Math.round(cy + dy), d.nape)
    } else if (x >= wl && x <= wr) {
      yBot = Math.round(d.bang(x - fc))
    } else {
      const len = x < wl ? d.sideL : d.sideR
      const e = x < wl ? x - x0 : x1 - x
      yBot = len - (e === 0 ? 3 : e === 1 ? 1 : 0)
      // 얼굴 쪽 안쪽 가닥은 살짝 짧게
      if (x === wl - 1 || x === wr + 1) yBot -= 1
    }
    for (let y = yTop; y <= yBot; y++) L.set(x, y, m.b)
  }
  d.deco?.(L, h)
  // 셀 셰이딩: 뒤쪽(오른쪽) 가장자리와 앞머리 끝에 음영, 정수리에 윤기
  L.rim(m.b, m.sh, 1, 0, 2)
  L.rim(m.b, m.sh, 0, 1, 1)
  if (view !== 'back') {
    // 앞머리 가닥 선: 길이가 급히 바뀌는 곳에 세로 음영
    for (let x = wl + 1; x <= wr; x++) {
      const a = Math.round(d.bang(x - fc))
      const b = Math.round(d.bang(x - 1 - fc))
      if (Math.abs(a - b) >= 2) L.on(() => L.col(a < b ? x : x - 1, Math.min(a, b) - 2, Math.min(a, b), m.sh))
    }
  }
  L.on(() => {
    for (let x = Math.round(hx - 9); x <= Math.round(hx + 2); x++) {
      if (x === Math.round(hx - 3)) continue
      const t = (x - hx + 3) / 8
      const y = d.top + 3 + Math.round(t * t * 2.2)
      if (L.get(x, y) === m.b) L.set(x, y, m.hi)
      if (x < hx - 4 && L.get(x, y + 1) === m.b) L.set(x, y + 1, m.hi)
    }
  })
}

function shadeBack(L: Layer, m: Mat): void {
  L.rim(m.b, m.sh, 1, 0, 2)
  L.rim(m.b, m.sh, 0, 1, 2)
  L.rim(m.b, m.hi, -1, 0, 1)
}

/** 아래로 늘어지는 긴 머리 (끝이 둥글다) */
function fall(L: Layer, h: HairCtx, half: number, y1: number, flare = 0): void {
  const cx = h.hx - (h.view === 'side' ? 1.5 : 0)
  for (let y = 20; y <= y1; y++) {
    const t = (y - 20) / (y1 - 20)
    let hw = half + flare * t
    const fromEnd = y1 - y
    if (fromEnd < 3) hw -= [3, 1.5, 0.5][fromEnd]
    L.row(y, Math.ceil(cx - hw), Math.floor(cx + hw), h.m.b)
  }
}

function strands(L: Layer, h: HairCtx, y0: number, y1: number, step = 5): void {
  L.on(() => {
    for (let x = Math.round(h.hx - 10); x <= h.hx + 10; x += step)
      for (let y = y0; y <= y1; y++) if (L.get(x, y) === h.m.b) L.set(x, y, h.m.sh)
  })
}

export const HAIRS: HairDef[] = [
  {
    label: '숏컷',
    top: 11,
    rx: 13.5,
    bang: (i) => 19 + [2, 3, 2, 1, 2, 3, 3, 2, 1, 0, 1, 2, 3, 2, 1, 2, 3, 2, 1, 1][Math.round(i + 9.5)] ,
    sideL: 28,
    sideR: 27,
    nape: 33,
  },
  {
    label: '가르마',
    top: 10,
    rx: 13.5,
    bang: (i) => 16 + Math.min(7, Math.abs(i - 3) * 0.95 + (i < 3 ? 1 : 0)),
    sideL: 29,
    sideR: 28,
    nape: 33,
  },
  {
    label: '단발',
    top: 11,
    rx: 14,
    bang: (i) => 21 + (Math.abs(i) > 7 ? 1 : 0) + (Math.round(i + 20) % 5 === 0 ? 1 : 0),
    sideL: 37,
    sideR: 37,
    nape: 34,
    back: (L, h) => {
      fall(L, h, 13.5, 37)
      shadeBack(L, h.m)
    },
  },
  {
    label: '긴 생머리',
    top: 11,
    rx: 13.5,
    bang: (i) => 17 + Math.abs(i + 1) * 0.62,
    sideL: 40,
    sideR: 40,
    nape: 34,
    back: (L, h) => {
      fall(L, h, 13, 51, 0.5)
      shadeBack(L, h.m)
      strands(L, h, 44, 50)
    },
  },
  {
    label: '긴 웨이브',
    top: 10,
    rx: 14,
    bang: (i) => 18 + Math.min(5, Math.abs(i - 4) * 0.5) + tri(i + 20, 4) * 1.2,
    sideL: 36,
    sideR: 36,
    nape: 34,
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
    },
  },
  {
    label: '포니테일',
    top: 11,
    rx: 13.5,
    bang: (i) => 21.4 - i * 0.22 + tri(i + 20, 5) * 1.6,
    sideL: 29,
    sideR: 27,
    nape: 33,
    back: (L, h) => {
      const m = h.m
      if (h.view === 'side') {
        // 뒤통수 위에서 뻗어 내려오는 꼬리
        L.ell(8.5, 20, 4, 4, m.b)
        L.ell(6.5, 26, 4, 5, m.b)
        L.ell(6, 33, 3.5, 5, m.b)
        L.ell(7, 39, 2.5, 3.5, m.b)
        shadeBack(L, m)
        L.rect(10, 17, 12, 20, h.tie.b)
      } else if (h.view === 'front') {
        L.ell(h.hx + 2, 9.5, 4.5, 3, m.b)
        L.ell(37.5, 26, 3.5, 8, m.b)
        L.ell(38.5, 35, 2.5, 5, m.b)
        shadeBack(L, m)
      } else {
        L.ell(h.hx, 22, 4.5, 4, m.b)
        L.ell(h.hx, 30, 5, 8, m.b)
        L.ell(h.hx, 40, 3.5, 5, m.b)
        shadeBack(L, m)
        L.rect(h.hx - 3, 19, h.hx + 3, 21, h.tie.b)
      }
    },
  },
  {
    label: '올림머리',
    top: 11,
    rx: 13.5,
    bang: (i) => 17.5 + Math.min(5, Math.abs(i - 2) * 0.6),
    sideL: 30,
    sideR: 29,
    nape: 32,
    extra: (L, h) => {
      const x = h.view === 'side' ? h.hx - 5 : h.hx
      L.ell(x, 8.5, 5.5, 5, h.m.b)
      L.rim(h.m.b, h.m.sh, 1, 0, 2)
      L.set(x - 2, 6, h.m.hi)
      L.set(x - 3, 7, h.m.hi)
      L.row(13, x - 4, x + 4, h.tie.b)
    },
  },
  {
    label: '양갈래',
    top: 11,
    rx: 13.5,
    bang: (i) => 21 + tri(i + 20, 4) * 1.5,
    sideL: 28,
    sideR: 28,
    nape: 33,
    back: (L, h) => {
      const m = h.m
      const s = h.view === 'side' ? -1 : 0
      for (const sx of [-1, 1]) {
        const x = h.hx + s + sx * (h.view === 'side' ? 14.5 : 15.5)
        L.ell(x, 25, 4, 5, m.b)
        L.ell(x + sx * 1, 32, 4.2, 6, m.b)
        L.ell(x + sx * 0.5, 40, 3, 4.5, m.b)
      }
      shadeBack(L, m)
      for (const sx of [-1, 1]) {
        const x = Math.round(h.hx + s + sx * 13.5)
        L.rect(x - 1, 20, x + 1, 22, h.tie.b)
      }
    },
  },
  {
    label: '곱슬 펌',
    top: 10,
    rx: 13.5,
    bang: (i) => 19.5 + (Math.round(i + 20) % 4 < 2 ? 1 : 0) + (Math.abs(i) > 6 ? 1 : 0),
    sideL: 31,
    sideR: 30,
    nape: 34,
    deco: (L, h) => {
      const cy = 10 + RY
      for (let k = 0; k <= 12; k++) {
        const a = Math.PI * (1.02 + (k / 12) * 0.96) // 왼쪽 → 위 → 오른쪽
        L.ell(h.hx + Math.cos(a) * 13, cy + Math.sin(a) * 11 + 1, 3.2, 3.2, h.m.b)
      }
      for (const sx of [-1, 1])
        for (let k = 0; k < 2; k++) L.ell(h.hx + sx * 13.5, 24 + k * 5, 3, 3, h.m.b)
      // 컬 무늬: 작은 갈고리 모양 음영
      L.on(() => {
        for (let r = 0; r < 4; r++)
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
  },
  {
    label: '포마드',
    top: 9,
    rx: 13.5,
    bang: (i) => 15.5 + Math.pow(Math.abs(i + 2) / 10, 2) * 6,
    sideL: 27,
    sideR: 26,
    nape: 32,
    deco: (L, h) => {
      // 넘긴 머리의 결
      L.on(() => {
        for (let k = 0; k < 3; k++)
          for (let t = 0; t < 7; t++) L.set(h.hx - 6 + k * 5 + t, 13 - Math.round(t * 0.5) + (k === 1 ? -1 : 0), h.m.sh)
      })
    },
  },
  {
    label: '반삭',
    top: 13,
    rx: 12.8,
    bang: (i) => 17 + (Math.abs(i) > 8 ? 2 : 0),
    sideL: 25,
    sideR: 24,
    nape: 30,
  },
  {
    label: '뱅 중단발',
    top: 11,
    rx: 14,
    bang: (i) => 22 - (Math.abs(i) > 8 ? 0 : 0) + (Math.abs(i) < 1 ? -1 : 0),
    sideL: 41,
    sideR: 41,
    nape: 34,
    back: (L, h) => {
      fall(L, h, 13.5, 43, 1)
      shadeBack(L, h.m)
      strands(L, h, 38, 42, 6)
    },
  },
]
