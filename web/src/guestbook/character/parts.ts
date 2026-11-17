/**
 * 파츠 드로잉 — 모두 재질 id 를 그리드에 찍는다 (색 해석은 sprites.ts).
 * 좌표계: 20x28, 머리 중심 x=9.5. right(우향 3/4) 를 그리고 left 는 좌우반전.
 * 조명은 좌상단. 걷기 애니는 머리/몸통 고정, 다리·팔만 움직여 머리 흔들림 없음.
 */
import type { Dir, Frame } from './dims'
import { M, type Mat } from './palette'
import { fillEllipse, hspan, rect, setPx, vspan, type Grid } from './grid'

/* ── 머리 기하 ─────────────────────────────────────────── */
const CX = 9.5
const HEAD_CY = 6.6
const HEAD_RX = 6
const HEAD_RY = 6.4
const BROW = 8 // 눈썹/앞머리 라인
const EYE_Y = 9

function headHalf(y: number): number {
  const dy = (y + 0.5 - HEAD_CY) / HEAD_RY
  if (Math.abs(dy) >= 1) return 0
  return HEAD_RX * Math.sqrt(1 - dy * dy)
}

/* ── 몸통/다리 기하 ───────────────────────────────────────── */
const SHOULDER_Y = 15
const TORSO_BOT = 21
const LEG_TOP = 22
const FOOT_Y = 26 // 발(신발) 상단

/** 프레임별 두 다리 x 중심과 발 높이 오프셋 (정면/후면). */
function legsFront(frame: Frame) {
  // 좌/우 다리 x 중심
  const lx = 8
  const rx = 11
  // 걷을 때 한쪽 발을 살짝 들고 앞으로 (발 흔들림으로 보행감)
  const lift = frame === 1 ? ([1, 0] as const) : frame === 2 ? ([0, 1] as const) : ([0, 0] as const)
  const stepX = frame === 1 ? ([-1, 1] as const) : frame === 2 ? ([1, -1] as const) : ([0, 0] as const)
  return { lx, rx, lift, stepX }
}

/* ── 피부 머리 + 목 ───────────────────────────────────────── */
function drawHead(g: Grid, _dir: Dir): void {
  fillEllipse(g, CX, HEAD_CY, HEAD_RX, HEAD_RY, M.SKIN)
  // 좌상단 하이라이트
  for (let y = 2; y <= 5; y++) {
    const hw = headHalf(y)
    const x0 = Math.round(CX - hw)
    setPx(g, x0 + 1, y, M.SKIN_HI)
    if (y <= 4) setPx(g, x0 + 2, y, M.SKIN_HI)
  }
  // 우/하단 음영 (턱선)
  for (let y = 9; y <= 12; y++) {
    const hw = headHalf(y)
    const x1 = Math.round(CX + hw) - 1
    setPx(g, x1, y, M.SKIN_SH)
  }
  hspan(g, 12, 8, 11, M.SKIN_SH) // 턱 밑 음영
  // 목
  rect(g, 8, 13, 11, 14, M.SKIN)
  hspan(g, 13, 8, 11, M.SKIN_SH)
}

/* ── 얼굴 ────────────────────────────────────────────────── */
function drawFace(g: Grid, dir: Dir): void {
  if (dir === 'up') return
  if (dir === 'right' || dir === 'left') {
    // 3/4 우향: 눈 두 개를 오른쪽으로 치우쳐 (left 는 반전)
    // 가까운 눈
    rect(g, 11, EYE_Y, 12, EYE_Y + 1, M.EYE)
    setPx(g, 11, EYE_Y, M.LIGHT) // 반짝
    // 먼 눈 (작게)
    setPx(g, 7, EYE_Y, M.EYE)
    setPx(g, 7, EYE_Y + 1, M.EYE)
    // 코끝
    setPx(g, 15, EYE_Y + 1, M.SKIN_SH)
    // 볼터치 + 입
    setPx(g, 13, EYE_Y + 2, M.BLUSH)
    setPx(g, 12, EYE_Y + 3, M.MOUTH)
    return
  }
  // 정면
  rect(g, 6, EYE_Y, 7, EYE_Y + 1, M.EYE)
  rect(g, 12, EYE_Y, 13, EYE_Y + 1, M.EYE)
  setPx(g, 6, EYE_Y, M.LIGHT) // 눈 반짝
  setPx(g, 12, EYE_Y, M.LIGHT)
  // 볼터치
  setPx(g, 5, EYE_Y + 1, M.BLUSH)
  setPx(g, 14, EYE_Y + 1, M.BLUSH)
  setPx(g, 4, EYE_Y + 1, M.BLUSH)
  setPx(g, 15, EYE_Y + 1, M.BLUSH)
  // 입
  setPx(g, 9, EYE_Y + 3, M.MOUTH)
  setPx(g, 10, EYE_Y + 3, M.MOUTH)
}

