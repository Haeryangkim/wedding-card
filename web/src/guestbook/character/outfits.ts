/**
 * 의상 템플릿 — 몸통(torso)·치마(skirt)를 방향별 문자열 그리드로 직접 찍는다.
 * 재질: c 주색(선택한 의상 색) / e 보조(바지 등) / t 포인트(넥타이·고름·리본) /
 *       1234 제4색(조끼·저고리·벨트) / w 흰 천 / y 금장식 / k 피부(구멍 '.' 은 아래 피부가 비침).
 * 각 군은 [하이, 기본, 음영, 딥] = C c b B · E e d D · T t r R · 1 2 3 4 · W w v V.
 * 몸통 좌표: 정면 어깨 y15(x5..14), 몸통 y16..22(x6..13), 측면 x7..12(오른쪽이 앞).
 */
import type { Frame, View } from './dims'
import type { LegKind, Sleeve } from './body'
import { stamp, type Grid, type Remap } from './grid'
import { FIXED, hexToRgb, lightnessOf, shiftTone, withLightness, type RGB } from './palette'

interface Layer {
  y0: number
  rows: string[]
}
export interface OutfitColors {
  /** 주색을 덮어쓸 때 (없으면 선택한 의상 색) */
  c?: RGB
  e: RGB
  t: RGB
  q: RGB
  shoe: RGB
}
export interface OutfitDef {
  label: string
  legs: LegKind
  legRemap?: Remap
  sleeve: Sleeve
  colors: (primary: RGB) => OutfitColors
  torso: Record<View, Layer>
  skirt?: Record<View, Layer>
  /** 한복 바지 대님 (발목 띠) */
  ankleTie?: boolean
  /** 걷기 때 좌우로 흔들릴 치맛단 행 수 */
  sway?: number
}

const dark = (p: RGB) => lightnessOf(p) < 0.42
/** 주색과 어울리는 넥타이/포인트 색 */
function accentFor(p: RGB): RGB {
  const l = lightnessOf(p)
  if (l > 0.62) return shiftTone(p, 0.55, 1.15, -8)
  return l < 0.4 ? hexToRgb('#b8475a') : hexToRgb('#3f4a78')
}
const BEIGE = hexToRgb('#cdb592')
const DENIM = hexToRgb('#5d6f9c')
const LEATHER = hexToRgb('#7a4f3a')


/* ── 공용 조각 ───────────────────────────────────────────── */
const JACKET_BACK: Layer = {
  y0: 14,
  rows: [
    '.....CccbbbbccB.....',
    '......cccccccb......',
    '......cccccccb......',
    '......cccccccb......',
    '......cccbcccb......',
    '......cccbcccb......',
    '......cccbcccb......',
    '......cccbcccb......',
    '......cccBcccb......',
    '......bbbBbbbB......',
  ],
}

