/**
 * 액세서리. face = 얼굴 위에 외곽선 없이 덧그림, over = 머리카락 위에 외곽선과 함께, neck = 목 아래.
 */
import type { View } from './dims'
import { EYE_Y0, EYE_Y1, eyeBoxes } from './body'
import { FIX, hex } from './palette'
import { mat, type Layer, type Mat } from './raster'

export interface AccCtx {
  view: View
  f: 0 | 1
  /** 머리카락 캡 중심 x, 맨 위 y */
  hx: number
  top: number
  /** 얼굴 중심 x */
  fc: number
  hair: Mat
}

export interface AccDef {
  label: string
  face?: (L: Layer, a: AccCtx) => void
  over?: (L: Layer, a: AccCtx) => void
  neck?: (L: Layer, a: AccCtx) => void
}

function flower(L: Layer, x: number, y: number, petal: Mat, core: Mat): void {
  L.rect(x - 1, y - 2, x, y + 1, petal.b)
  L.rect(x - 2, y - 1, x + 1, y, petal.b)
  L.set(x, y + 1, petal.sh)
  L.set(x + 1, y, petal.sh)
  L.set(x - 1, y - 1, core.b)
  L.set(x, y - 1, core.b)
  L.set(x - 1, y, core.b)
  L.set(x, y, core.sh)
}