/* ── 몸통(팔/손) + 다리/신발 (피부+신발, 의상이 위에 덧칠) ───────── */
function drawBodyBase(g: Grid, dir: Dir, frame: Frame): void {
  // 팔 스윙 (의상색이 덮지만 소매 밖 손만 피부로 남음)
  // 몸통 실루엣은 outfit 에서 그림. 여기선 손/다리/신발만.
  const { lx, rx, lift, stepX } = legsFront(frame)

  if (dir === 'left' || dir === 'right') {
    // 측면: 다리 두 개가 거의 겹침, 앞뒤로 스윙
    const front = 10 + stepX[0]
    const back = 9 + stepX[1]
    // 뒷다리
    vspan(g, back, LEG_TOP, FOOT_Y - 1, M.SKIN)
    hspan(g, FOOT_Y + lift[1], back - 1, back + 1, M.SHOE)
    setPx(g, back + 2, FOOT_Y + lift[1], M.SHOE) // 발끝
    // 앞다리
    vspan(g, front, LEG_TOP, FOOT_Y - 1, M.SKIN)
    hspan(g, FOOT_Y + lift[0], front - 1, front + 1, M.SHOE)
    setPx(g, front + 2, FOOT_Y + lift[0], M.SHOE)
    // 손 (앞으로 뻗은 한 손만 보임)
    setPx(g, 13, 19 + lift[0], M.SKIN)
    return
  }

  // 정면/후면 다리
  for (const [cx, lf, sx] of [
    [lx, lift[0], stepX[0]],
    [rx, lift[1], stepX[1]],
  ] as const) {
    const x = cx + sx
    vspan(g, x, LEG_TOP, FOOT_Y - 1 - lf, M.SKIN)
    setPx(g, x + (cx === lx ? -1 : 1), LEG_TOP, M.SKIN) // 허벅지 살짝
    // 신발
    hspan(g, FOOT_Y - lf, x - 1, x + 1, M.SHOE)
    hspan(g, FOOT_Y + 1 - lf, x - 1, x + 1, M.SHOE)
    setPx(g, x + 1, FOOT_Y + 1 - lf, M.SHOE_SH)
  }
  // 손 (소매 끝)
  const armSwing = frame === 1 ? 1 : frame === 2 ? -1 : 0
  setPx(g, 4, 20 + armSwing, M.SKIN) // 왼손
  setPx(g, 15, 20 - armSwing, M.SKIN) // 오른손
}

/* ── 의상 ───────────────────────────────────────────────── */
export interface OutfitDef {
  label: string
  draw: (g: Grid, dir: Dir, frame: Frame) => void
}

/** 몸통 실루엣 (어깨~허리) 채우기. collar=목선 음영. */
function torso(g: Grid, main: Mat): void {
  // 사다리꼴 몸통
  const rows: [number, number, number][] = [
    [SHOULDER_Y, 5, 14],
    [SHOULDER_Y + 1, 5, 14],
    [SHOULDER_Y + 2, 5, 14],
    [SHOULDER_Y + 3, 6, 13],
    [SHOULDER_Y + 4, 6, 13],
    [TORSO_BOT, 6, 13],
  ]
  for (const [y, x0, x1] of rows) hspan(g, y, x0, x1, main)
}

/** 소매 (어깨에서 손목까지). */
function sleeves(g: Grid, frame: Frame, main: Mat): void {
  const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0
  vspan(g, 4, 16, 19 + sw, main) // 왼팔
  vspan(g, 5, 16, 18 + sw, main)
  vspan(g, 15, 16, 19 - sw, main) // 오른팔
  vspan(g, 14, 16, 18 - sw, main)
}

/** 바지 (두 다리를 CLOTH2 로 덮음, 발은 남김). */
function pants(g: Grid, frame: Frame, mat: Mat): void {
  const { lx, rx, lift, stepX } = legsFront(frame)
  for (const [cx, lf, sx] of [
    [lx, lift[0], stepX[0]],
    [rx, lift[1], stepX[1]],
  ] as const) {
    const x = cx + sx
    vspan(g, x, LEG_TOP, FOOT_Y - 2 - lf, mat)
    setPx(g, x + (cx === lx ? -1 : 1), LEG_TOP, mat)
  }
  hspan(g, LEG_TOP, 6, 13, mat) // 허리
}

