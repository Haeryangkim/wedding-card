/**
 * 의상. 한 벌 = 다리 재질 · 신발 · 소매 종류 + 몸통 층에 그리는 함수(상의/치마/세부).
 * 치마·드레스는 몸통과 같은 층에 그려 다리 위를 덮는다.
 */
import type { View } from './dims'
import { CX, type Sleeve } from './body'
import { FIX, hex, lum, mix, tone, withL, type RGB } from './palette'
import { mat, type Layer, type Mat } from './raster'

export interface OutfitCtx {
  L: Layer
  view: View
  /** 정면 세부의 중심 x (3/4 측면에서는 1px 밀린다) */
  cx: number
  C: Mat
  base: RGB
  skin: Mat
  W: Mat
}

export interface OutfitDef {
  label: string
  sleeve: Sleeve
  /** 소매 재질 */
  sleeveMat: (c: RGB) => RGB
  /** 소매 끝단 색 (없으면 생략) */
  cuff?: (c: RGB) => RGB
  /** 다리 재질. null = 맨다리 */
  legs: ((c: RGB) => RGB) | null
  wideLegs?: boolean
  shoe: (c: RGB) => RGB
  draw: (o: OutfitCtx) => void
}

/** 몸통 기본 실루엣 */
function torso(L: Layer, c: number, y1 = 48): void {
  L.rect(17, 35, 30, 37, c)
  L.rect(18, 38, 29, y1, c)
}

/** 목에서 내려오는 V */
function vee(L: Layer, cx: number, depth: number, c: number, y0 = 35, slope = 0.62): void {
  L.on(() => {
    for (let k = 0; k < depth; k++) {
      const hw = (depth - k) * slope
      L.row(y0 + k, Math.ceil(cx - hw), Math.floor(cx + hw), c)
    }
  })
}

function shadeTorso(L: Layer, m: Mat): void {
  L.rim(m.b, m.sh, 1, 0, 1)
  L.rim(m.b, m.sh, 0, 1, 1)
}

function skirt(L: Layer, y0: number, y1: number, h0: number, h1: number, c: number, curve = 1): void {
  L.span(y0, y1, CX, (t) => h0 + (h1 - h0) * Math.pow(t, curve), c)
}

/** 넥타이·포인트 색: 옷 색과 겹치지 않게 */
function accent(base: RGB): RGB {
  const [r, g, b] = base
  return r > 170 && g < 130 && b < 130 ? FIX.gold : FIX.red
}

const darker = (c: RGB) => tone(c, 0.82)
const charcoal = () => hex('#4c4e60')
const sneaker = () => FIX.white
const blackShoe = () => FIX.black
const brownShoe = () => FIX.brown
const pastel = (c: RGB) => withL(c, Math.max(0.86, lum(c)), 0.75)

