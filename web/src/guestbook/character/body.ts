/**
 * 몸 기본형: 머리·얼굴·목·팔·다리 템플릿. (재질 글자는 palette/sprites 의 Lut 참고)
 *
 * 좌표(20x36): 머리 피부 y4..12 (정면 x5..14 + 귀), 목 y13, 어깨 y14, 몸통 y14..22,
 * 골반·다리 y23..32, 신발 y33..34, 바닥 외곽선 y35. 머리(머리카락 포함) ≈ 전체 키의 1/3. 조명은 좌상단.
 * 걷기(1·2)는 상체 전체가 1px 내려가고(bob) 다리가 번갈아 들리며 팔이 반대로 흔들린다.
 * 다리 템플릿은 프레임별 절대좌표 — 디딤발은 항상 같은 높이(y33..34)에 붙어 있고,
 * 상체(머리 포함)는 한 덩어리로만 움직여 흔들림이 없다.
 */
import type { Frame, View } from './dims'
import { setPx, stamp, type Grid, type Remap } from './grid'

/* ── 머리 ───────────────────────────────────────────────── */
const HEAD_FRONT = [
  '.......kkkkkk.......', // y4
  '......kkkkkkkk......',
  '.....kkkkkkkkkj.....',
  '.....kkkkkkkkkj.....',
  '....kkkkkkkkkkjj....', // y8 귀·눈
  '....jkkkkkkkkkjj....',
  '.....kkkkkkkkkj.....',
  '......kkkkkkjj......',
  '.......jkkjjj.......', // y12 턱
]
/** 오른쪽을 보는 옆얼굴: 뒤통수 x5, 이마 x14, 코끝 x15 */
const HEAD_SIDE = [
  '......kkkkkkk.......', // y4
  '.....kkkkkkkkk......',
  '.....kkkkkkkkkk.....',
  '.....kkkkkkkkkk.....',
  '.....kkkkkkkkkk.....', // y8 눈
  '.....kkkkjkkkkkk....', // y9 귀 x9, 코끝 x15
  '.....jkkkjkkkkk.....',
  '......jjkkkkkkk.....',
  '.......jjjkkkk......', // y12 턱
]
const HEAD_BACK = [
  '.......kkkkkk.......',
  '......kkkkkkkk......',
  '.....kkkkkkkkkk.....',
  '.....kkkkkkkkkk.....',
  '....kkkkkkkkkkkj....',
  '....jkkkkkkkkkjj....',
  '.....kkkkkkkkkj.....',
  '......kkkkkkjj......',
  '.......jjjjjj.......',
]

export function drawHead(g: Grid, view: View): void {
  stamp(g, view === 'front' ? HEAD_FRONT : view === 'side' ? HEAD_SIDE : HEAD_BACK, 4)
}

export function drawNeck(g: Grid, view: View): void {
  if (view === 'side') stamp(g, ['........jjkk........', '........jkkk........'], 13)
  else stamp(g, ['........jjjj........', '.......kkkkkk.......'], 13)
}

/** 눈(2px 높이 + 하이라이트)·볼터치·입. 측면은 눈 하나만 보이는 진짜 옆얼굴. */
export function drawFace(g: Grid, view: View): void {
  if (view === 'back') return
  if (view === 'side') {
    stamp(g, ['............Xx......', '.............x......', '..........uu........', '.............m......'], 8)
    return
  }
  stamp(
    g,
    ['......Xx....Xx......', '......xx....xx......', '.....uu......uu.....', '.........mm.........'],
    8,
  )
}

/** 머리카락 바로 아래 피부에 드리운 그림자 (앞머리의 입체감) */
export function castHairShadow(g: Grid): void {
  for (let y = 5; y <= 11; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x
      if (g.data[i] !== 107 /* k */) continue
      const up = g.data[i - g.w]
      // H h g G
      if (up === 72 || up === 104 || up === 103 || up === 71) g.data[i] = 106 /* j */
    }
  }
}