/** 치마/드레스 A라인 (상단 허리에서 퍼짐). */
function skirt(g: Grid, topY: number, botY: number, mat: Mat, shade: Mat): void {
  const span = botY - topY
  for (let y = topY; y <= botY; y++) {
    const t = (y - topY) / span
    const half = 3 + Math.round(t * 4)
    hspan(g, y, Math.round(CX - half), Math.round(CX + half), mat)
    setPx(g, Math.round(CX + half), y, shade) // 우측 음영
  }
}

const OUTFITS: OutfitDef[] = [
  // 0 정장 (재킷 + 셔츠 + 넥타이)
  {
    label: '정장',
    draw: (g, _d, f) => {
      torso(g, M.CLOTH)
      sleeves(g, f, M.CLOTH)
      pants(g, f, M.CLOTH2)
      // 셔츠 V + 넥타이
      vspan(g, 9, SHOULDER_Y, SHOULDER_Y + 3, M.LIGHT)
      vspan(g, 10, SHOULDER_Y, SHOULDER_Y + 3, M.LIGHT)
      setPx(g, 9, SHOULDER_Y + 1, M.CLOTH_SH)
      vspan(g, 9, SHOULDER_Y + 1, SHOULDER_Y + 4, M.ACC) // 넥타이(강조색 대신 음영)
      setPx(g, 9, SHOULDER_Y + 4, M.ACC)
      // 라펠
      setPx(g, 8, SHOULDER_Y + 1, M.CLOTH_HI)
      setPx(g, 11, SHOULDER_Y + 1, M.CLOTH_HI)
    },
  },
  // 1 드레스
  {
    label: '드레스',
    draw: (g, _d, _f) => {
      // 상의 (어깨끈 + 상체)
      for (let y = SHOULDER_Y; y <= SHOULDER_Y + 3; y++) hspan(g, y, 6, 13, M.CLOTH)
      skirt(g, SHOULDER_Y + 4, TORSO_BOT + 4, M.CLOTH, M.CLOTH_SH)
      // 허리 리본
      hspan(g, SHOULDER_Y + 4, 6, 13, M.CLOTH_HI)
    },
  },
  // 2 한복 (저고리 + 치마)
  {
    label: '한복',
    draw: (g, _d, _f) => {
      // 저고리 (밝은 상의 + 고름)
      for (let y = SHOULDER_Y; y <= SHOULDER_Y + 2; y++) hspan(g, y, 5, 14, M.LIGHT)
      hspan(g, SHOULDER_Y + 3, 6, 13, M.LIGHT)
      // 깃 + 고름(강조색)
      setPx(g, 9, SHOULDER_Y, M.CLOTH)
      setPx(g, 10, SHOULDER_Y, M.CLOTH)
      vspan(g, 10, SHOULDER_Y + 1, SHOULDER_Y + 3, M.CLOTH)
      // 치마 (색, 길고 풍성)
      skirt(g, SHOULDER_Y + 3, TORSO_BOT + 4, M.CLOTH, M.CLOTH_SH)
    },
  },
  // 3 셔츠 + 슬랙스
  {
    label: '셔츠+슬랙스',
    draw: (g, _d, f) => {
      torso(g, M.LIGHT)
      sleeves(g, f, M.LIGHT)
      pants(g, f, M.CLOTH)
      // 단추선 + 깃
      vspan(g, 9, SHOULDER_Y, TORSO_BOT, M.LIGHT_SH)
      setPx(g, 8, SHOULDER_Y, M.LIGHT_SH)
      setPx(g, 11, SHOULDER_Y, M.LIGHT_SH)
      hspan(g, LEG_TOP, 6, 13, M.CLOTH_SH) // 벨트선
    },
  },
  // 4 니트 스웨터
  {
    label: '니트',
    draw: (g, _d, f) => {
      torso(g, M.CLOTH)
      sleeves(g, f, M.CLOTH)
      pants(g, f, M.CLOTH2)
      // 니트 질감(가로 줄 음영)
      hspan(g, SHOULDER_Y + 1, 5, 14, M.CLOTH_SH)
      hspan(g, SHOULDER_Y + 3, 6, 13, M.CLOTH_SH)
      // 라운드넥
      hspan(g, SHOULDER_Y, 8, 11, M.CLOTH_HI)
    },
  },
  // 5 블라우스 + 스커트
  {
    label: '블라우스+스커트',
    draw: (g, _d, f) => {
      // 블라우스(밝게)
      for (let y = SHOULDER_Y; y <= SHOULDER_Y + 3; y++) hspan(g, y, 6, 13, M.LIGHT)
      sleeves(g, f, M.LIGHT)
      // 스커트(색)
      skirt(g, SHOULDER_Y + 4, TORSO_BOT + 3, M.CLOTH, M.CLOTH_SH)
      // 리본 넥
      setPx(g, 9, SHOULDER_Y, M.CLOTH)
      setPx(g, 10, SHOULDER_Y, M.CLOTH)
    },
  },
  // 6 후드티
  {
    label: '후드티',
    draw: (g, _d, f) => {
      torso(g, M.CLOTH)
      sleeves(g, f, M.CLOTH)
      pants(g, f, M.CLOTH2)
      // 후드 (목 뒤 칼라)
      hspan(g, SHOULDER_Y, 7, 12, M.CLOTH_SH)
      setPx(g, 7, SHOULDER_Y - 1, M.CLOTH)
      setPx(g, 12, SHOULDER_Y - 1, M.CLOTH)
      // 주머니 + 끈
      hspan(g, SHOULDER_Y + 4, 8, 11, M.CLOTH_SH)
      setPx(g, 9, SHOULDER_Y + 1, M.LIGHT)
      setPx(g, 10, SHOULDER_Y + 1, M.LIGHT)
    },
  },
  // 7 가디건 + 이너
  {
    label: '가디건',
    draw: (g, _d, f) => {
      torso(g, M.CLOTH)
      sleeves(g, f, M.CLOTH)
      pants(g, f, M.CLOTH2)
      // 앞트임(이너 보임)
      vspan(g, 9, SHOULDER_Y, TORSO_BOT, M.LIGHT)
      vspan(g, 10, SHOULDER_Y, TORSO_BOT, M.LIGHT)
      setPx(g, 8, SHOULDER_Y, M.CLOTH_HI)
      setPx(g, 11, SHOULDER_Y, M.CLOTH_HI)
    },
  },
]