export const OUTFITS: OutfitDef[] = [
  {
    label: '정장',
    sleeve: 'long',
    sleeveMat: (c) => c,
    legs: darker,
    shoe: blackShoe,
    draw: ({ L, view, cx, C, W, base }) => {
      torso(L, C.b)
      if (view === 'back') {
        shadeTorso(L, C)
        L.col(23, 43, 48, C.sh)
        return
      }
      vee(L, cx, 9, C.sh)
      vee(L, cx, 8, W.b)
      const tie = mat(accent(base))
      L.rect(cx - 0.5, 37, cx + 0.5, 41, tie.b)
      L.row(36, cx - 0.5, cx + 0.5, tie.sh)
      L.set(cx + 0.5, 42, tie.sh)
      L.set(cx + 0.5, 45, C.ln)
      L.set(cx + 0.5, 47, C.ln)
      L.row(40, 19, 20, W.b) // 행커치프
      shadeTorso(L, C)
    },
  },
  {
    label: '셔츠',
    sleeve: 'long',
    sleeveMat: (c) => c,
    cuff: (c) => tone(c, 1.18, 0.8),
    legs: charcoal,
    shoe: brownShoe,
    draw: ({ L, view, cx, C }) => {
      torso(L, C.b)
      L.row(47, 18, 29, mat(FIX.brown).b)
      L.row(48, 18, 29, mat(charcoal()).b)
      if (view !== 'back') {
        L.col(cx + 0.5, 38, 46, C.sh)
        // 깃
        L.row(36, cx - 3.5, cx - 1.5, C.hi)
        L.row(36, cx + 1.5, cx + 3.5, C.hi)
        L.set(cx - 1.5, 37, C.hi)
        L.set(cx + 1.5, 37, C.hi)
        L.set(cx + 0.5, 47, mat(FIX.gold).b)
      }
      shadeTorso(L, C)
    },
  },
  {
    label: '가디건',
    sleeve: 'long',
    sleeveMat: (c) => c,
    legs: () => FIX.beige,
    shoe: sneaker,
    draw: ({ L, view, cx, C, W }) => {
      torso(L, C.b)
      if (view !== 'back') {
        L.on(() => {
          L.rect(cx - 2.5, 35, cx + 2.5, 48, W.b)
          L.col(cx - 3.5, 36, 48, C.sh)
          L.col(cx + 3.5, 36, 48, C.hi)
          for (const y of [40, 43, 46]) L.set(cx + 4.5, y, C.ln)
          L.row(36, cx - 1.5, cx + 1.5, W.sh)
        })
      }
      L.row(48, 18, 29, C.sh)
      shadeTorso(L, C)
    },
  },
  {
    label: '후드티',
    sleeve: 'long',
    sleeveMat: (c) => c,
    cuff: (c) => tone(c, 0.8),
    legs: () => FIX.denim,
    shoe: sneaker,
    draw: ({ L, view, cx, C, W }) => {
      torso(L, C.b)
      if (view === 'back') {
        L.on(() => L.ell(CX, 37, 6.5, 4.5, C.sh))
        L.on(() => L.ell(CX, 36.5, 5.5, 3.5, C.b))
      } else {
        L.on(() => {
          L.ell(cx, 35.5, 5.5, 3.2, C.sh)
          L.ell(cx, 34.5, 3.5, 2.4, W.sh)
          L.col(cx - 1.5, 38, 41, W.b)
          L.col(cx + 1.5, 38, 40, W.b)
          // 캥거루 포켓
          L.row(43, 20, 27, C.sh)
          L.col(20, 44, 47, C.sh)
          L.col(27, 44, 47, C.sh)
        })
      }
      L.row(48, 18, 29, C.sh)
      shadeTorso(L, C)
    },
  },
  {
    label: '원피스',
    sleeve: 'short',
    sleeveMat: (c) => c,
    legs: null,
    shoe: (c) => tone(c, 0.62),
    draw: ({ L, view, cx, C, W }) => {
      torso(L, C.b, 44)
      skirt(L, 44, 53, 6.5, 10.5, C.b, 0.8)
      L.on(() => {
        L.row(44, 17, 30, C.sh)
        L.row(52, 12, 35, C.hi)
        for (const x of [17, 22, 26, 30]) L.col(x, 47, 51, C.sh)
      })
      if (view !== 'back') {
        L.on(() => {
          L.rect(cx - 3.5, 35, cx - 0.5, 37, W.b)
          L.rect(cx + 0.5, 35, cx + 3.5, 37, W.b)
          L.set(cx - 3.5, 37, C.b)
          L.set(cx + 3.5, 37, C.b)
          L.set(cx + 0.5, 40, W.b)
          L.set(cx + 0.5, 42, W.b)
        })
      }
      shadeTorso(L, C)
    },
  },
  {
    label: '롱드레스',
    sleeve: 'none',
    sleeveMat: (c) => c,
    legs: null,
    shoe: (c) => tone(c, 0.7),
    draw: ({ L, view, cx, C, skin }) => {
      torso(L, C.b, 44)
      L.rect(17, 35, 30, 37, skin.b)
      L.col(19, 35, 37, C.b)
      L.col(28, 35, 37, C.b)
      skirt(L, 44, 60, 6.5, 12.5, C.b, 0.7)
      L.on(() => {
        L.rect(17, 44, 30, 45, C.hi)
        for (const x of [16, 21, 27, 31]) L.col(x, 49, 59, C.sh)
        L.row(60, 10, 37, C.sh)
        if (view !== 'back') {
          L.set(cx - 0.5, 38, skin.b)
          L.set(cx + 0.5, 38, skin.b)
          L.set(cx + 3.5, 41, C.hi)
          L.set(cx - 5, 52, C.hi)
          L.set(cx + 6, 55, C.hi)
        }
      })
      shadeTorso(L, C)
    },
  },
  {
    label: '블라우스',
    sleeve: 'long',
    sleeveMat: () => FIX.white,
    legs: null,
    shoe: brownShoe,
    draw: ({ L, view, cx, C, W }) => {
      torso(L, W.b, 43)
      skirt(L, 43, 53, 6.5, 9.5, C.b)
      L.on(() => {
        for (const x of [16, 19, 22, 25, 28, 31]) L.col(x, 46, 53, C.sh)
        L.row(43, 17, 30, C.hi)
      })
      if (view !== 'back') {
        // 리본 타이
        L.on(() => {
          L.rect(cx - 3.5, 36, cx - 1.5, 38, C.b)
          L.rect(cx + 1.5, 36, cx + 3.5, 38, C.b)
          L.rect(cx - 0.5, 36, cx + 0.5, 37, C.sh)
          L.col(cx - 1.5, 39, 41, C.b)
          L.col(cx + 1.5, 39, 40, C.b)
        })
      }
      shadeTorso(L, W)
      shadeTorso(L, C)
    },
  },
  {
    label: '한복',
    sleeve: 'wide',
    sleeveMat: pastel,
    cuff: (c) => c,
    legs: () => FIX.white,
    shoe: () => FIX.white,
    draw: ({ L, view, cx, C, W, base, skin }) => {
      const J = mat(pastel(base))
      const rib = mat(tone(base, 0.72, 1.1))
      // 치마: 가슴께부터 풍성하게
      skirt(L, 40, 60, 7, 13.5, C.b, 0.55)
      L.on(() => {
        for (const x of [14, 19, 24, 29, 33]) L.col(x, 47, 59, C.sh)
        L.row(60, 9, 38, C.sh)
        L.row(57, 9, 38, C.hi)
      })
      // 저고리
      L.rect(17, 35, 30, 37, J.b)
      L.rect(18, 38, 29, 41, J.b)
      L.row(41, 18, 29, J.sh)
      if (view !== 'back') {
        L.on(() => {
          vee(L, cx, 6, W.b)
          vee(L, cx, 4, skin.b)
          // 고름
          L.rect(cx + 1.5, 39, cx + 2.5, 40, rib.b)
          L.col(cx + 1.5, 41, 50, rib.b)
          L.col(cx + 3.5, 41, 47, rib.b)
          L.col(cx + 2.5, 41, 42, rib.sh)
        })
      }
      L.rim(J.b, J.sh, 1, 0, 1)
      shadeTorso(L, C)
    },
  },
  {
    label: '남자 한복',
    sleeve: 'wide',
    sleeveMat: () => hex('#f0e8d8'),
    legs: () => hex('#e6dece'),
    wideLegs: true,
    shoe: blackShoe,
    draw: ({ L, view, cx, C, W }) => {
      const J = mat(hex('#f0e8d8'))
      // 배자(조끼형 덧옷): 허리 아래까지 내려온다
      torso(L, C.b, 51)
      if (view !== 'back') {
        L.on(() => {
          L.rect(cx - 2, 35, cx + 2, 51, J.b)
          vee(L, cx, 6, W.b, 35, 0.75)
          vee(L, cx, 4, J.sh, 35, 0.7)
          L.col(cx - 3, 38, 51, C.hi)
          L.col(cx + 3, 38, 51, C.sh)
          // 매듭 단추
          L.set(cx - 0.5, 43, mat(FIX.gold).b)
          L.set(cx + 0.5, 43, mat(FIX.gold).b)
          L.row(51, 18, 29, C.sh)
        })
      } else {
        L.col(23, 44, 51, C.sh)
      }
      shadeTorso(L, C)
    },
  },
  {
    label: '조끼',
    sleeve: 'long',
    sleeveMat: () => FIX.white,
    legs: darker,
    shoe: brownShoe,
    draw: ({ L, view, cx, C, W, base }) => {
      torso(L, C.b)
      L.rect(17, 35, 30, 36, W.b)
      if (view !== 'back') {
        vee(L, cx, 10, W.b, 35, 0.6)
        const tie = mat(accent(base))
        L.rect(cx - 0.5, 37, cx + 0.5, 42, tie.b)
        L.row(36, cx - 0.5, cx + 0.5, tie.sh)
        for (const y of [45, 47]) L.set(cx + 0.5, y, mat(FIX.gold).b)
        L.col(cx - 0.5, 44, 48, C.sh)
      } else {
        L.row(44, 20, 27, C.sh)
      }
      shadeTorso(L, C)
    },
  },
  {
    label: '멜빵바지',
    sleeve: 'short',
    sleeveMat: () => FIX.white,
    legs: (c) => c,
    shoe: brownShoe,
    draw: ({ L, view, cx, C, W }) => {
      torso(L, W.b)
      L.rect(18, 44, 29, 48, C.b)
      L.on(() => {
        const s = view === 'back' ? CX : cx
        L.col(s - 3.5, 35, 43, C.b)
        L.col(s - 2.5, 35, 43, C.b)
        L.col(s + 2.5, 35, 43, C.b)
        L.col(s + 3.5, 35, 43, C.b)
        if (view !== 'back') {
          L.rect(s - 3.5, 40, s + 3.5, 44, C.b)
          L.set(s - 3.5, 40, mat(FIX.gold).b)
          L.set(s + 3.5, 40, mat(FIX.gold).b)
          L.row(42, s - 1.5, s + 1.5, C.sh)
        }
      })
      shadeTorso(L, W)
      shadeTorso(L, C)
    },
  },
]

