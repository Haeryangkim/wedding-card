/**
 * 의상. 한 벌 = 다리 재질 · 신발 · 소매 종류 + 몸통 층에 그리는 함수(상의/치마/세부).
 * 치마·드레스는 몸통과 같은 층에 그려 다리 위를 덮는다. 걷기 프레임에서는 sway(−1/1)에 따라
 * 치맛자락이 좌우로 쏠리고 반대쪽 밑단이 살짝 들린다 (고름·코트 자락도 같이 흔들린다).
 */
import type { Frame, View } from './dims'
import { CX, type LegStyle, type Sleeve } from './body'
import { FIX, hex, lum, mix, tone, withL, type RGB } from './palette'
import { mat, mat4, type Layer, type Mat } from './raster'

export interface OutfitCtx {
  L: Layer
  view: View
  frame: Frame
  /** 걷기 프레임의 흔들림 방향 */
  sway: -1 | 0 | 1
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
  legStyle?: LegStyle
  /** 대님 색 (legStyle = baji) */
  legTie?: (c: RGB) => RGB
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

interface SkirtOpts {
  curve?: number
  /** 밑단이 쏠리는 px (부호 = 방향) */
  sway?: number
  /** 주름: 반폭에 대한 비율(−1..1). 허리에서 밑단으로 퍼져 나간다 */
  folds?: number[]
  /** 주름이 시작되는 지점 (0..1) */
  foldFrom?: number
}

/** 종 모양 치마. 주름은 치마폭을 따라 방사형으로 퍼지고, 쏠린 반대쪽 밑단이 1px 들린다 */
function skirt(L: Layer, y0: number, y1: number, h0: number, h1: number, m: Mat, o: SkirtOpts = {}): void {
  const n = Math.max(1, y1 - y0)
  const sway = o.sway ?? 0
  const at = (y: number) => {
    const t = (y - y0) / n
    return { c: CX + Math.round(sway * t * t), hw: h0 + (h1 - h0) * Math.pow(t, o.curve ?? 1), t }
  }
  for (let y = y0; y <= y1; y++) {
    const { c, hw } = at(y)
    L.row(y, Math.ceil(c - hw), Math.floor(c + hw), m.b)
  }
  if (sway) {
    const { c, hw } = at(y1)
    const s = sway > 0 ? -1 : 1
    for (let k = Math.round(hw * 0.45); k <= hw + 1; k++) L.erase(c + s * k, y1)
    L.erase(c + s * Math.floor(hw), y1 - 1)
  }
  if (o.folds)
    L.on(() => {
      for (const q of o.folds ?? [])
        for (let y = y0 + Math.round(n * (o.foldFrom ?? 0.25)); y <= y1; y++) {
          const { c, hw } = at(y)
          L.set(c + q * hw, y, m.sh)
        }
    })
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
/** 고름·깃: 옷 색을 한 톤 깊고 차분하게 */
const ribbon = (c: RGB) => withL(c, Math.min(0.42, lum(c) * 0.62), 0.8)
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
    draw: ({ L, view, cx, C, W, sway }) => {
      torso(L, C.b, 44)
      skirt(L, 44, 53, 6.5, 10.5, C, { curve: 0.8, sway, folds: [-0.66, -0.24, 0.2, 0.62], foldFrom: 0.3 })
      L.on(() => {
        L.row(44, 17, 30, C.sh)
        L.row(52, 0, 47, C.hi)
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
      } else {
        L.on(() => L.col(23, 36, 43, C.sh))
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
    draw: ({ L, view, cx, C, skin, sway }) => {
      torso(L, C.b, 44)
      L.rect(17, 35, 30, 37, skin.b)
      L.col(19, 35, 37, C.b)
      L.col(28, 35, 37, C.b)
      skirt(L, 44, 60, 6.5, 12.5, C, { curve: 0.7, sway: sway * 2, folds: [-0.7, -0.3, 0.16, 0.6], foldFrom: 0.3 })
      L.on(() => {
        L.rect(17, 44, 30, 45, C.hi)
        L.row(60, 0, 47, C.sh)
        if (view !== 'back') {
          L.set(cx - 0.5, 38, skin.b)
          L.set(cx + 0.5, 38, skin.b)
          L.set(cx + 3.5, 41, C.hi)
          L.set(cx - 5, 52, C.hi)
          L.set(cx + 6, 55, C.hi)
        } else {
          L.rect(22, 38, 25, 39, skin.b)
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
    draw: ({ L, view, cx, C, W, sway }) => {
      torso(L, W.b, 43)
      skirt(L, 43, 53, 6.5, 9.5, C, { sway, folds: [-0.84, -0.5, -0.17, 0.17, 0.5, 0.84], foldFrom: 0.25 })
      L.on(() => L.row(43, 17, 30, C.hi))
      if (view !== 'back') {
        // 리본 타이
        L.on(() => {
          L.rect(cx - 3.5, 36, cx - 1.5, 38, C.b)
          L.rect(cx + 1.5, 36, cx + 3.5, 38, C.b)
          L.rect(cx - 0.5, 36, cx + 0.5, 37, C.sh)
          L.col(cx - 1.5 + (sway < 0 ? -1 : 0), 39, 41, C.b)
          L.col(cx + 1.5 + (sway > 0 ? 1 : 0), 39, 40, C.b)
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
    draw: ({ L, view, cx, C, W, base, skin, sway }) => {
      const J = mat(pastel(base))
      const rib = mat(ribbon(base))
      // 치마: 가슴께부터 종 모양으로 풍성하게, 주름이 퍼져 내려온다
      skirt(L, 41, 60, 7.5, 13.5, C, {
        curve: 0.55,
        sway: sway * 2,
        folds: [-0.78, -0.46, -0.14, 0.2, 0.52, 0.82],
        foldFrom: 0.15,
      })
      L.on(() => {
        L.row(60, 0, 47, C.sh)
        // 금박 느낌의 밑단 띠
        for (let x = 0; x < 48; x++) L.set(x, 57, x % 3 === 0 ? C.b : C.hi)
      })
      // 저고리 (짧다)
      L.rect(17, 35, 30, 37, J.b)
      L.rect(18, 38, 29, 41, J.b)
      L.row(41, 18, 29, J.sh)
      if (view !== 'back') {
        L.on(() => {
          vee(L, cx, 7, rib.b) // 깃
          vee(L, cx, 6, W.b) // 동정
          vee(L, cx, 4, skin.b)
        })
        // 고름: 매듭 + 고(고리) + 길고 짧은 두 가닥 — 걸을 때 끝이 흔들린다
        const gx = cx + 1.5
        L.rect(gx - 2, 38, gx - 1, 39, rib.b)
        L.set(gx - 2, 38, rib.hi)
        L.rect(gx, 39, gx + 1, 40, rib.b)
        L.set(gx + 1, 40, rib.sh)
        for (let y = 41; y <= 50; y++) {
          const o = y > 46 ? sway : 0
          L.set(gx + o, y, rib.b)
          L.set(gx + 1 + o, y, y > 48 ? rib.b : rib.sh)
        }
        for (let y = 41; y <= 46; y++) L.set(gx + 3 + (y > 43 ? sway : 0), y, rib.b)
      } else {
        L.on(() => {
          L.col(23, 36, 40, J.sh)
          L.row(35, 20, 27, W.b)
        })
      }
      L.rim(J.b, J.sh, 1, 0, 1)
      shadeTorso(L, C)
    },
  },
  {
    label: '남자 한복',
    sleeve: 'wide',
    sleeveMat: (c) => mix(pastel(c), FIX.white, 0.6),
    legs: () => hex('#efe9dc'),
    legStyle: 'baji',
    legTie: (c) => c,
    shoe: blackShoe,
    draw: ({ L, view, cx, C, W, base, skin, sway }) => {
      const J = mat(mix(pastel(base), FIX.white, 0.6))
      const trim = mat(ribbon(base))
      const gold = mat(FIX.gold)
      // 배자(조끼형 덧옷): 엉덩이까지 내려오고 자락이 걸음에 따라 흔들린다
      torso(L, C.b, 48)
      L.row(49, 17 + Math.min(0, sway), 30 + Math.max(0, sway), C.b)
      L.row(50, 17 + sway, 30 + sway, C.b)
      if (view !== 'back') {
        L.on(() => {
          // 깊은 V 깃 사이로 저고리 깃·동정이 보인다
          vee(L, cx, 9, trim.b, 35, 0.6)
          vee(L, cx, 8, J.b, 35, 0.58)
          vee(L, cx, 6, W.b, 35, 0.72)
          vee(L, cx, 4, skin.b, 35, 0.6)
          // 여밈선 + 매듭단추
          L.col(cx + 0.5, 44, 50, C.sh)
          L.set(cx - 0.5, 45, gold.b)
          L.set(cx - 0.5, 48, gold.b)
          L.set(cx - 0.5 + sway, 50, C.sh)
        })
      } else {
        L.on(() => {
          L.col(23 + sway, 42, 50, C.sh)
          L.row(35, 20, 27, W.b)
        })
      }
      L.on(() => L.row(50, 0, 47, trim.b))
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
  draw: ({ L, view, cx, C, W, sway }) => {
    const satin = mat(hex('#6c6a84'))
    const gold = mat(FIX.gold)
    torso(L, C.b)
    // 연미복 자락
    if (view === 'back') {
      for (let k = 0; k < 6; k++) {
        L.row(49 + k, 18 + sway, 22 + sway - (k > 3 ? k - 3 : 0), C.b)
        L.row(49 + k, 25 + sway + (k > 3 ? k - 3 : 0), 29 + sway, C.b)
      }
      shadeTorso(L, C)
      L.on(() => {
        L.col(23, 40, 48, C.sh)
        L.set(21, 44, gold.b)
        L.set(26, 44, gold.b)
        L.row(35, 20, 27, W.b)
      })
      return
    }
    if (view === 'side') for (let k = 0; k < 6; k++) L.row(49 + k, 17 + sway, 21 + sway - (k > 2 ? k - 2 : 0), C.b)
    vee(L, cx, 10, satin.b, 35, 0.6) // 새틴 라펠
    vee(L, cx, 8, W.b, 35, 0.62)
    L.on(() => {
      L.col(cx + 0.5, 40, 42, W.sh)
      L.set(cx - 0.5, 41, satin.b) // 셔츠 단추
    })
    // 나비넥타이
    const bow = mat(hex('#2a2732'))
    L.rect(cx - 2.5, 37, cx - 1.5, 39, bow.b)
    L.rect(cx + 1.5, 37, cx + 2.5, 39, bow.b)
    L.rect(cx - 0.5, 38, cx + 0.5, 38, bow.b)
    L.set(cx - 2.5, 37, satin.b)
    L.set(cx + 1.5, 37, satin.b)
    L.set(cx + 0.5, 45, gold.b)
    L.set(cx + 0.5, 47, gold.b)
    // 부토니에르 (작은 장미 + 잎)
    const fl = mat(hex('#f48aa4'))
    L.rect(19, 39, 21, 41, fl.b)
    L.set(20, 40, fl.hi)
    L.set(21, 41, fl.sh)
    L.set(19, 42, mat(FIX.leaf).b)
    L.set(20, 42, mat(FIX.leaf).sh)
    shadeTorso(L, C)
  },
}

/** 웨딩드레스 전용 흰색 (음영은 차가운 라일락) */
const GOWN_M = mat4(hex('#ffffff'), hex('#fdfaf7'), hex('#d9d0ea'), hex('#857ea4'))
const LACE_M = mat4(hex('#fff6f8'), hex('#fbdde6'), hex('#eab8cc'), hex('#857ea4'))

export const GOWN: OutfitDef = {
  label: '웨딩드레스',
  sleeve: 'none',
  sleeveMat: (c) => c,
  legs: null,
  shoe: () => FIX.white,
  draw: ({ L, view, cx, skin, sway }) => {
    const G = GOWN_M
    const lace = LACE_M
    const sash = mat(hex('#f4b4c4'))
    const gold = mat(FIX.gold)
    torso(L, G.b, 43)
    L.rect(17, 35, 30, 37, skin.b)
    skirt(L, 43, 60, 7, 15.5, G, {
      curve: 0.5,
      sway: sway * 2,
      folds: [-0.84, -0.56, -0.26, 0.06, 0.36, 0.64, 0.88],
      foldFrom: 0.5,
    })
    L.on(() => {
      if (view !== 'back') {
        // 하트 네크라인 + 목걸이
        L.row(38, cx - 0.5, cx + 0.5, skin.b)
        L.set(cx - 4.5, 38, skin.b)
        L.set(cx + 4.5, 38, skin.b)
        L.set(cx - 0.5, 36, gold.b)
        L.set(cx + 0.5, 36, gold.hi)
        // 보디스 비즈
        L.set(cx - 2.5, 40, G.sh)
        L.set(cx + 2.5, 40, G.sh)
        L.set(cx - 0.5, 41, lace.sh)
      } else {
        L.rect(21, 38, 26, 39, skin.b)
        L.col(23, 40, 42, G.sh)
      }
      // 허리 새시
      L.rect(17, 43, 30, 44, sash.b)
      L.row(44, 17, 30, sash.sh)
      // 겹치마(오버스커트)의 물결 단
      for (let x = 4; x <= 43; x++) {
        const y = 50 + [0, 1, 1, 0][x & 3] + Math.round(Math.abs(x - CX) * 0.1)
        if (L.get(x, y) === G.b) L.set(x, y, G.sh)
        if ((x & 3) === 1 && L.get(x, y - 2) === G.b) L.set(x, y - 2, G.hi)
      }
      // 레이스 밑단
      for (let x = 4; x <= 43; x++) {
        L.set(x, 60, x % 3 === 0 ? lace.sh : lace.b)
        if (x % 3 !== 0) L.set(x, 59, lace.b)
        if (x % 3 === 1) L.set(x, 58, lace.b)
        if (x % 6 === 2) L.set(x, 55, G.hi)
      }
    })
    if (view === 'back') {
      // 등 뒤 리본
      L.rect(20, 42, 22, 45, sash.b)
      L.rect(25, 42, 27, 45, sash.b)
      L.rect(23, 43, 24, 44, sash.sh)
      L.col(22, 46, 50, sash.b)
      L.col(25, 46, 49, sash.b)
    }
    shadeTorso(L, G)
  },
}