/** 치마/드레스 계열이면 true (다리 피부 노출 → 바지 안 그림). */
const OUTFIT_IS_SKIRT = [false, true, true, false, false, true, false, false]

/* ── 머리 ───────────────────────────────────────────────── */
export interface HairDef {
  label: string
  back?: (g: Grid, dir: Dir) => void // 몸 뒤(길이) — 바디 전에
  front: (g: Grid, dir: Dir) => void // 머리 위/앞 — 얼굴 후
}

/** 두상 위 캡을 채운다. extra = 실루엣 밖으로 볼륨(px). downTo = 앞머리 내려오는 행. */
function cap(g: Grid, topY: number, downTo: number, extra: number, mat: Mat): void {
  for (let y = topY; y <= downTo; y++) {
    const hw = headHalf(y) + (y <= HEAD_CY ? extra : extra - 0.5)
    if (hw <= 0) continue
    hspan(g, y, Math.round(CX - hw), Math.round(CX + hw), mat)
  }
}

function hairTopHi(g: Grid): void {
  // 좌상단 윤기
  for (let y = 1; y <= 3; y++) {
    const hw = headHalf(y)
    setPx(g, Math.round(CX - hw) + 1, y, M.HAIR_HI)
  }
  setPx(g, Math.round(CX) - 2, 1, M.HAIR_HI)
}