/* ── 다리 ───────────────────────────────────────────────── */
/** 바지(e 계열) 정면/후면. [frame] → { y0, rows } */
const LEGS_FRONT: { y0: number; rows: string[] }[] = [
  {
    y0: 23,
    rows: [
      '......eeeeeeed......',
      '......eeeeeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eedDeedd......',
      '......oooNooon......',
      '.....ooooNoooon.....',
    ],
  },
  {
    y0: 24,
    rows: [
      '......eeeeeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eddDeeed......',
      '......ooondeed......',
      '.....oooon.eed......',
      '..........eedd......',
      '..........ooon......',
      '..........oooon.....',
    ],
  },
  {
    y0: 24,
    rows: [
      '......eeeeeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eeeDeeed......',
      '......eeedeedd......',
      '......eeedooon......',
      '......eeed.oooon....',
      '......eedd..........',
      '......ooon..........',
      '.....oooon..........',
    ],
  },
]
/** 맨다리(k 계열, 치마 아래) 정면/후면 — 바지보다 가늘다 */
const BARE_FRONT: { y0: number; rows: string[] }[] = [
  {
    y0: 24,
    rows: [
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......ooNoon.......',
      '......oooNooon......',
    ],
  },
  {
    y0: 25,
    rows: [
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......oonkkj.......',
      '......ooonkkj.......',
      '..........kkj.......',
      '..........kkj.......',
      '..........oon.......',
      '..........ooon......',
    ],
  },
  {
    y0: 25,
    rows: [
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjkkj.......',
      '.......kkjoon.......',
      '.......kkjooon......',
      '.......kkj..........',
      '.......kkj..........',
      '.......oon..........',
      '......ooon..........',
    ],
  },
]
/** 바지 측면(오른쪽 향함). 뒤쪽(먼) 다리는 음영 톤 */
const LEGS_SIDE: { y0: number; rows: string[] }[] = [
  {
    y0: 23,
    rows: [
      '.......eeeeed.......',
      '.......eeeed........',
      '........eeed........',
      '........eeed........',
      '........eeed........',
      '........eeed........',
      '........eeed........',
      '........eeed........',
      '........eeed........',
      '........eedd........',
      '........ooon........',
      '........ooooon......',
    ],
  },
  {
    y0: 24,
    rows: [
      '.......eeeeed.......',
      '.......deeeed.......',
      '.......ddeeed.......',
      '......dddeeed.......',
      '......ddd.eeed......',
      '.....ddd..eeed......',
      '....ddd....eeed.....',
      '....ddd....eeed.....',
      '...nnn.....eedd.....',
      '...nnnn....ooon.....',
      '...........ooooon...',
    ],
  },
  {
    y0: 24,
    rows: [
      '.......eeeeed.......',
      '.......eeeedd.......',
      '.......eeeDdd.......',
      '......eeeDddd.......',
      '......eeed.ddd......',
      '.....eeed..ddd......',
      '....eeed....ddd.....',
      '....eedd....ddd.....',
      '...ooon.....ddd.....',
      '...oooon....nnn.....',
      '............nnnnn...',
    ],
  },
]
/** 맨다리 측면 */
const BARE_SIDE: { y0: number; rows: string[] }[] = [
  {
    y0: 24,
    rows: [
      '.........kkj........',
      '.........kkj........',
      '.........kkj........',
      '.........kkj........',
      '.........kkj........',
      '.........kkj........',
      '.........kkj........',
      '.........kkj........',
      '.........kkj........',
      '.........oon........',
      '.........oooon......',
    ],
  },
  {
    y0: 25,
    rows: [
      '.........kkj........',
      '........jkkj........',
      '........jjkkj.......',
      '.......jj.kkj.......',
      '.......jj..kkj......',
      '......jj...kkj......',
      '.....jj.....kkj.....',
      '.....nn.....kkj.....',
      '.....nnn....oon.....',
      '............oooon...',
    ],
  },
  {
    y0: 25,
    rows: [
      '.........kkj........',
      '........kkjj........',
      '........kkjjj.......',
      '.......kkj.jj.......',
      '.......kkj..jj......',
      '......kkj...jj......',
      '.....kkj.....jj.....',
      '.....oon.....jj.....',
      '.....ooon....nn.....',
      '.............nnnn...',
    ],
  },
]

