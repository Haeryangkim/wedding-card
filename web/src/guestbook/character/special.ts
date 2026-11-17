/**
 * 고정 캐릭터: 신랑(연미 턱시도·보타이·부토니에)·신부(웨딩드레스·베일·티아라·부케).
 * 하객보다 한 단계 공들인 전용 템플릿.
 * 신부 전용 글자: 1234 = 베일(푸른 기 도는 흰색), w 계열 = 드레스(차가운 흰색 + 라벤더 음영).
 */
import type { Frame, View } from './dims'
import { stamp, type Grid } from './grid'
import type { OutfitDef } from './outfits'
import { FIXED, hexToRgb, type Ramp } from './palette'

interface Layer {
  y0: number
  rows: string[]
}
const rep = (n: number, row: string): string[] => Array.from({ length: n }, () => row)

/* ── 신랑 ───────────────────────────────────────────────── */
export const GROOM_HAIR = 10 // 포마드
export const GROOM_COLORS = {
  skin: hexToRgb('#f3c9a0'),
  hair: hexToRgb('#3a3340'),
  cloth: hexToRgb('#2f3048'),
}

export const TUXEDO: OutfitDef = {
  label: '턱시도',
  legs: 'pants',
  sleeve: { kind: 'long', fam: 'CcbB', cuff: 'wy' },
  colors: (p) => ({ e: p, t: hexToRgb('#24222f'), q: hexToRgb('#f1ede4'), shoe: FIXED.shoeBlack }),
  torso: {
    front: {
      y0: 14,
      rows: [
        '.....CwwtTTtwwB.....',
        '......cCwwwwFf......',
        '......cCwywfyf......',
        '......ccCwyw*l......',
        '......cccCwBcb......',
        '......cccCBccb......',
        '......cccCBccb......',
        '......cCcyBccb......',
        '......ccccBccb......',
        '......ccccBccb......',
        '......bbbbBbbB......',
      ],
    },
    side: {
      y0: 14,
      rows: [
        '......bccccw........',
        '......bccccCt.......',
        '......bccccCw.......',
        '......bcccCfF.......',
        '......bcccc*l.......',
        '......bccccC2.......',
        '......bccccC2.......',
        '......bcccccy.......',
        '......bcccccc.......',
        '......bbccccc.......',
        '......bbbbbbb.......',
        '......bcb...........',
        '......bcb...........',
        '......bcb...........',
        '......bb............',
      ],
    },
    back: {
      y0: 14,
      rows: [
        '.....CccwwwwccB.....',
        '......cCcccccb......',
        '......cCcccccb......',
        '......cccbcccb......',
        '......cccbcccb......',
        '......cccbcccb......',
        '......cccbcccb......',
        '......cccbcccb......',
        '......cccBcccb......',
        '......cccBcccb......',
        '......ccbBbccb......',
        '......ccb..ccb......',
        '......ccb..ccb......',
        '......ccb..ccb......',
        '......bb....bb......',
      ],
    },
  },
}

/* ── 신부 ───────────────────────────────────────────────── */
export const BRIDE_COLORS = {
  skin: hexToRgb('#fde4d0'),
  hair: hexToRgb('#57392c'),
}
/** 드레스: 차가운 흰색, 음영은 라벤더 (크림색 바닥에 묻히지 않게) */
export const BRIDE_WHITE: Ramp = [hexToRgb('#ffffff'), hexToRgb('#f3f2fb'), hexToRgb('#d3d0ec'), hexToRgb('#8f89b8')]
/** 베일: 드레스보다 푸른 반투명 느낌 */
export const BRIDE_VEIL: Ramp = [hexToRgb('#fbfcff'), hexToRgb('#e6edfb'), hexToRgb('#c9d4f1'), hexToRgb('#8f9bcc')]

const B_HAIR: Record<View, Layer> = {
  front: {
    y0: 2,
    rows: [
      '......hhhhhhhh......',
      '.....hHHHhGhhhh.....',
      '....hhHhhg.ghhhg....',
      '....hhg......ghg....',
      '....hg........gg....',
      '....g..........g....',
    ],
  },
  side: {
    y0: 2,
    rows: [
      '......hhhhhhh.......',
      '.....hHHHHhhHhh.....',
      '....hhHHhhhhHHhh....',
      '....ghhhhhhhhg......',
      '....ghhhhhhg........',
      '....gghhhhg.........',
      '....gghhh.g.........',
      '....gghhh...........',
      '.....ghh............',
      '......g.............',
    ],
  },
  back: {
    y0: 2,
    rows: [
      '......hhhhhhhh......',
      '.....hHHHHhhhHh.....',
      '....hhHHhhhhhHhg....',
      '....hhhhhhhhhhgg....',
      '....hhhhhhhhhhgg....',
      '....hhhhhhhhhhgg....',
      '.....hhhhhhhhhg.....',
      '.....ghhhhhhhgg.....',
      '......gghhhggg......',
      '.......gggggg.......',
    ],
  },
}