const HAIRS: HairDef[] = [
  // 0 단발 (짧은 숏단발)
  {
    label: '단발',
    front: (g, dir) => {
      cap(g, 1, dir === 'up' ? 12 : BROW - 1, 1, M.HAIR)
      // 옆머리 살짝
      vspan(g, 3, BROW, BROW + 2, M.HAIR)
      vspan(g, 16, BROW, BROW + 2, M.HAIR)
      if (dir !== 'up') {
        // 앞머리 일자뱅
        hspan(g, BROW - 1, 5, 14, M.HAIR)
        hspan(g, BROW, 5, 7, M.HAIR)
        hspan(g, BROW, 12, 14, M.HAIR)
      }
      hairTopHi(g)
    },
  },
  // 1 보브 (턱선 길이 + 안쪽으로 말린 끝)
  {
    label: '보브',
    front: (g, dir) => {
      cap(g, 1, dir === 'up' ? 13 : BROW - 1, 1.5, M.HAIR)
      for (const side of [-1, 1] as const) {
        const outer = side < 0 ? 2 : 17
        const inner = side < 0 ? 3 : 16
        vspan(g, inner, BROW, 13, M.HAIR)
        vspan(g, outer, BROW, 11, M.HAIR)
        setPx(g, inner - side, 13, M.HAIR) // 안으로 말린 끝
        setPx(g, inner, 13, M.HAIR_SH)
      }
      if (dir !== 'up') {
        hspan(g, BROW - 1, 5, 14, M.HAIR)
        setPx(g, 9, BROW, M.HAIR)
      }
      hairTopHi(g)
    },
  },
  // 2 긴 생머리
  {
    label: '긴 생머리',
    back: (g, _d) => {
      // 등 뒤로 흘러내리는 긴 머리
      rect(g, 3, 13, 5, 23, M.HAIR)
      rect(g, 14, 13, 16, 23, M.HAIR)
      rect(g, 4, 13, 15, 16, M.HAIR)
      hspan(g, 24, 4, 5, M.HAIR)
      hspan(g, 24, 14, 15, M.HAIR)
      // 안쪽 음영
      vspan(g, 5, 14, 22, M.HAIR_SH)
      vspan(g, 14, 14, 22, M.HAIR_SH)
    },
    front: (g, dir) => {
      cap(g, 1, dir === 'up' ? 13 : BROW - 1, 1.5, M.HAIR)
      vspan(g, 3, BROW, 13, M.HAIR)
      vspan(g, 16, BROW, 13, M.HAIR)
      if (dir !== 'up') {
        hspan(g, BROW - 1, 5, 14, M.HAIR)
        setPx(g, 5, BROW, M.HAIR)
        setPx(g, 14, BROW, M.HAIR)
      }
      hairTopHi(g)
    },
  },
  // 3 포니테일
  {
    label: '포니테일',
    back: (g, dir) => {
      if (dir === 'up') {
        // 뒤에서 보면 묶은 꼬리가 중앙
        rect(g, 8, 12, 11, 22, M.HAIR)
        vspan(g, 11, 12, 21, M.HAIR_SH)
        return
      }
      // 옆으로 보이는 꼬리
      const bx = dir === 'left' ? 3 : 16
      vspan(g, bx, 9, 20, M.HAIR)
      vspan(g, bx + (dir === 'left' ? 1 : -1), 10, 19, M.HAIR)
      setPx(g, bx, 21, M.HAIR_SH)
    },
    front: (g, dir) => {
      cap(g, 1, dir === 'up' ? 11 : BROW - 1, 1, M.HAIR)
      if (dir !== 'up') {
        hspan(g, BROW - 1, 5, 14, M.HAIR)
        setPx(g, 5, BROW, M.HAIR)
        setPx(g, 14, BROW, M.HAIR)
      }
      // 묶은 매듭
      setPx(g, 4, 6, M.HAIR_SH)
      setPx(g, 15, 6, M.HAIR_SH)
      hairTopHi(g)
    },
  },
  // 4 올림머리(번)
  {
    label: '올림머리',
    front: (g, dir) => {
      cap(g, 2, dir === 'up' ? 12 : BROW - 1, 0.5, M.HAIR)
      // 정수리 번
      fillEllipse(g, CX, 1.5, 2.6, 2, M.HAIR)
      setPx(g, 8, 1, M.HAIR_HI)
      if (dir !== 'up') {
        hspan(g, BROW - 1, 5, 14, M.HAIR)
        // 깔끔히 넘긴 앞머리(가르마)
        setPx(g, 9, BROW - 1, M.SKIN)
      }
      hairTopHi(g)
    },
  },
  // 5 곱슬 (볼륨)
  {
    label: '곱슬',
    front: (g, dir) => {
      cap(g, 0, dir === 'up' ? 13 : BROW, 2, M.HAIR)
      // 둥근 곱슬 덩어리 (가장자리 점)
      for (const [x, y] of [
        [3, 3],
        [2, 6],
        [16, 3],
        [17, 6],
        [4, 1],
        [15, 1],
        [3, 9],
        [16, 9],
      ] as const)
        fillEllipse(g, x, y, 1.6, 1.6, M.HAIR)
      // 곱슬 하이라이트 점
      setPx(g, 6, 2, M.HAIR_HI)
      setPx(g, 12, 3, M.HAIR_HI)
      if (dir !== 'up') hspan(g, BROW, 5, 14, M.HAIR)
      hairTopHi(g)
    },
  },
  // 6 가르마 (미디엄)
  {
    label: '가르마',
    front: (g, dir) => {
      cap(g, 1, dir === 'up' ? 13 : BROW - 1, 1, M.HAIR)
      vspan(g, 3, BROW, 11, M.HAIR)
      vspan(g, 16, BROW, 11, M.HAIR)
      if (dir !== 'up') {
        // 가운데 가르마 (앞머리 양옆으로)
        hspan(g, BROW - 1, 4, 7, M.HAIR)
        hspan(g, BROW - 1, 12, 15, M.HAIR)
        setPx(g, 8, 2, M.SKIN)
        setPx(g, 9, 2, M.HAIR_SH)
        setPx(g, 5, BROW, M.HAIR)
        setPx(g, 14, BROW, M.HAIR)
      }
      hairTopHi(g)
    },
  },
  // 7 숏컷 (버즈/짧은 머리)
  {
    label: '숏컷',
    front: (g, dir) => {
      cap(g, 2, dir === 'up' ? 11 : BROW - 2, 0, M.HAIR)
      if (dir !== 'up') {
        // 짧은 앞머리
        hspan(g, BROW - 2, 5, 14, M.HAIR)
        setPx(g, 6, BROW - 1, M.HAIR)
        setPx(g, 9, BROW - 1, M.HAIR)
        setPx(g, 13, BROW - 1, M.HAIR)
      }
      hairTopHi(g)
    },
  },
]