export const OUTFITS: OutfitDef[] = [
  /* 0 ── 정장 + 넥타이 */
  {
    label: '정장',
    legs: 'pants',
    sleeve: { kind: 'long', fam: 'CcbB', cuff: 'wv' },
    colors: (p) => ({
      e: shiftTone(p, 0.9),
      t: accentFor(p),
      q: p,
      shoe: dark(p) ? FIXED.shoeBlack : FIXED.shoeBrown,
    }),
    torso: {
      front: {
        y0: 14,
        rows: [
          '.....CccwttwccB.....',
          '......cCwtrwbc......',
          '......ccCtrbcb......',
          '......ccCtrbcb......',
          '......ccCtrbcb......',
          '......cccbbccb......',
          '......cccBcccb......',
          '......ccccbccb......',
          '......cccBcccb......',
          '......bbbbbbbB......',
        ],
      },
      side: {
        y0: 14,
        rows: [
          '......bccccc........',
          '......bcccccw.......',
          '......bccccct.......',
          '......bccccct.......',
          '......bccccCr.......',
          '......bcccccb.......',
          '......bcccccc.......',
          '......bcccccc.......',
          '......bcccccc.......',
          '......bbbbbbb.......',
        ],
      },
      back: JACKET_BACK,
    },
  },
  /* 1 ── 조끼 (흰 셔츠 + 웨이스트코트) */
  {
    label: '조끼',
    legs: 'pants',
    sleeve: { kind: 'long', fam: 'WwvV', cuff: 'vV' },
    colors: (p) => ({
      e: shiftTone(p, 0.9),
      t: accentFor(p),
      q: dark(p) ? withLightness(p, 0.68, 0.45) : shiftTone(p, 0.62, 0.9),
      shoe: FIXED.shoeBrown,
    }),
    torso: {
      front: {
        y0: 14,
        rows: [
          '.....WwwwttwwwV.....',
          '......cCwtrwcb......',
          '......cCctrccb......',
          '......ccCtrccb......',
          '......ccCcbccb......',
          '......cCcycccb......',
          '......ccccbccb......',
          '......cCcycccb......',
          '......ccccbccb......',
          '......bbbbbbbB......',
        ],
      },
      side: {
        y0: 14,
        rows: [
          '......vwwwww........',
          '......bcccccw.......',
          '......bccccct.......',
          '......bccccct.......',
          '......bcccccc.......',
          '......bcccccy.......',
          '......bcccccc.......',
          '......bcccccy.......',
          '......bcccccc.......',
          '......bbbbbbb.......',
        ],
      },
      back: {
        y0: 14,
        rows: [
          '.....WwwwwwwwwV.....',
          '......cccccccb......',
          '......cccccccb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '......ccbbbccb......',
          '......cccbcccb......',
          '......bbbbbbbB......',
        ],
      },
    },
  },
  /* 2 ── 셔츠 + 슬랙스 */
  {
    label: '셔츠',
    legs: 'pants',
    sleeve: { kind: 'long', fam: 'CcbB', cuff: 'bB' },
    colors: (p) => ({
      e: dark(p) ? BEIGE : FIXED.charcoal,
      t: accentFor(p),
      q: LEATHER,
      shoe: FIXED.shoeBrown,
    }),
    torso: {
      front: {
        y0: 14,
        rows: [
          '.....CccC..CccB.....',
          '......ccCb.Ccb......',
          '......cccWbccb......',
          '......ccccbccb......',
          '......ccccbccb......',
          '......cccWbccb......',
          '......ccccbccb......',
          '......bccWbcbb......',
          '......2222y223......',
        ],
      },
      side: {
        y0: 14,
        rows: [
          '......bccccC........',
          '......bcccccC.......',
          '......bcccccc.......',
          '......bcccccc.......',
          '......bcccccW.......',
          '......bcccccc.......',
          '......bcccccW.......',
          '......bcccccc.......',
          '......3222222.......',
        ],
      },
      back: {
        y0: 14,
        rows: [
          '.....CccCCCCccB.....',
          '......cccccccb......',
          '......cbbbbbbb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '......bccbccbb......',
          '......22222223......',
        ],
      },
    },
  },
  /* 3 ── 니트 가디건 */
  {
    label: '가디건',
    legs: 'pants',
    sleeve: { kind: 'long', fam: 'CcbB', cuff: 'bB' },
    colors: (p) => {
      const [r, g, b] = p
      const bluish = b > r && b >= g
      return { e: bluish ? BEIGE : DENIM, t: accentFor(p), q: p, shoe: FIXED.shoeBrown }
    },
    torso: {
      front: {
        y0: 14,
        rows: [
          '.....CccwwwwccB.....',
          '......cCbwwbcb......',
          '......cCcbvbcb......',
          '......cCcbvbcb......',
          '......ccCbvbcb......',
          '......cccbbccb......',
          '......cCcycccb......',
          '......ccccbccb......',
          '......cCcycccb......',
          '......bcbcbcbB......',
        ],
      },
      side: {
        y0: 14,
        rows: [
          '......bccccc........',
          '......bcccccw.......',
          '......bcccCcw.......',
          '......bcccCcw.......',
          '......bcccccv.......',
          '......bcccCcc.......',
          '......bcccccy.......',
          '......bcccCcc.......',
          '......bcccccy.......',
          '......cbcbcbc.......',
        ],
      },
      back: {
        y0: 14,
        rows: [
          '.....CccbbbbccB.....',
          '......cCcccccb......',
          '......ccccCccb......',
          '......ccccCccb......',
          '......cCcccccb......',
          '......ccccCccb......',
          '......cCcccccb......',
          '......ccccCccb......',
          '......cCcccccb......',
          '......bcbcbcbB......',
        ],
      },
    },
  },
  /* 4 ── 원피스 (무릎 길이 A라인) */
  {
    label: '원피스',
    legs: 'bare',
    sleeve: { kind: 'cap', fam: 'CcbB' },
    colors: (p) => ({
      e: p,
      t: lightnessOf(p) > 0.7 ? shiftTone(p, 0.6, 1.2) : FIXED.white,
      q: p,
      shoe: lightnessOf(p) > 0.7 ? hexToRgb('#b98a6a') : shiftTone(p, 0.8),
    }),
    torso: {
      front: {
        y0: 14,
        rows: [
          '.....CcC....ccB.....',
          '......cCc..ccb......',
          '......cCccccbb......',
          '......cCccccbb......',
          '......ccccccbb......',
          '......tTttTtrr......',
        ],
      },
      side: {
        y0: 14,
        rows: [
          '......bcccc.........',
          '......bccccc........',
          '......bcccccc.......',
          '......bcccccc.......',
          '......bcccccc.......',
          '......rtttttt.......',
        ],
      },
      back: {
        y0: 14,
        rows: [
          '.....Ccc....ccB.....',
          '......ccc..ccb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '......ttttttrr......',
        ],
      },
    },
    skirt: {
      front: {
        y0: 20,
        rows: [
          '.....cCcccccccb.....',
          '.....cCccbcccbb.....',
          '....cCcccbccbcbb....',
          '....cCccbcccbccb....',
          '...ccCccbccbcccbb...',
          '...cCccbcccbccbcb...',
          '...bbbbbbbbbbbbbB...',
        ],
      },
      side: {
        y0: 20,
        rows: [
          '......bcccccc.......',
          '......bccccccc......',
          '......bcccbcccc.....',
          '.....bccccbcccc.....',
          '.....bcccbccccc.....',
          '....bccccbcccccc....',
          '.....bbbbbbbbbb.....',
        ],
      },
      back: {
        y0: 20,
        rows: [
          '.....ccccccccbb.....',
          '.....cccbcccbbb.....',
          '....ccccbccbccbb....',
          '....cccbcccbccbb....',
          '...ccccbccbcccbbb...',
          '...cccbcccbccbcbb...',
          '...bbbbbbbbbbbbbB...',
        ],
      },
    },
    sway: 2,
  },
  /* 5 ── 롱드레스 */
  {
    label: '롱드레스',
    legs: 'bare',
    sleeve: { kind: 'none', fam: 'CcbB' },
    colors: (p) => ({
      e: p,
      t: FIXED.gold,
      q: p,
      shoe: lightnessOf(p) > 0.7 ? hexToRgb('#b98a6a') : shiftTone(p, 0.75),
    }),
    torso: {
      front: {
        y0: 14,
        rows: [
          '.....kkkcCcckkj.....',
          '......kcCcccbj......',
          '......cCccccbb......',
          '......cCccccbb......',
          '......cCccccbb......',
          '......yYyyyyy&......',
        ],
      },
      side: {
        y0: 14,
        rows: [
          '.......jkcc.........',
          '......jkccccc.......',
          '......bcccccc.......',
          '......bcccccc.......',
          '......bcccccc.......',
          '......&yyyyyy.......',
        ],
      },
      back: {
        y0: 14,
        rows: [
          '.....kkkkcckkkj.....',
          '......kkkcckkj......',
          '......cccccccb......',
          '......cccccccb......',
          '......cccccccb......',
          '......yyyyyyy&......',
        ],
      },
    },
    skirt: {
      front: {
        y0: 20,
        rows: [
          '......cCccccbb......',
          '......cCccccbb......',
          '.....cCccccccbb.....',
          '.....cCccbccccb.....',
          '.....cCccbccccb.....',
          '....cCcccbcccbbb....',
          '....cCcccbcccbcb....',
          '....cCccbccccbcb....',
          '....cCccbccccbcb....',
          '...cCcccbcccbccbb...',
          '...cCcccbcccbccbb...',
          '...cCccbccccbcccb...',
          '..ccCccbcccbccccbb..',
          '...bbbbbbbbbbbbbB...',
        ],
      },
      side: {
        y0: 20,
        rows: [
          '......bcccccc.......',
          '......bcccccc.......',
          '......bcccccc.......',
          '......bccccccc......',
          '......bcccbcccc.....',
          '......bcccbcccc.....',
          '.....bccccbcccc.....',
          '.....bccccbcccc.....',
          '.....bcccbccccc.....',
          '....bccccbcccccc....',
          '....bccccbcccccc....',
          '....bccccbcccccc....',
          '...bcccccbccccccc...',
          '....bbbbbbbbbbbb....',
        ],
      },
      back: {
        y0: 20,
        rows: [
          '......ccccccbb......',
          '......ccccccbb......',
          '.....ccccccccbb.....',
          '.....ccccbccccb.....',
          '.....ccccbccccb.....',
          '....cccccbcccbbb....',
          '....cccccbcccbcb....',
          '....ccccbccccbcb....',
          '....ccccbccccbcb....',
          '...cccccbcccbccbb...',
          '...cccccbcccbccbb...',
          '...ccccbccccbcccb...',
          '..cccccbcccbccccbb..',
          '...bbbbbbbbbbbbbB...',
        ],
      },
    },
    sway: 3,
  },
  /* 6 ── 블라우스 + 플리츠 스커트 */
  {
    label: '블라우스',
    legs: 'bare',
    sleeve: { kind: 'long', fam: 'WwvV', cuff: 'vV' },
    colors: (p) => ({
      e: p,
      t: lightnessOf(p) > 0.7 ? shiftTone(p, 0.55, 1.2) : p,
      q: p,
      shoe: FIXED.shoeBrown,
    }),
    torso: {
      front: {
        y0: 14,
        rows: [
          '.....WwwT..TwwV.....',
          '......wwtTTtwv......',
          '......wwwtrwwv......',
          '......wwwtvrwv......',
          '......wvwwwwvv......',
          '......wvwwwwvv......',
          '......BBBByBBB......',
        ],
      },
      side: {
        y0: 14,
        rows: [
          '.......vwwww........',
          '......vwwwwwT.......',
          '......vwwwwwt.......',
          '......vwwwwwr.......',
          '......vvwwwww.......',
          '......vvwwwww.......',
          '......BBBBBBB.......',
        ],
      },
      back: {
        y0: 14,
        rows: [
          '.....WwwwwwwwwV.....',
          '......wwwwwwwv......',
          '......wwwwwwwv......',
          '......wwwvwwwv......',
          '......wvwvwwvv......',
          '......wvwvwwvv......',
          '......BBBBBBB.......',
        ],
      },
    },
    skirt: {
      front: {
        y0: 21,
        rows: [
          '......cbccbccb......',
          '......cbccbccb......',
          '.....ccbccbccbb.....',
          '.....cbccbccbcb.....',
          '.....cbccbccbcb.....',
          '....ccbccbccbccb....',
          '....cbccbccbccbb....',
          '....bbBbbBbbBbbB....',
        ],
      },
      side: {
        y0: 21,
        rows: [
          '......bccbccc.......',
          '......bccbccbc......',
          '.....bccbccbcc......',
          '.....bccbccbccc.....',
          '.....bccbccbccc.....',
          '....bccbccbccbcc....',
          '....bccbccbccbcc....',
          '....bbBbbBbbBbbb....',
        ],
      },
      back: {
        y0: 21,
        rows: [
          '......cbccbccb......',
          '......cbccbccb......',
          '.....ccbccbccbb.....',
          '.....cbccbccbcb.....',
          '.....cbccbccbcb.....',
          '....ccbccbccbccb....',
          '....cbccbccbccbb....',
          '....bbBbbBbbBbbB....',
        ],
      },
    },
    sway: 2,
  },
  /* 7 ── 한복 (저고리 + 치마) */
  {
    label: '한복',
    legs: 'bare',
    sleeve: { kind: 'wide', fam: '1234', trim: 'TtrR' },
    colors: (p) => {
      const light = lightnessOf(p) > 0.68
      return {
        e: p,
        // 저고리: 치마색에서 색조를 살짝 돌린 밝은 파스텔 (밝은 치마면 진한 저고리)
        q: light ? shiftTone(p, 0.5, 1.3, -14) : withLightness(shiftTone(p, 1, 1, 28), 0.88, 0.7),
        t: light ? hexToRgb('#b8475a') : shiftTone(p, 0.78, 1.25, -10),
        shoe: FIXED.white,
      }
    },
    torso: {
      front: {
        y0: 14,
        rows: [
          '.....122w..w223.....',
          '......122w.w23......',
          '......1222w223......',
          '......222tT223......',
          '......333tr333......',
        ],
      },
      side: {
        y0: 14,
        rows: [
          '.......3222w........',
          '......322222w.......',
          '......322222w.......',
          '......32222tT.......',
          '......33333tr.......',
        ],
      },
      back: {
        y0: 14,
        rows: [
          '.....122wwww223.....',
          '......12222223......',
          '......12222223......',
          '......22222223......',
          '......33333333......',
        ],
      },
    },
    skirt: {
      front: {
        y0: 19,
        rows: [
          '.....cCcctrcccb.....',
          '....cCccctrccccb....',
          '....cCccctrccbcb....',
          '...cCccbcctccbccb...',
          '...cCccbcctccbccb...',
          '..ccCccbccrccbcccb..',
          '..cCccbcccccccbccb..',
          '..cCccbcccccccbccb..',
          '.ccCccbcccccccbcccb.',
          '.cCcccbcccccccbcccb.',
          '.cCccbccccccccbccbb.',
          '.cCccbccccccccbccbb.',
          '.cCccbccccccccbccbb.',
          '.yYyyyyyyyyyyyyyy&&.',
          '..bbbbbbbbbbbbbbbb..',
        ],
      },
      side: {
        y0: 19,
        rows: [
          '......bccccctr......',
          '......bccccctr......',
          '.....bcccccbctr.....',
          '.....bcccccbcct.....',
          '....bccccccbcccc....',
          '....bcccccbccccc....',
          '...bccccccbcccccc...',
          '...bccccccbcccccc...',
          '..bcccccccbccccccc..',
          '..bccccccbcccccccc..',
          '..bccccccbcccccccc..',
          '..bccccccbcccccccc..',
          '..bccccccbcccccccc..',
          '..&yyyyyyyyyyyyyyy..',
          '...bbbbbbbbbbbbbb...',
        ],
      },
      back: {
        y0: 19,
        rows: [
          '.....ccccccccbb.....',
          '....ccccccccccbb....',
          '....ccccbcccbcbb....',
          '...ccccbccccbccbb...',
          '...ccccbccccbccbb...',
          '..cccccbccccbcccbb..',
          '..ccccbcccccccbcbb..',
          '..ccccbcccccccbcbb..',
          '.cccccbcccccccbccbb.',
          '.cccccbcccccccbccbb.',
          '.ccccbccccccccbccbb.',
          '.ccccbccccccccbccbb.',
          '.ccccbccccccccbccbb.',
          '.yyyyyyyyyyyyyyyy&&.',
          '..bbbbbbbbbbbbbbbb..',
        ],
      },
    },
    sway: 3,
  },
  /* 8 ── 남자 한복 (두루마기 + 바지, 흰 동정·고름·대님) */
  {
    label: '남자 한복',
    legs: 'pants',
    ankleTie: true,
    sleeve: { kind: 'wide', fam: 'CcbB', trim: 'WwvV' },
    colors: (p) => {
      const light = lightnessOf(p) > 0.68
      return {
        e: light ? shiftTone(p, 0.7, 0.8) : hexToRgb('#e3ddd2'),
        q: p,
        t: light ? hexToRgb('#b8475a') : accentFor(p),
        shoe: FIXED.shoeBlack,
      }
    },
    torso: {
      front: {
        y0: 14,
        rows: [
          '.....CcwW..wccB.....',
          '......cCwW.wcb......',
          '......ccCwWwcb......',
          '......cccCwbcb......',
          '......ccctTbcb......',
          '......ccctrbcb......',
          '......cccrtbcb......',
          '......cccctbcb......',
          '......cccccbcb......',
          '.....cCcccbcccb.....',
          '.....cCcccbcccb.....',
          '.....cCcccbcccb.....',
          '.....cCcccbccbb.....',
          '.....cCcccbccbb.....',
          '.....bbbbbbbbbB.....',
        ],
      },
      side: {
        y0: 14,
        rows: [
          '......bccccw........',
          '......bcccccw.......',
          '......bcccccw.......',
          '......bcccccc.......',
          '......bccccct.......',
          '......bccccctr......',
          '......bcccccct......',
          '......bcccccc.......',
          '......bcccccc.......',
          '.....bccccccc.......',
          '.....bcccccccc......',
          '.....bcccccccc......',
          '.....bcccccccc......',
          '.....bcccccccc......',
          '.....bbbbbbbbb......',
        ],
      },
      back: {
        y0: 14,
        rows: [
          '.....CccwwwwccB.....',
          '......cccccccb......',
          '......cccccccb......',
          '......cccccccb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '......cccbcccb......',
          '.....ccccbccccb.....',
          '.....ccccbccccb.....',
          '.....ccccbccccb.....',
          '.....ccccbccccb.....',
          '.....ccccbccccb.....',
          '.....bbbbbbbbbB.....',
        ],
      },
    },
  },
  /* 9 ── 트위드 투피스 */
  {
    label: '투피스',
    legs: 'bare',
    sleeve: { kind: 'long', fam: 'CcbB', cuff: 'wv' },
    colors: (p) => ({ e: p, t: FIXED.gold, q: p, shoe: FIXED.shoeBlack }),
    torso: {
      front: {
        y0: 14,
        rows: [
          '.....CccW..wccB.....',
          '......cCcWvccb......',
          '......ccbyvcCb......',
          '......ccbyvcCb......',
          '......cCcWvbcb......',
          '......ccbyvcCb......',
          '......WwwwwvvV......',
        ],
      },
      side: {
        y0: 14,
        rows: [
          '......bccccw........',
          '......bccCccW.......',
          '......bcccbcy.......',
          '......bcccbcy.......',
          '......bccCccW.......',
          '......bcccbcy.......',
          '......vwwwwww.......',
        ],
      },
      back: {
        y0: 14,
        rows: [
          '.....CccwwwwccB.....',
          '......cCccbccb......',
          '......ccbccCcb......',
          '......ccbccCcb......',
          '......cCccbccb......',
          '......ccbccCcb......',
          '......WwwwwvvV......',
        ],
      },
    },
    skirt: {
      front: {
        y0: 21,
        rows: [
          '.....ccCcbccCbb.....',
          '.....cbccCcbccb.....',
          '.....ccCcbccCbb.....',
          '.....cbccCcbccb.....',
          '.....ccCcbccCbb.....',
          '.....WwwwwwvvvV.....',
        ],
      },
      side: {
        y0: 21,
        rows: [
          '......bcCcbcc.......',
          '......bccbcCcc......',
          '......bcCcbccc......',
          '......bccbcCcc......',
          '......bcCcbccc......',
          '......vwwwwwww......',
        ],
      },
      back: {
        y0: 21,
        rows: [
          '.....ccCcbccCbb.....',
          '.....cbccCcbccb.....',
          '.....ccCcbccCbb.....',
          '.....cbccCcbccb.....',
          '.....ccCcbccCbb.....',
          '.....WwwwwwvvvV.....',
        ],
      },
    },
    sway: 1,
  },
]


/** 치마 층 (상체 그리드에, 몸통보다 먼저). 걷기 프레임은 치맛단이 1px 흔들린다. */
export function drawSkirt(g: Grid, view: View, frame: Frame, def: OutfitDef): void {
  const sk = def.skirt?.[view]
  if (!sk) return
  const sway = def.sway ?? 0
  const n = sk.rows.length
  if (frame === 0 || sway === 0) {
    stamp(g, sk.rows, sk.y0)
    return
  }
  stamp(g, sk.rows.slice(0, n - sway), sk.y0)
  stamp(g, sk.rows.slice(n - sway), sk.y0 + n - sway, frame === 1 ? -1 : 1)
}

export function drawTorso(g: Grid, view: View, def: OutfitDef): void {
  const t = def.torso[view]
  stamp(g, t.rows, t.y0)
}