const TIARA: Record<View, Layer> = {
  front: { y0: 0, rows: ['.........Y..........', '.......y.YY.y.......', '......yYyyyYy&......'] },
  side: { y0: 0, rows: ['..........Y.........', '.........yYy........', '........yYyy&.......'] },
  back: { y0: 0, rows: ['.........hh.........', '.......yhHhgy.......', '......yyhhggy&......'] },
}

/** 정면: 몸 뒤로 깔리는 베일 */
const VEIL_FRONT_UNDER: Layer = {
  y0: 2,
  rows: [
    '......12222223......',
    '....122222222223....',
    ...rep(9, '...12222222222223...'),
    ...rep(4, '..1222222222222223..'),
    ...rep(4, '..1232222222223223..'),
    '..123..........323..',
    '...3............3...',
  ],
}
/** 측면: 뒤통수에서 등 뒤로 흘러내리는 베일 (주름 3, 빛 1) */
const VEIL_SIDE_OVER: Layer = {
  y0: 2,
  rows: [
    '......1222..........',
    '.....12223..........',
    '....12223...........',
    '...12223............',
    '...1223.............',
    '..12223.............',
    '..1223..............',
    '..1223..............',
    '..12223.............',
    '..12223.............',
    '..12323.............',
    '..12323.............',
    '..12323.............',
    '.122323.............',
    '.122323.............',
    '.123223.............',
    '.123223.............',
    '.1232223............',
    '.1232223............',
    '.1223223............',
    '.1223223............',
    '.1223223............',
    '.12.2323............',
    '..3..3.3............',
  ],
}
/** 후면: 올림머리 아래에서 퍼지는 베일. W = 반짝이 */
const VEIL_BACK_OVER: Layer = {
  y0: 4,
  rows: [
    '.......122223.......',
    '......12222223......',
    '.....1222222223.....',
    '.....1222322223.....',
    '.....12W2322223.....',
    '....122223222223....',
    '....12222322W223....',
    '....122223222223....',
    '...12222322322223...',
    '...12222322322223...',
    '...122W2322322223...',
    '...12222322322223...',
    '..1222232223222223..',
    '..12222322232W2223..',
    '..1222232223222223..',
    '..1222232223222223..',
    '..1222322223222323..',
    '..122W322223222323..',
    '..1222322223222323..',
    '..1222322223W22323..',
    '..1222322223222323..',
    '..1222322223222323..',
    '..1223.2223.2223.3..',
    '...33...33...33.....',
  ],
}

/** 상체(bob 과 함께 움직임): 하트넥 보디스 + 허리띠 */
const BODICE: Record<View, Layer> = {
  front: {
    y0: 15,
    rows: ['......wWw..wwv......', '......wWwwwwwv......', '......wWwwwwwv......', '.......wWwwwv.......', '......vYyyyy&v......'],
  },
  side: { y0: 15, rows: ['.......vwwwwW.......', '.......vwwwww.......', '.......vwwwww.......', '.......vvwwww.......', '.......v&yyyy.......'] },
  back: {
    y0: 15,
    rows: ['......wwwwwwwv......', '......wwvwvwwv......', '......wwwvwwwv......', '.......wwvwwv.......', '......vyyyyy&v......'],
  },
}
/** 하체(바닥에 고정): 종 모양 스커트 + 레이스 단 */
const SKIRT: Record<View, Layer> = {
  front: {
    y0: 20,
    rows: [
      '.....wWwwwwwwwv.....',
      '....wWwwwwwwwwwv....',
      '...wWwwwwvwwwwwwv...',
      '...wWwwwvwwwwvwwv...',
      '..wWwwwwvwwwwvwwwv..',
      '..wWwwwvwwwwwvwwwv..',
      '..wWwwwvwwwwwwvwwv..',
      '.wWwwwwvwwwwwwvwwwv.',
      '.wWwwwvwwwwwwwvwwvv.',
      '.wvvwwvwwvvwwwvwvvv.',
      '.wWwvvwwvwwvvwwvwwv.',
      '.wWwwwwwwwwwwwwwwvv.',
      '.wWwwwwwwwwwwwwwwvv.',
      '.wWwwwwwwwwwwwwwwvv.',
      '..vvvvvvvvvvvvvvvv..',
    ],
  },
  side: {
    y0: 20,
    rows: [
      '......vwwwwwww......',
      '.....vwwwwwwwww.....',
      '....vwwwwvwwwwww....',
      '....vwwwwvwwwwwWw...',
      '...vwwwwwvwwwwwWw...',
      '...vwwwwvwwwwwwWw...',
      '..vwwwwwvwwwwwwWww..',
      '..vwwwwwvwwwwwwwWw..',
      '..vwwwwvwwwwwwwwWw..',
      '..vvwwvwwvvwwwvwwv..',
      '.vwwvvwwvwwvvwwvww..',
      '.vwwwwwwwwwwwwwwWw..',
      '.vwwwwwwwwwwwwwwWw..',
      '.vwwwwwwwwwwwwwwWw..',
      '..vvvvvvvvvvvvvvv...',
    ],
  },
  back: {
    y0: 20,
    rows: [
      '.....wwwwwwwwwv.....',
      '....wwwwwwwwwwwv....',
      '...wwwwwwvwwwwwwv...',
      '...wwwwwvwwwwvwwv...',
      '..wwwwwwvwwwwvwwwv..',
      '..wwwwwvwwwwwvwwwv..',
      '..wwwwwvwwwwwwvwwv..',
      '.wwwwwwvwwwwwwvwwwv.',
      '.wwwwwvwwwwwwwvwwvv.',
      '.wvvwwvwwvvwwwvwvvv.',
      '.wwwvvwwvwwvvwwvwwv.',
      '.wwwwwwwwwwwwwwwwvv.',
      '.wwwwwwwwwwwwwwwwvv.',
      '.wwwwwwwwwwwwwwwwvv.',
      '..vvvvvvvvvvvvvvvv..',
    ],
  },
}