/* ── 액세서리 (0 = 없음) ───────────────────────────────────── */
export interface AccDef {
  label: string
  draw: (g: Grid, dir: Dir) => void
}

const ACCS: AccDef[] = [
  { label: '없음', draw: () => {} },
  // 1 안경
  {
    label: '안경',
    draw: (g, dir) => {
      if (dir === 'up') return
      if (dir === 'left' || dir === 'right') {
        rect(g, 11, EYE_Y, 12, EYE_Y + 1, M.LENS)
        rect(g, 11, EYE_Y, 12, EYE_Y + 1, M.LENS)
        hspan(g, EYE_Y, 11, 12, M.ACC)
        hspan(g, EYE_Y + 2, 11, 12, M.ACC)
        vspan(g, 11, EYE_Y, EYE_Y + 2, M.ACC)
        vspan(g, 12, EYE_Y, EYE_Y + 2, M.ACC)
        setPx(g, 7, EYE_Y, M.ACC)
        return
      }
      for (const ex of [5, 11] as const) {
        rect(g, ex, EYE_Y, ex + 2, EYE_Y + 1, M.LENS)
        hspan(g, EYE_Y - 1, ex, ex + 2, M.ACC)
        hspan(g, EYE_Y + 2, ex, ex + 2, M.ACC)
        vspan(g, ex, EYE_Y, EYE_Y + 1, M.ACC)
        vspan(g, ex + 2, EYE_Y, EYE_Y + 1, M.ACC)
      }
      setPx(g, 8, EYE_Y, M.ACC) // 브릿지
      setPx(g, 9, EYE_Y, M.ACC)
      setPx(g, 10, EYE_Y, M.ACC)
    },
  },
  // 2 선글라스
  {
    label: '선글라스',
    draw: (g, dir) => {
      if (dir === 'up') return
      if (dir === 'left' || dir === 'right') {
        rect(g, 10, EYE_Y, 13, EYE_Y + 1, M.ACC2)
        setPx(g, 7, EYE_Y, M.ACC2)
        return
      }
      rect(g, 4, EYE_Y, 7, EYE_Y + 1, M.ACC2)
      rect(g, 12, EYE_Y, 15, EYE_Y + 1, M.ACC2)
      hspan(g, EYE_Y, 8, 11, M.ACC)
      setPx(g, 5, EYE_Y, M.LENS) // 반사
      setPx(g, 13, EYE_Y, M.LENS)
    },
  },
  // 3 리본
  {
    label: '리본',
    draw: (g, dir) => {
      const y = 1
      const x = dir === 'left' ? 5 : dir === 'right' ? 14 : 13
      rect(g, x, y, x + 1, y + 1, M.ACC)
      rect(g, x + 2, y, x + 3, y + 1, M.ACC)
      setPx(g, x + 1, y, M.GOLD) // 매듭
      setPx(g, x + 2, y + 1, M.ACC_SH)
      if (dir === 'down') {
        rect(g, 6, y, 7, y + 1, M.ACC)
        setPx(g, 7, y, M.GOLD)
      }
    },
  },
  // 4 꽃
  {
    label: '꽃',
    draw: (g, dir) => {
      const x = dir === 'left' ? 4 : dir === 'right' ? 15 : 14
      const y = 3
      fillEllipse(g, x, y, 1.6, 1.6, M.ACC)
      setPx(g, x, y, M.GOLD) // 꽃술
      setPx(g, x - 1, y - 1, M.ACC_SH)
      setPx(g, x + 1, y + 1, M.ACC_SH)
    },
  },
  // 5 베레모
  {
    label: '베레모',
    draw: (g, dir) => {
      cap(g, 0, 4, 1.5, M.ACC)
      hspan(g, 4, 4, 15, M.ACC_SH) // 모자 밴드
      setPx(g, 15, 1, M.GOLD) // 꼭지
      setPx(g, 5, 1, M.ACC2) // 하이라이트
      if (dir === 'up') cap(g, 0, 5, 1.5, M.ACC)
    },
  },
  // 6 보타이
  {
    label: '보타이',
    draw: (g, dir) => {
      if (dir === 'up') return
      const y = SHOULDER_Y
      rect(g, 7, y, 8, y + 1, M.ACC)
      rect(g, 11, y, 12, y + 1, M.ACC)
      setPx(g, 9, y, M.GOLD)
      setPx(g, 10, y, M.GOLD)
      setPx(g, 8, y + 1, M.ACC_SH)
    },
  },
  // 7 헤드폰
  {
    label: '헤드폰',
    draw: (g, dir) => {
      // 머리 위 밴드
      for (let y = 0; y <= 1; y++) {
        const hw = headHalf(y + 1) + 1
        hspan(g, y, Math.round(CX - hw), Math.round(CX + hw), M.ACC)
      }
      if (dir === 'up') return
      // 양쪽 이어컵
      rect(g, 2, 6, 3, 8, M.ACC)
      rect(g, 16, 6, 17, 8, M.ACC)
      setPx(g, 2, 6, M.ACC2)
      setPx(g, 16, 6, M.ACC2)
    },
  },
]

