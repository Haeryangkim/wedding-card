/**
 * 머리 모양 템플릿 — 스타일마다 정면/측면(오른쪽 향함)/후면을 직접 찍은 문자열 그리드.
 * 글자: H 하이라이트, h 기본, g 음영, G 딥(가닥 사이), f 머리끈(고정 분홍), '.' 투명.
 * over = 머리·몸 위에 덮는 층, under = 몸 뒤로 깔리는 층(긴 머리의 뒷부분).
 * 두상(정면 x5..14, y4..12)보다 1px 크게 덮어 볼륨을 준다. 각 행은 반드시 20글자.
 */
import type { View } from './dims'
import { stamp, type Grid } from './grid'

interface Layer {
  y0: number
  rows: string[]
}
interface HairViewDef {
  over: Layer
  under?: Layer
}
export interface HairDef {
  label: string
  front: HairViewDef
  side: HairViewDef
  back: HairViewDef
}

export const HAIRS: HairDef[] = [
  /* 0 ── 숏컷 */
  {
    label: '숏컷',
    front: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhhhHh.....',
          '....hhHHhhhhhHhg....',
          '....hhhhhhhghhgg....',
          '....hhghhhg.ghgg....',
          '....hg........gg....',
        ],
      },
    },
    side: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhh.......',
          '.....hHHHHhhHhh.....',
          '....hhHHhhhhHHhh....',
          '....ghhhhhhhhhhg....',
          '....ghhhhhhhhg......',
          '....gghhhhhg........',
          '....gghhh.hg........',
          '....gghhh...........',
          '.....ghhh...........',
          '......gg............',
        ],
      },
    },
    back: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhhhHh.....',
          '....hhHHhhhhhHhg....',
          '....hhhhhhhhhhgg....',
          '....hhhhhhhhhhgg....',
          '....hhghhhhghhgg....',
          '.....hhhhhhhhhg.....',
          '.....ghghhhghhg.....',
          '.....ghhghhghgg.....',
          '......gggggggg......',
        ],
      },
    },
  },
  /* 1 ── 가르마펌 */
  {
    label: '가르마펌',
    front: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '....hhHHhGhhhhhh....',
          '....hHHhhGhHHhhg....',
          '....hhhhg..ghhhg....',
          '....hhg......ghg....',
          '....gg........gg....',
          '.....g........g.....',
        ],
      },
    },
    side: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '....hhHHHhhhhhhh....',
          '....hhHhhhhhhhhh....',
          '....ghhhhhhhhhhg....',
          '....ghhhhhhhhg......',
          '.....gggghhg........',
          '.....gggg.g.........',
          '.....gggg...........',
          '......ggg...........',
          '......gg............',
        ],
      },
    },
    back: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '....hhHHHhhhhhhh....',
          '....hHHhhhhhhhhg....',
          '....hhhhhhhhhhgg....',
          '....ghhghhhghhgg....',
          '.....gggggggggg.....',
          '.....gggggggggG.....',
          '.....ggggggggGG.....',
          '......ggggggGG......',
          '......gGGGGGGG......',
        ],
      },
    },
  },
  /* 2 ── 단발 */
  {
    label: '단발',
    front: {
      under: {
        y0: 10,
        rows: [
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '.....gggggggggg.....',
        ],
      },
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhhhHh.....',
          '....hhHHhhhhhHhg....',
          '....hHhhhhhhghhg....',
          '....hhhhhhg..ghg....',
          '....hhhg......hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....gh........gg....',
          '.....g........g.....',
        ],
      },
    },
    side: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhh.......',
          '.....hHHHHhhHhh.....',
          '....hhHHhhhhHHhh....',
          '....hhhhhhhhhhhg....',
          '....hhhhhhhhhg......',
          '....hhHhhhg.........',
          '....ghHhhhg.........',
          '....ghhhhhg.........',
          '....ghhhhhg.........',
          '....gghhhhg.........',
          '....gghhhg..........',
          '.....gggg...........',
        ],
      },
    },
    back: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhhhHh.....',
          '....hhHHhhhhhHhg....',
          '....hhhhhhhhhhhg....',
          '....hhhhhhhhhhhg....',
          '....hhhhhhhhhhgg....',
          '....hhhhhhhhhhgg....',
          '....hhhhhhhhhhgg....',
          '....hhghhhghhhgg....',
          '....hhghhhghhhgg....',
          '....ghhhhhhhhhgg....',
          '.....gggggggggg.....',
        ],
      },
    },
  },
  /* 3 ── 긴 생머리 */
  {
    label: '긴 생머리',
    front: {
      under: {
        y0: 9,
        rows: [
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '.....g........g.....',
        ],
      },
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHhGhhhh.....',
          '....hhHhhhGhhhhg....',
          '....hHhg....ghhg....',
          '....hhg......ghg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hhg......ghg....',
          '....hh........hg....',
          '....hg........gg....',
          '....h..........g....',
          '....h..........g....',
          '....g..........g....',
        ],
      },
    },
    side: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhh.......',
          '.....hHHHHhhHhh.....',
          '....hhHHhhhhHHhh....',
          '....hhhhhhhhhhg.....',
          '....hhhhhhhhg.......',
          '....hhHhhhg.........',
          '....hhHhhhg.........',
          '....ghHhhhg.........',
          '....ghhhhhg.........',
          '....ghhhhhg.........',
          '....ghhhhg..........',
          '....ghhhhg..........',
          '....ghhhg...........',
          '....ghhhg...........',
          '....ghhhg...........',
          '....ghhhg...........',
          '....ghhg............',
          '.....ghg............',
          '.....gg.............',
        ],
      },
    },
    back: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhhhHh.....',
          '....hhHHhhhhhHhg....',
          '....hhhhhhhhhhhg....',
          '....hhhhhhhhhhhg....',
          '....hhhghhhhghgg....',
          '....hhhghhhhghgg....',
          '....hhhghhhhghgg....',
          '....hhhghhhhghgg....',
          '....hhhghhhhghgg....',
          '....hhhghhhhghgg....',
          '....hhhghhhhghgg....',
          '....hhhghhhhghgg....',
          '....hhhghhhhghgg....',
          '....hhhghhhhghgg....',
          '....hhhghhhhghgg....',
          '....ghhghhhhghgg....',
          '....gghghhhhghgg....',
          '.....ggggggggg......',
        ],
      },
    },
  },
  /* 4 ── 긴 웨이브 */
  {
    label: '긴 웨이브',
    front: {
      under: {
        y0: 8,
        rows: [
          '...gggggggggggggg...',
          '...gggggggggggggg...',
          '...gggggggggggggg...',
          '...gggggggggggggg...',
          '...gggggggggggggg...',
          '...gggggggggggggg...',
          '...gggggggggggggg...',
          '...gggggggggggggg...',
          '...gggggggggggggg...',
          '...gggggggggggggg...',
          '....gg........gg....',
        ],
      },
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhhhHh.....',
          '....hhHHhhhhhHhg....',
          '...hhHhhhhg..ghhg...',
          '...hhhhg......hhg...',
          '...hHh........hhg...',
          '...hhg........hhg...',
          '....hh........hg....',
          '...hHh........hhg...',
          '...hhg........hhg...',
          '....hh........hg....',
          '...hHhg......ghhg...',
          '...hhhg......ghhg...',
          '....hhg......ghg....',
          '...hHhg......ghhg...',
          '...hhhg......ghhg...',
          '....hhg......ghg....',
          '....gg........gg....',
        ],
      },
    },
    side: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhh.......',
          '.....hHHHHhhHhh.....',
          '....hhHHhhhhHHhh....',
          '...hhhhhhhhhhhg.....',
          '...ghhhhhhhhg.......',
          '...ghHhhhhhg........',
          '..ghHhhhhhg.........',
          '..ghhhhhhhg.........',
          '...ghhhHhhg.........',
          '...ghhHhhhg.........',
          '..ghhHhhhg..........',
          '..ghhhhhhg..........',
          '...ghhhHhg..........',
          '...ghhHhhg..........',
          '..ghhHhhg...........',
          '..ghhhhhg...........',
          '...gghhg............',
          '....ggg.............',
        ],
      },
    },
    back: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhhhHh.....',
          '....hhHHhhhhhHhg....',
          '...hhhhhhhhhhhhhg...',
          '...hhhhhhhhhhhhgg...',
          '...hhhghhhhghhhgg...',
          '...hhhghhHhghhhgg...',
          '....hhhghhHhghhg....',
          '....hhhghhhhghhg....',
          '...hhhghhhhghhhgg...',
          '...hhhghHhhghhhgg...',
          '....hhhghHhhghhg....',
          '....hhhghhhhghhg....',
          '...hhhghhhhghhhgg...',
          '...hhhghHhhghhhgg...',
          '....hhhghhhhghhg....',
          '....gghhghhhghgg....',
          '.....gg.ggg.ggg.....',
        ],
      },
    },
  },
  /* 5 ── 포니테일 */
  {
    label: '포니테일',
    front: {
      under: {
        y0: 0,
        rows: [
          '..........hhhh......',
          '.........hHHhh......',
          '..........hhhhg.....',
          '....................',
          '....................',
          '....................',
          '....................',
          '....................',
          '...............hh...',
          '...............hhg..',
          '..............hHhg..',
          '..............hhhg..',
          '..............hhhg..',
          '..............hhg...',
          '...............hg...',
          '...............g....',
        ],
      },
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhhhHh.....',
          '....hhHHhhhhhHhg....',
          '....hhhghhhghhhg....',
          '....hh.g...g..hg....',
          '....hg........gg....',
          '....g..........g....',
        ],
      },
    },
    side: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhh.......',
          '.....hHHHHhhHhh.....',
          '....hhHHhhhhHHhh....',
          '..hhfhhhhhhhhhg.....',
          '..hHgghhhhhhg.g.....',
          '..hHg.hhhhhg........',
          '..hhg.ghh.hg........',
          '..hhg.ggh...........',
          '..hhg.gg............',
          '..hhg...............',
          '..ghg...............',
          '...hg...............',
          '...gg...............',
        ],
      },
    },
    back: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhhhHh.....',
          '....hhHhhhhhhhhg....',
          '....hhhghHhhghgg....',
          '....hhhghHhhghgg....',
          '....hhhghHhhghgg....',
          '.....hhghhhhghg.....',
          '.....ghghhhhggg.....',
          '.....gggHhhhggg.....',
          '......gghhhhgg......',
          '........hHhg........',
          '........hhhg........',
          '........hhhg........',
          '........hhgg........',
          '.........gg.........',
        ],
      },
    },
  },
  /* 6 ── 올림머리 */
  {
    label: '올림머리',
    front: {
      over: {
        y0: 0,
        rows: [
          '........hhhh........',
          '.......hHHhhg.......',
          '......hhHhhhgg......',
          '.....hhgggggghh.....',
          '....hhHHhhhhhHhg....',
          '....hhhhg..ghhhg....',
          '....hh........hg....',
          '....hg........gg....',
          '....g..........g....',
        ],
      },
    },
    side: {
      over: {
        y0: 1,
        rows: [
          '...hhh..............',
          '..hHHhghhhhhhh......',
          '..hHhhghHHHHhhhh....',
          '..hhhhghHHhhhhhh....',
          '....ghhhhhhhhhg.....',
          '....ghhhhhhhg.g.....',
          '....gghhhhg.........',
          '.....ghhh.g.........',
          '.....gghh...........',
          '......gg............',
        ],
      },
    },
    back: {
      over: {
        y0: 0,
        rows: [
          '........hhhh........',
          '.......hHHhhg.......',
          '......hhHhhhgg......',
          '.....hhgggggghh.....',
          '....hhHHhhhhhHhg....',
          '....hhhhhhhhhhgg....',
          '....hhhhhhhhhhgg....',
          '....hhhhhhhhhhgg....',
          '.....hhhhhhhhhg.....',
          '.....ghhhhhhhgg.....',
          '......gghhhggg......',
          '......gggggggg......',
        ],
      },
    },
  },
  /* 7 ── 곱슬 펌 */
  {
    label: '곱슬 펌',
    front: {
      over: {
        y0: 1,
        rows: [
          '......hh.hhh.hh.....',
          '....hhHhhhHhhhhh....',
          '...hHHhhHHhhhHHhh...',
          '...hHhggHhhggHhhg...',
          '..hhhgghhhgghhhggg..',
          '..hHhhg.gg..ghhhgg..',
          '..hhhg........hhgg..',
          '...hg..........gg...',
          '...g............g...',
        ],
      },
    },
    side: {
      over: {
        y0: 1,
        rows: [
          '......hh.hhh.hh.....',
          '....hhHhhhHhhhhh....',
          '...hHHhhHHhhhHHhh...',
          '...hHhggHhhggHhhh...',
          '..hhhgghhhgghhhg....',
          '..hHhhhHhhhhhg.g....',
          '..hhhgghhhhg........',
          '...hhgghh.hg........',
          '...ghhhhh...........',
          '....gghg............',
          '.....gg.............',
        ],
      },
    },
    back: {
      over: {
        y0: 1,
        rows: [
          '......hh.hhh.hh.....',
          '....hhHhhhHhhhhh....',
          '...hHHhhHHhhhHHhh...',
          '...hHhggHhhggHhhg...',
          '..hhhgghhhgghhhggg..',
          '..hHhhhHhhhhHhhhgg..',
          '..hhhgghHhgghhhggg..',
          '...hhgghhhgghhhgg...',
          '...ghhhhHhhhhhgg....',
          '....gghgghhgggg.....',
          '......gggggggg......',
        ],
      },
    },
  },
  /* 8 ── 반삭 */
  {
    label: '반삭',
    front: {
      over: {
        y0: 3,
        rows: [
          '......hhhhhhhh......',
          '......hhhhhhhh......',
          '.....hhghghghgg.....',
          '.....g........g.....',
        ],
      },
    },
    side: {
      over: {
        y0: 3,
        rows: [
          '......hhhhhhh.......',
          '......hhhhhhhh......',
          '.....ghhhhhhg.......',
          '.....ghhhhhg........',
          '.....ghhhhg.........',
          '.....ghhh.g.........',
          '.....gghh...........',
          '......gg............',
        ],
      },
    },
    back: {
      over: {
        y0: 3,
        rows: [
          '......hhhhhhhh......',
          '......hhhhhhhh......',
          '.....hhhhhhhhhg.....',
          '.....hhhhhhhhhg.....',
          '.....hhhhhhhhhg.....',
          '.....hhhhhhhhhg.....',
          '.....gghghghggg.....',
          '......gggggggg......',
        ],
      },
    },
  },
  /* 9 ── 뱅 중단발 */
  {
    label: '뱅 중단발',
    front: {
      under: {
        y0: 10,
        rows: [
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '....gggggggggggg....',
          '.....gggggggggg.....',
        ],
      },
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhhhHh.....',
          '....hhHHhhhhhHhg....',
          '....hhhhhhhhhhhg....',
          '....hhhhhhhhhhhg....',
          '....hhhhghhghhhg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hh........hg....',
          '....hhg......ghg....',
          '....ghg......ggg....',
          '.....g........g.....',
        ],
      },
    },
    side: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhh.......',
          '.....hHHHHhhHhh.....',
          '....hhHHhhhhHHhh....',
          '....hhhhhhhhhhhg....',
          '....hhhhhhhhhhhg....',
          '....hhHhhhg.hg......',
          '....ghHhhhg.........',
          '....ghhhhhg.........',
          '....ghhhhhg.........',
          '....ghhhhhg.........',
          '....ghhhhhg.........',
          '....ghhhhg..........',
          '....gghhhhg.........',
          '....gghhhg..........',
          '.....gggg...........',
        ],
      },
    },
    back: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhhhHh.....',
          '....hhHHhhhhhHhg....',
          '....hhhhhhhhhhhg....',
          '....hhhhhhhhhhhg....',
          '....hhhhhhhhhhgg....',
          '....hhhhhhhhhhgg....',
          '....hhhhhhhhhhgg....',
          '....hhhghhhghhgg....',
          '....hhhghhhghhgg....',
          '....hhhghhhghhgg....',
          '....hhhghhhghhgg....',
          '....hhghhhghhhgg....',
          '....ghhhhhhhhhgg....',
          '.....gggggggggg.....',
        ],
      },
    },
  },
  /* 10 ── 포마드 */
  {
    label: '포마드',
    front: {
      over: {
        y0: 1,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHHHhhh.....',
          '....hHHhhhhHHhhg....',
          '....hHghhhghhhhg....',
          '....hg........gg....',
          '....g..........g....',
        ],
      },
    },
    side: {
      over: {
        y0: 1,
        rows: [
          '.......hhhhhhh......',
          '......hhhHHHhhhh....',
          '....hhhhhhhHHhhhh...',
          '....hhghhhghhhhhh...',
          '....ghhhghhhg.......',
          '....gghhhhhg........',
          '....gghhhhg.........',
          '.....ghhh.g.........',
          '.....gghh...........',
          '......gg............',
        ],
      },
    },
    back: {
      over: {
        y0: 1,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHHhhhh.....',
          '....hHHhhhhhhhhg....',
          '....hhghhhghhhhg....',
          '....hhghhhghhhgg....',
          '....hhhhhhhhhhgg....',
          '....hhhhhhhhhhgg....',
          '.....hhhhhhhhhg.....',
          '.....ghhhhhhhhg.....',
          '.....ghhhhhhhgg.....',
          '......gggggggg......',
        ],
      },
    },
  },
  /* 11 ── 양갈래 */
  {
    label: '양갈래',
    front: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHhGhhhh.....',
          '....hhHhhhGhhhhg....',
          '....hhhg....ghhg....',
          '....hh........hg....',
          '....hg........gg....',
          '...hhg........ghg...',
          '...ff..........ff...',
          '..hhhg........hhhg..',
          '..hHhg........hHhg..',
          '..hhhg........hhgg..',
          '..hhhg........hhgg..',
          '..hhg..........hgg..',
          '...hg..........hg...',
          '...g............g...',
        ],
      },
    },
    side: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhh.......',
          '.....hHHHHhhHhh.....',
          '....hhHHhhhhHHhh....',
          '....hhhhhhhhhhg.....',
          '....ghhhhhhhg.......',
          '....ghhhhhhg........',
          '....gghhhhhg........',
          '.....ghhhhg.........',
          '.....gfff...........',
          '.....hhhhg..........',
          '.....hhhhg..........',
          '.....hhhhg..........',
          '.....hhhgg..........',
          '......hhg...........',
          '......hg............',
          '......g.............',
        ],
      },
    },
    back: {
      over: {
        y0: 2,
        rows: [
          '......hhhhhhhh......',
          '.....hHHHHhGhhh.....',
          '....hhHHhhhGhhhg....',
          '....hhhhhhhGhhgg....',
          '....hhhhhhhGhhgg....',
          '....hhhhhhgGghgg....',
          '...hhhhhhhgGghhgg...',
          '...fffgggggggfff....',
          '..hhhh.gggggg.hhg...',
          '..hHhh........Hhg...',
          '..hHhh........hhg...',
          '..hhhh........hgg...',
          '..hhhg........hgg...',
          '...hhg........hg....',
          '...gg.........g.....',
        ],
      },
    },
  },
]

export function drawHairUnder(g: Grid, view: View, style: number): void {
  const d = HAIRS[style]?.[view]
  if (d?.under) stamp(g, d.under.rows, d.under.y0)
}
export function drawHairOver(g: Grid, view: View, style: number): void {
  const d = HAIRS[style]?.[view]
  if (d) stamp(g, d.over.rows, d.over.y0)
}