export const ACCESSORIES: AccDef[] = [
  { label: '없음' },
  {
    label: '안경',
    face: (L, a) => {
      if (a.view === 'back') return
      const c = mat(hex('#5a4046')).b
      const [l, r] = eyeBoxes(a.f)
      for (const e of [l, r]) {
        const x1 = e.x + e.w - 1
        L.row(EYE_Y0 - 1, e.x - 1, x1 + 1, c)
        L.row(EYE_Y1 + 1, e.x, x1, c)
        L.col(e.x - 1, EYE_Y0, EYE_Y1, c)
        L.col(x1 + 1, EYE_Y0, EYE_Y1, c)
      }
      L.row(EYE_Y0 + 1, l.x + l.w + 1, r.x - 2, c)
      if (a.view === 'side') L.row(EYE_Y0 + 1, 13, l.x - 2, c)
    },
  },
  {
    label: '선글라스',
    face: (L, a) => {
      if (a.view === 'back') return
      const m = mat(hex('#3a3848'))
      const [l, r] = eyeBoxes(a.f)
      for (const e of [l, r]) {
        const x1 = e.x + e.w - 1
        L.rect(e.x - 1, EYE_Y0 - 1, x1 + 1, EYE_Y1 - 1, m.b)
        L.row(EYE_Y1, e.x, x1, m.b)
        L.row(EYE_Y0 - 2, e.x - 1, x1 + 1, m.ln)
        L.set(e.x, EYE_Y0, m.hi)
        L.set(e.x + 1, EYE_Y0 + 1, m.hi)
      }
      L.row(EYE_Y0 - 1, l.x + l.w + 1, r.x - 2, m.ln)
      L.row(EYE_Y0 - 1, 12, l.x - 2, m.ln)
    },
  },
  {
    label: '리본',
    over: (L, a) => {
      const m = mat(FIX.red)
      const x = Math.round(a.hx + (a.view === 'back' ? 0 : 6))
      const y = a.top + (a.view === 'back' ? 7 : 1)
      // 매듭에서 바깥으로 벌어지는 두 날개
      for (const sd of [-1, 1])
        for (let k = 1; k <= 5; k++) {
          const hh = k === 5 ? 2 : Math.min(3, k)
          L.col(x + sd * (k + 1), y - hh, y + hh, m.b)
        }
      L.rim(m.b, m.sh, 0, 1, 1)
      for (const sd of [-1, 1]) {
        L.set(x + sd * 4, y - 2, m.hi)
        L.set(x + sd * 3, y, m.sh)
      }
      L.rect(x - 1, y - 1, x + 1, y + 1, m.b)
      L.set(x, y, m.hi)
      L.set(x + 1, y + 1, m.sh)
    },
  },
  {
    label: '꽃핀',
    over: (L, a) => {
      const x = Math.round(a.view === 'back' ? a.hx + 9 : a.hx - 8)
      flower(L, x, a.top + 8, mat(FIX.pink), mat(FIX.gold))
      L.set(x + 2, a.top + 10, mat(FIX.leaf).b)
      L.set(x + 2, a.top + 9, mat(FIX.leaf).b)
    },
  },
  {
    label: '밀짚모자',
    over: (L, a) => {
      const m = mat(FIX.straw)
      const band = mat(FIX.red)
      const t = a.top
      L.ell(a.hx, t + 0.5, 9.5, 6, m.b, 3)
      L.rect(a.hx - 9, t + 1, a.hx + 9, t + 3, band.b)
      L.ell(a.hx, t + 5, 16, 2.6, m.b)
      L.rim(m.b, m.sh, 0, 1, 1)
      L.rim(m.b, m.sh, 1, 0, 2)
      L.on(() => L.row(t - 3, a.hx - 6, a.hx - 2, m.hi))
    },
  },
  {
    label: '나비넥타이',
    neck: (L, a) => {
      if (a.view === 'back') return
      const m = mat(FIX.red)
      const x = a.fc - a.f
      const y = 38
      for (const s of [-1, 1]) {
        L.rect(x + s * 2.5, y - 1, x + s * 2.5, y + 1, m.b)
        L.rect(x + s * 3.5, y - 2, x + s * 3.5, y + 2, m.b)
        L.set(x + s * 3.5, y + 2, m.sh)
      }
      L.rect(x - 0.5, y - 1, x + 0.5, y + 1, m.sh)
    },
  },
  {
    label: '헤드폰',
    over: (L, a) => {
      const band = mat(hex('#55586a'))
      const cup = mat(hex('#f07c8c'))
      const t = a.top
      for (let x = Math.round(a.hx - 13); x <= a.hx + 13; x++) {
        const u = (x - a.hx) / 13.8
        const y = Math.round(t + 11.5 - 12.6 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.3)), 1 / 2.3))
        L.set(x, y, band.b)
        L.set(x, y - 1, band.b)
      }
      if (a.view === 'side') {
        L.ell(a.hx - 9.5, 25, 3.6, 4.6, cup.b)
        L.ell(a.hx - 9.5, 25, 1.4, 2.2, cup.sh)
      } else {
        L.ell(a.hx - 13.5, 25, 2.6, 4.6, cup.b)
        L.ell(a.hx + 13.5, 25, 2.6, 4.6, cup.b)
      }
      L.rim(cup.b, cup.sh, 0, 1, 1)
    },
  },
  {
    label: '화관',
    over: (L, a) => {
      const leaf = mat(FIX.leaf)
      const pet = [mat(FIX.pink), mat(FIX.white), mat(hex('#f6dc70'))]
      for (let x = Math.round(a.hx - 12); x <= a.hx + 12; x++) {
        const u = (x - a.hx) / 12
        L.set(x, a.top + 4 + Math.round(u * u * 4), leaf.b)
      }
      for (let k = -3; k <= 3; k++) {
        const x = Math.round(a.hx + k * 3.9)
        const u = (k * 3.9) / 12
        const p = pet[(k + 3) % 3]
        flower(L, x, a.top + 4 + Math.round(u * u * 4), p, p === pet[2] ? mat(FIX.white) : mat(FIX.gold))
      }
    },
  },
  {
    label: '고양이 귀',
    over: (L, a) => {
      const m = a.hair
      const inner = mat(FIX.pink)
      for (const s of [-1, 1]) {
        const x = Math.round(a.hx + s * 8)
        for (let k = 0; k < 6; k++) L.row(a.top - 4 + k, x - k * 0.7 - 0.5, x + k * 0.7 + 0.5, m.b)
        for (let k = 2; k < 5; k++) L.row(a.top - 4 + k, x - (k - 2) * 0.6, x + (k - 2) * 0.6, inner.b)
      }
      L.rim(m.b, m.sh, 1, 0, 1)
    },
  },
]