export type LegKind = 'pants' | 'bare'

/** 다리+신발. remap 으로 바지 재질군(e)·스타킹 등을 바꿀 수 있다. */
export function drawLegs(g: Grid, view: View, frame: Frame, kind: LegKind, remap?: Remap): void {
  const set =
    view === 'side'
      ? kind === 'pants'
        ? LEGS_SIDE
        : BARE_SIDE
      : kind === 'pants'
        ? LEGS_FRONT
        : BARE_FRONT
  const t = set[frame]
  stamp(g, t.rows, t.y0, 0, remap)
}

/* ── 팔 ─────────────────────────────────────────────────── */
export type SleeveKind = 'long' | 'short' | 'cap' | 'none' | 'wide'
export interface Sleeve {
  kind: SleeveKind
  /** 소매 재질군 4글자 (하이·기본·음영·딥), 예: 'CcbB' */
  fam: string
  /** 소매 끝 행(커프스·시보리)의 [밝은쪽, 어두운쪽] 글자 */
  cuff?: string
  /** wide(한복) 소매 끝동 재질군 */
  trim?: string
}

const SKIN = 'KkjJ'

/** 프레임별 팔 흔들림: [왼팔 dy, 오른팔 dy] (정면 기준, 다리와 반대) */
const ARM_SWING: Record<Frame, readonly [number, number]> = { 0: [0, 0], 1: [1, -1], 2: [-1, 1] }

const ARM_Y = 15

/** 어깨(ARM_Y)부터 소매가 덮는 행 수 */
function coverRows(kind: SleeveKind, len: number): number {
  if (kind === 'none') return 0
  if (kind === 'cap') return 2
  if (kind === 'short') return 3
  return len
}

/** 정면/후면 팔 한 쌍. 상체 그리드(bob 적용 전 좌표)에 그린다. */
export function drawArmsFront(g: Grid, frame: Frame, sl: Sleeve, back = false): void {
  const swing = ARM_SWING[frame]
  for (const side of [0, 1] as const) {
    // 후면에서는 좌우가 뒤바뀌어 보인다
    const s = back ? swing[1 - side] : swing[side]
    const xo = side === 0 ? 4 : 15 // 바깥 열
    const xi = side === 0 ? 5 : 14 // 안쪽 열
    const xw = side === 0 ? 3 : 16 // 한복 배래가 넓어지는 열
    const len = 7 + s
    const cover = coverRows(sl.kind, len)
    for (let r = 0; r < len; r++) {
      const y = ARM_Y + r
      const clothed = r < cover
      const fam = clothed ? sl.fam : SKIN
      const last = clothed && r === cover - 1
      let outer = side === 0 ? fam[1] : r < 2 ? fam[1] : fam[2]
      // 안쪽 열은 몸통과 팔을 가르는 어두운 선
      let inner = r === 0 ? fam[2] : fam[3]
      if (r === 0 && side === 0) outer = fam[0]
      if (!clothed) {
        outer = 'k'
        inner = 'j'
      } else if (last && (sl.kind === 'short' || sl.kind === 'cap')) {
        outer = fam[2]
        inner = fam[3]
      } else if (last && sl.cuff) {
        outer = sl.cuff[0]
        inner = sl.cuff[1]
      }
      if (sl.kind === 'wide' && r >= 2) {
        // 한복 배래: 아래로 갈수록 바깥으로 둥글게 넓어진다
        let w = side === 0 ? fam[1] : fam[2]
        if (r === 2) w = fam[2]
        if (last && sl.trim) {
          w = sl.trim[2]
          outer = sl.trim[1]
          inner = sl.trim[2]
        } else if (last) {
          w = fam[2]
          outer = fam[2]
          inner = fam[3]
        }
        setPx(g, xw, y, w)
      }
      setPx(g, xo, y, outer)
      setPx(g, xi, y, inner)
    }
    // 손
    const hy = ARM_Y + len
    setPx(g, xo, hy, 'k')
    setPx(g, xi, hy, side === 0 ? 'k' : 'j')
    setPx(g, xo, hy + 1, side === 0 ? 'k' : 'j')
    setPx(g, xi, hy + 1, 'j')
  }
}