/* ── 신랑 · 신부 전용 ─────────────────────────────────────── */
export const TUXEDO: OutfitDef = {
  label: '턱시도',
  sleeve: 'long',
  sleeveMat: (c) => c,
  cuff: () => FIX.white,
  legs: (c) => c,
  shoe: () => hex('#2a2732'),
  draw: ({ L, view, cx, C, W }) => {
    torso(L, C.b)
    if (view === 'back') {
      shadeTorso(L, C)
      L.col(23, 42, 48, C.sh)
      return
    }
    vee(L, cx, 10, C.hi, 35, 0.6)
    vee(L, cx, 8, W.b, 35, 0.62)
    L.col(cx + 0.5, 41, 42, W.sh)
    // 나비넥타이
    const bow = mat(hex('#2a2732'))
    L.rect(cx - 2.5, 37, cx - 1.5, 39, bow.b)
    L.rect(cx + 1.5, 37, cx + 2.5, 39, bow.b)
    L.rect(cx - 0.5, 38, cx + 0.5, 38, bow.b)
    L.set(cx + 0.5, 45, C.ln)
    L.set(cx + 0.5, 47, C.ln)
    // 부토니에르
    const fl = mat(FIX.pink)
    L.rect(19, 39, 20, 40, fl.b)
    L.set(20, 40, fl.sh)
    L.set(19, 41, mat(FIX.leaf).b)
    shadeTorso(L, C)
  },
}