/* ── 외부 접근용 메타 (PART_DEFS / 카운트) ─────────────────────── */
export const OUTFIT_LABELS = OUTFITS.map((o) => o.label)
export const HAIR_LABELS = HAIRS.map((h) => h.label)
export const ACC_LABELS = ACCS.map((a) => a.label)

export const COUNTS = {
  skin: 6,
  hairStyle: HAIRS.length,
  hairColor: 9,
  outfit: OUTFITS.length,
  outfitColor: 9,
  accessory: ACCS.length,
}

/* ── 레이어 조립용 export ──────────────────────────────────── */
export function layerHairBack(g: Grid, dir: Dir, style: number): void {
  HAIRS[style]?.back?.(g, dir)
}
export function layerBody(g: Grid, dir: Dir, frame: Frame): void {
  drawHead(g, dir)
  drawBodyBase(g, dir, frame)
}
export function layerOutfit(g: Grid, dir: Dir, frame: Frame, outfit: number): void {
  OUTFITS[outfit]?.draw(g, dir, frame)
}
export function outfitIsSkirt(outfit: number): boolean {
  return OUTFIT_IS_SKIRT[outfit] ?? false
}
export function layerFace(g: Grid, dir: Dir): void {
  drawFace(g, dir)
}
export function layerHairFront(g: Grid, dir: Dir, style: number): void {
  HAIRS[style]?.front(g, dir)
}
export function layerAccessory(g: Grid, dir: Dir, acc: number): void {
  ACCS[acc]?.draw(g, dir)
}

/** 신랑/신부 고정 캐릭터용 보조 드로잉. */
export function drawGroom(g: Grid, dir: Dir, frame: Frame): void {
  // 턱시도: 검은 재킷 + 흰 셔츠 + 보타이 (의상 0 과 유사하나 고급)
  torso(g, M.CLOTH)
  sleeves(g, frame, M.CLOTH)
  pants(g, frame, M.CLOTH)
  // 셔츠 패널
  vspan(g, 9, SHOULDER_Y, SHOULDER_Y + 4, M.LIGHT)
  vspan(g, 10, SHOULDER_Y, SHOULDER_Y + 4, M.LIGHT)
  setPx(g, 8, SHOULDER_Y, M.CLOTH_HI)
  setPx(g, 11, SHOULDER_Y, M.CLOTH_HI)
  // 보타이 + 부토니에
  if (dir !== 'up') {
    setPx(g, 8, SHOULDER_Y, M.EYE)
    setPx(g, 9, SHOULDER_Y, M.GOLD) // 매듭
    setPx(g, 10, SHOULDER_Y, M.GOLD)
    setPx(g, 11, SHOULDER_Y, M.EYE)
    setPx(g, 12, SHOULDER_Y + 1, M.ACC) // 부토니에
    setPx(g, 12, SHOULDER_Y + 2, M.CLOTH_HI)
  }
}

