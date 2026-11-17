/**
 * 액세서리 템플릿 (0 = 없음). 방향별 문자열 그리드.
 * 글자: A a z Z 액세서리 주색 램프 / Q q p P 보조색 램프 / y Y & 금 / f F * 꽃 / l L 잎 /
 *       W 진주·흰색 / '_' 아래 픽셀 지움(모자가 머리 윗부분을 누르는 용도).
 */
import type { View } from './dims'
import { stamp, type Grid } from './grid'
import { hexToRgb, type RGB } from './palette'

interface Layer {
  y0: number
  rows: string[]
}
export interface AccessoryDef {
  label: string
  /** 주색/보조색 */
  a: RGB
  q: RGB
  front?: Layer
  side?: Layer
  back?: Layer
}

const NONE = hexToRgb('#000000')

export const ACCESSORIES: AccessoryDef[] = [
  { label: '없음', a: NONE, q: NONE },
  {
    label: '안경',
    a: hexToRgb('#d9a441'),
    q: hexToRgb('#d6ecf2'),
    front: {
      y0: 7,
      rows: [
        '.....aaaa..aaaa.....',
        '....aa..aaaa..aa....',
        '.....a..a..a..a.....',
        '......aa....aa......',
      ],
    },
    side: {
      y0: 7,
      rows: [
        '...........aaa......',
        '.........aaa..a.....',
        '...........a..a.....',
        '............aa......',
      ],
    },
  },
  {
    label: '선글라스',
    a: hexToRgb('#35303f'),
    q: hexToRgb('#b9b4d0'),
    front: { y0: 8, rows: ['....zaQaazzaQaaz....', '.....aaaa..aaaa.....'] },
    side: { y0: 8, rows: ['.........zzzaQa.....', '............aaa.....'] },
    back: { y0: 8, rows: ['....z..........z....'] },
  },
  {
    label: '리본',
    a: hexToRgb('#d2485e'),
    q: hexToRgb('#d2485e'),
    front: {
      y0: 1,
      rows: [
        '..........aa...aa...',
        '..........aAazaAa...',
        '..........aaaZaaz...',
        '...........z...z....',
      ],
    },
    side: {
      y0: 1,
      rows: [
        '...aa...aa..........',
        '...aAazaAa..........',
        '...aaaZaaz..........',
        '....z...z...........',
      ],
    },
    back: {
      y0: 2,
      rows: [
        '......aa...aa.......',
        '......aAaZaAa.......',
        '......aaaZaaz.......',
        '.......za.az........',
        '.......z...z........',
      ],
    },
  },
  {
    label: '꽃핀',
    a: hexToRgb('#ec8fa6'),
    q: hexToRgb('#ec8fa6'),
    front: {
      y0: 3,
      rows: ['....fF..............', '...fFyf.............', '...ffff.............', '....*fl.............'],
    },
    side: {
      y0: 3,
      rows: ['.........fF.........', '........fFyf........', '........ffff........', '.........*fl........'],
    },
    back: {
      y0: 3,
      rows: ['.............fF.....', '............fFyf....', '............ffff....', '.............*f.....'],
    },
  },
  {
    label: '모자',
    a: hexToRgb('#c39a6b'),
    q: hexToRgb('#6b4a5e'),
    front: {
      y0: 0,
      rows: [
        '____________________',
        '______aAAaaaaz______',
        '_____aAAaaaaaaz_____',
        '_____aAaaaaaaaz_____',
        '_____qQqqqqqqqp_____',
        '__aAAaaaaaaaaaaazz__',
        '...zzzzzzzzzzzzzz...',
      ],
    },
    side: {
      y0: 0,
      rows: [
        '____________________',
        '______aAAaaaaz______',
        '_____aAAaaaaaaz_____',
        '_____aAaaaaaaaz_____',
        '_____qQqqqqqqqp_____',
        '___aAAaaaaaaaaaaaz__',
        '....zzzzzzzzzzzzzz..',
      ],
    },
    back: {
      y0: 0,
      rows: [
        '____________________',
        '______aAAaaaaz______',
        '_____aAAaaaaaaz_____',
        '_____aAaaaaaaaz_____',
        '_____qQqqqqqqqp_____',
        '__aAAaaaaaaaaaaazz__',
        '...zzzzzzzzzzzzzz...',
      ],
    },
  },
  {
    label: '나비넥타이',
    a: hexToRgb('#d2485e'),
    q: hexToRgb('#d2485e'),
    front: { y0: 13, rows: ['.......aa..aa.......', '.......aAZZAz.......', '.......az..zz.......'] },
    side: { y0: 13, rows: ['...........aa.......', '...........aA.......', '...........za.......'] },
  },
  {
    label: '귀걸이',
    a: hexToRgb('#e2b54e'),
    q: hexToRgb('#e2b54e'),
    front: { y0: 10, rows: ['....Y..........Y....', '....y..........y....', '....&..........&....'] },
    side: { y0: 10, rows: ['.........Y..........', '........yY..........', '.........&..........'] },
    back: { y0: 10, rows: ['....y..........y....', '....&..........&....'] },
  },
  {
    label: '헤드폰',
    a: hexToRgb('#efe9e4'),
    q: hexToRgb('#4fb0a6'),
    front: {
      y0: 1,
      rows: [
        '......aAAAAaaz......',
        '....aA........zz....',
        '...aA..........az...',
        '...a............z...',
        '...a............z...',
        '..aQq..........qpz..',
        '..aQq..........qpz..',
        '..aqq..........qpz..',
        '..aqp..........ppz..',
      ],
    },
    side: {
      y0: 1,
      rows: [
        '.........aA.........',
        '.........aA.........',
        '.........aa.........',
        '.........aa.........',
        '.........aa.........',
        '.........az.........',
        '........QQqq........',
        '........Qqqp........',
        '........qqqp........',
        '........qppp........',
      ],
    },
    back: {
      y0: 1,
      rows: [
        '......aAAAAaaz......',
        '....aA........zz....',
        '...aA..........az...',
        '...a............z...',
        '...a............z...',
        '..aQq..........qpz..',
        '..aQq..........qpz..',
        '..aqq..........qpz..',
        '..aqp..........ppz..',
      ],
    },
  },
  {
    label: '코르사주',
    a: hexToRgb('#f7f1e6'),
    q: hexToRgb('#f7f1e6'),
    front: { y0: 15, rows: ['..........WWW.......', '.........lWyWl......', '..........vWv.......', '..........lLl.......'] },
    side: { y0: 15, rows: ['...........WW.......', '..........lWy.......', '...........lv.......'] },
  },
  {
    label: '화관',
    a: hexToRgb('#ec8fa6'),
    q: hexToRgb('#ec8fa6'),
    front: { y0: 2, rows: ['.....fF..WW..fF.....', '....lfFlWyWWlfFl....', '....fl........lf....'] },
    side: { y0: 2, rows: ['.....fF..WW..fF.....', '....lfFlWyWWlfFl....', '....fl..............'] },
    back: { y0: 2, rows: ['.....fF..WW..fF.....', '....lfFlWyWWlfFl....', '....fl........lf....'] },
  },
]

export function drawAccessory(g: Grid, view: View, idx: number): void {
  const l = ACCESSORIES[idx]?.[view]
  if (l) stamp(g, l.rows, l.y0)
}