export const GOWN: OutfitDef = {
  label: '웨딩드레스',
  sleeve: 'none',
  sleeveMat: (c) => c,
  legs: null,
  shoe: () => FIX.white,
  draw: ({ L, view, cx, C, skin }) => {
    torso(L, C.b, 43)
    L.rect(17, 35, 30, 37, skin.b)
    skirt(L, 43, 60, 7, 15.5, C.b, 0.5)
    const lace = mat(mix(FIX.white, FIX.pink, 0.22))
    L.on(() => {
      if (view !== 'back') {
        // 하트 네크라인
        L.row(38, cx - 0.5, cx + 0.5, skin.b)
        L.set(cx - 4.5, 38, skin.b)
        L.set(cx + 4.5, 38, skin.b)
      }
      L.rect(17, 43, 30, 44, lace.b)
      for (const x of [14, 33]) L.col(x, 50, 58, C.sh)
      L.col(20, 52, 58, C.sh)
      L.col(27, 52, 58, C.sh)
      // 레이스 밑단
      for (let x = 7; x <= 40; x++) {
        L.set(x, 60, x % 3 === 0 ? C.sh : lace.b)
        if (x % 3 === 1) L.set(x, 59, lace.b)
        if (x % 6 === 2) L.set(x, 56, C.hi)
      }
    })
    shadeTorso(L, C)
  },
}