export function drawBride(g: Grid, dir: Dir, frame: Frame): void {
  // 몸에 맞는 보디스 (어깨→허리로 좁아짐) + A라인 치마 → 상자 느낌 방지
  hspan(g, SHOULDER_Y, 6, 13, M.LIGHT)
  hspan(g, SHOULDER_Y + 1, 6, 13, M.LIGHT)
  hspan(g, SHOULDER_Y + 2, 7, 12, M.LIGHT)
  hspan(g, SHOULDER_Y + 3, 7, 12, M.LIGHT)
  // 스위트하트 넥라인
  setPx(g, 9, SHOULDER_Y, M.LIGHT_SH)
  setPx(g, 10, SHOULDER_Y, M.LIGHT_SH)
  // 퍼프 소매
  sleevesLight(g, frame)
  // 허리 새시 (금빛 포인트)
  hspan(g, SHOULDER_Y + 3, 7, 12, M.GOLD)
  // A라인 치마 (플리츠 음영으로 입체감)
  const top = SHOULDER_Y + 4
  const bot = TORSO_BOT + 5
  const span = bot - top
  for (let y = top; y <= bot; y++) {
    const t = (y - top) / span
    const half = 3 + Math.round(t * 3) // 3..6
    const x0 = Math.round(CX - half)
    const x1 = Math.round(CX + half)
    hspan(g, y, x0, x1, M.LIGHT)
    setPx(g, x1, y, M.LIGHT_SH)
    if (t > 0.25) {
      setPx(g, 7, y, M.LIGHT_SH)
      setPx(g, 11, y, M.LIGHT_SH)
    }
  }
  // 부케 (작은 꽃다발)
  if (dir !== 'up') {
    fillEllipse(g, 6, SHOULDER_Y + 5, 1.7, 1.7, M.ACC)
    setPx(g, 6, SHOULDER_Y + 5, M.GOLD)
    setPx(g, 5, SHOULDER_Y + 4, M.ACC_SH)
    setPx(g, 6, SHOULDER_Y + 7, M.LIGHT_SH) // 줄기
  }
}
function sleevesLight(g: Grid, frame: Frame): void {
  const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0
  vspan(g, 5, 16, 17 + sw, M.LIGHT)
  vspan(g, 14, 16, 17 - sw, M.LIGHT)
}

/** 베일 뒤쪽 (몸 뒤로 흐름) — 바디 전에 그림. */
export function drawVeilBack(g: Grid, dir: Dir): void {
  if (dir === 'up') {
    // 뒤통수→등으로 흐르는 베일 패널 (뒷모습)
    rect(g, 5, 13, 14, 25, M.LIGHT)
    vspan(g, 6, 14, 24, M.LIGHT_SH)
    vspan(g, 13, 14, 24, M.LIGHT_SH)
    hspan(g, 26, 6, 8, M.LIGHT)
    hspan(g, 26, 11, 13, M.LIGHT)
    return
  }
  // 정면/측면: 양옆으로 비치는 얇은 베일 가닥 (상자처럼 보이지 않게)
  for (const bx of [3, 16] as const) {
    vspan(g, bx, 13, 23, M.LIGHT)
    vspan(g, bx, 17, 22, M.LIGHT_SH)
  }
  hspan(g, 24, 3, 4, M.LIGHT)
  hspan(g, 24, 15, 16, M.LIGHT)
}

/** 베일 앞쪽 (화관 + 머리 위 얇은 베일) — 머리 후에 그림. */
export function drawVeilFront(g: Grid, dir: Dir): void {
  // 화관 (금빛 + 작은 꽃)
  hspan(g, 0, 6, 13, M.GOLD)
  if (dir !== 'up') {
    hspan(g, 1, 5, 6, M.GOLD)
    hspan(g, 1, 13, 14, M.GOLD)
    setPx(g, 7, 0, M.ACC)
    setPx(g, 10, 0, M.ACC)
    setPx(g, 12, 0, M.GOLD)
  }
}