/** 측면 팔의 행별 x 오프셋 (0=몸 중앙). back=뒤로, fwd=앞으로 */
const SIDE_OFF = {
  rest: [0, 0, 0, 0, 0, 0, 0, 0],
  back: [0, 0, -1, -1, -2, -3, -3, -3],
  fwd: [0, 0, 1, 1, 2, 3, 3, 3],
} as const

function sideArm(g: Grid, sl: Sleeve, off: readonly number[], far: boolean): void {
  const swung = off[7] !== 0
  const len = swung ? 6 : 7
  const cover = coverRows(sl.kind, len)
  for (let r = 0; r < len; r++) {
    const y = ARM_Y + r
    const x = 9 + off[r]
    const clothed = r < cover
    const fam = clothed ? sl.fam : SKIN
    const last = clothed && r === cover - 1
    let edge = fam[3]
    let b = far ? fam[2] : fam[1]
    let c = far ? fam[2] : r < 2 ? fam[0] : fam[1]
    if (!clothed) {
      edge = 'j'
      b = far ? 'j' : 'k'
      c = far ? 'j' : 'k'
    } else if (last && (sl.kind === 'short' || sl.kind === 'cap')) {
      b = fam[2]
      c = fam[2]
    } else if (last && sl.cuff) {
      b = sl.cuff[far ? 1 : 0]
      c = sl.cuff[far ? 1 : 0]
    } else if (last && sl.trim) {
      b = sl.trim[far ? 2 : 1]
      c = sl.trim[far ? 2 : 1]
    }
    const wide = sl.kind === 'wide' && r >= 2
    if (!far || wide) setPx(g, x - 1, y, edge)
    setPx(g, x, y, b)
    setPx(g, x + 1, y, c)
    if (wide) setPx(g, x + 2, y, last && sl.trim ? sl.trim[2] : last ? fam[3] : fam[2])
  }
  const hy = ARM_Y + len
  const hx = 9 + off[len]
  const hk = far ? 'j' : 'k'
  setPx(g, hx, hy, hk)
  setPx(g, hx + 1, hy, hk)
  setPx(g, hx, hy + 1, 'j')
  setPx(g, hx + 1, hy + 1, hk)
}

/** 측면: 몸 뒤로 비치는 먼 팔 (몸통보다 먼저 그릴 것) */
export function drawArmSideFar(g: Grid, frame: Frame, sl: Sleeve): void {
  if (frame === 0) return
  sideArm(g, sl, frame === 1 ? SIDE_OFF.fwd : SIDE_OFF.back, true)
}
/** 측면: 몸 앞의 가까운 팔 (몸통 뒤에 그릴 것) */
export function drawArmSideNear(g: Grid, frame: Frame, sl: Sleeve): void {
  sideArm(g, sl, frame === 0 ? SIDE_OFF.rest : frame === 1 ? SIDE_OFF.back : SIDE_OFF.fwd, false)
}

/** 드레스 목선·민소매 아래로 비치는 상체 피부 */
export function drawTorsoSkin(g: Grid, view: View): void {
  if (view === 'side') {
    stamp(g, ['.......jkkkk........'], 14)
    for (let y = 15; y <= 22; y++) stamp(g, ['......jkkkkkk.......'], y)
  } else {
    stamp(g, ['.....kkkkkkkkkj.....'], 14)
    for (let y = 15; y <= 22; y++) stamp(g, ['......kkkkkkkj......'], y)
  }
}
