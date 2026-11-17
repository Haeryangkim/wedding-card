/**
 * 픽셀 청첩장 HUD 아이콘 — 도트 격자를 문자열로 적어 SVG 사각형으로 그린다 (외부 에셋 없음).
 * 한 글자 = 한 칸. '.' 은 투명, 나머지는 아래 팔레트의 색.
 */
import type { ReactElement } from 'react'

const COLORS: Record<string, string> = {
  k: '#3b332b', // 잉크(외곽선)
  w: '#fffdf8', // 종이
  a: '#b5654a', // 테라코타
  r: '#d98b86', // 장미
  s: '#e9cfc2', // 옅은 테라코타
  g: '#c2a15a', // 금색
  y: '#f7da8e', // 해
  l: '#6f8a64', // 잎
  b: '#a9c4d1', // 하늘
  c: 'currentColor',
}

const ICONS = {
  /** 예식 일시: 하트가 그려진 달력 */
  calendar: [
    '................',
    '...kk......kk...',
    '..kkkkkkkkkkkk..',
    '.kaakaaaaaakaak.',
    '.kaaaaaaaaaaaak.',
    '.kkkkkkkkkkkkkk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwrrwwrrwwwk.',
    '.kwwrrrrrrrrwwk.',
    '.kwwrrrrrrrrwwk.',
    '.kwwwrrrrrrwwwk.',
    '.kwwwwrrrrwwwwk.',
    '.kwwwwwrrwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  /** 오시는 길: 지도 핀 */
  pin: [
    '................',
    '.....kkkkkk.....',
    '....kaaaaaak....',
    '...kaaaaaaaak...',
    '..kaaakkkkaaak..',
    '..kaakwwwwkaak..',
    '..kaakwwwwkaak..',
    '..kaaakkkkaaak..',
    '...kaaaaaaaak...',
    '...kaaaaaaaak...',
    '....kaaaaaak....',
    '.....kaaaak.....',
    '......kaak......',
    '.......kk.......',
    '....ssssssss....',
    '.....ssssss.....',
  ],
  /** 마음 전하실 곳: 하트 봉투 */
  envelope: [
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kkwwwwwwwwwwkk.',
    '.kwkkwwwwwwkkwk.',
    '.kwwwkkwwkkwwwk.',
    '.kwwwwwkkwwwwwk.',
    '.kwwwrrwwrrwwwk.',
    '.kwwwrrrrrrwwwk.',
    '.kwwwwrrrrwwwwk.',
    '.kwwwwwrrwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kkkkkkkkkkkkkk.',
    '..ssssssssssss..',
    '................',
    '................',
  ],
  /** 갤러리: 사진 한 장 */
  photo: [
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kwwwwwwwwwwwwk.',
    '.kwbbbbbbbbyywk.',
    '.kwbbbbbbbbyywk.',
    '.kwbbbbbbbbbbwk.',
    '.kwbbbblbbbbbwk.',
    '.kwbbblllbbbbwk.',
    '.kwbblllllblbwk.',
    '.kwblllllllllwk.',
    '.kwllllllllllwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kkkkkkkkkkkkkk.',
    '..ssssssssssss..',
    '................',
  ],
  /** 방명록: 하트 말풍선 */
  bubble: [
    '................',
    '..kkkkkkkkkkkk..',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwaawwaawwwk.',
    '.kwwaaaaaaaawwk.',
    '.kwwaaaaaaaawwk.',
    '.kwwwaaaaaawwwk.',
    '.kwwwwaaaawwwwk.',
    '.kwwwwwaawwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '..kkkwwwkkkkkk..',
    '....kwwk........',
    '....kwk.........',
    '....kk..........',
    '................',
  ],
  /** 공유 */
  share: [
    '............',
    '.......ccc..',
    '.......ccc..',
    '.....ccccc..',
    '...cc.......',
    '.ccc........',
    '.ccc........',
    '...cc.......',
    '.....ccccc..',
    '.......ccc..',
    '.......ccc..',
    '............',
  ],
  /** 일반 청첩장: 글줄이 있는 종이 */
  letter: [
    '............',
    '..cccccccc..',
    '..c......c..',
    '..c.cc...c..',
    '..c......c..',
    '..c.cccc.c..',
    '..c......c..',
    '..c.cccc.c..',
    '..c......c..',
    '..c.ccc..c..',
    '..cccccccc..',
    '............',
  ],
} as const

export type HudIconName = keyof typeof ICONS

/** 격자 한 줄에서 같은 색이 이어지는 구간을 사각형 하나로 묶는다 */
function rects(rows: readonly string[]): ReactElement[] {
  const out: ReactElement[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      let end = x + 1
      while (end < row.length && row[end] === ch) end++
      const fill = COLORS[ch]
      if (fill) out.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={fill} />)
      x = end
    }
  })
  return out
}

export function HudIcon({ name, size = 32 }: { name: HudIconName; size?: number }) {
  const rows = ICONS[name]
  const n = rows.length
  return (
    <svg
      className="px-icon"
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {rects(rows)}
    </svg>
  )
}