/** 부케를 모아 쥔 팔(캡 소매) + 부케 */
const B_ARMS_FRONT: Layer = {
  y0: 14,
  rows: [
    '....Wv........vw....',
    '....kj........jk....',
    '....kj........jk....',
    '....kj........jk....',
    '....kj........jk....',
    '....kkj......jkk....',
    '.....kkj....jkk.....',
    '......kkk..kkj......',
  ],
}
const BOUQUET_FRONT: Layer = {
  y0: 18,
  rows: [
    '........fF.Wf.......',
    '.......fFWfFf*......',
    '.......WfFfWFf......',
    '.......lfWfFfl......',
    '........lLlll.......',
    '.........yy.........',
  ],
}
const B_ARM_SIDE: Layer = {
  y0: 14,
  rows: [
    '.........Wv.........',
    '.........kk.........',
    '.........kk.........',
    '.........kk.........',
    '.........kkj........',
    '..........kkj.......',
    '...........kkk......',
  ],
}
const BOUQUET_SIDE: Layer = {
  y0: 18,
  rows: [
    '.............fF.....',
    '............fWfF....',
    '............FfWf*...',
    '............lfFfl...',
    '.............lLl....',
    '.............y......',
  ],
}
const B_ARMS_BACK: Layer = {
  y0: 14,
  rows: ['....wv........vw....', '....kj........jk....', '....kj........jk....', '....kj........jk....', '....kj........jk....', '....kkj......jkk....'],
}

/** 몸 뒤로 깔리는 층 */
export function drawBrideUnder(g: Grid, view: View): void {
  if (view === 'front') stamp(g, VEIL_FRONT_UNDER.rows, VEIL_FRONT_UNDER.y0)
}
/** 스커트: 바닥에 고정된 하체 그리드에. 걷기 프레임은 치맛단이 좌우로 1px 흔들린다. */
export function drawBrideSkirt(g: Grid, view: View, frame: Frame): void {
  const sk = SKIRT[view]
  const n = sk.rows.length
  const sway = frame === 0 ? 0 : 5
  stamp(g, sk.rows.slice(0, n - sway), sk.y0)
  if (sway) stamp(g, sk.rows.slice(n - sway), sk.y0 + n - sway, frame === 1 ? -1 : 1)
}
/** 보디스·팔·부케 (상체 그리드) */
export function drawBrideBody(g: Grid, view: View): void {
  stamp(g, BODICE[view].rows, BODICE[view].y0)
  if (view === 'front') {
    stamp(g, B_ARMS_FRONT.rows, B_ARMS_FRONT.y0)
    stamp(g, BOUQUET_FRONT.rows, BOUQUET_FRONT.y0)
  } else if (view === 'side') {
    stamp(g, B_ARM_SIDE.rows, B_ARM_SIDE.y0)
    stamp(g, BOUQUET_SIDE.rows, BOUQUET_SIDE.y0)
  } else {
    stamp(g, B_ARMS_BACK.rows, B_ARMS_BACK.y0)
  }
}
export function drawBrideHair(g: Grid, view: View): void {
  stamp(g, B_HAIR[view].rows, B_HAIR[view].y0)
}
export function drawBrideOver(g: Grid, view: View): void {
  if (view === 'side') stamp(g, VEIL_SIDE_OVER.rows, VEIL_SIDE_OVER.y0)
  if (view === 'back') stamp(g, VEIL_BACK_OVER.rows, VEIL_BACK_OVER.y0)
  stamp(g, TIARA[view].rows, TIARA[view].y0)
}
