/**
 * 동숲(테스트) 그림체의 주민·소품 목록과 아틀라스 치수 — art/acref/build.py 가 만든다 (직접 고치지 않는다).
 * 그림(assets/*.webp)은 저장소에 올리지 않으므로, 이름·치수만 여기에 둔다.
 */
export interface Resident {
  id: string
  /** 화면에 보이는 이름 */
  label: string
  /** 키 (발바닥에서 머리·귀 꼭대기까지) */
  h: number
  /** 소품을 쥐는 손: 가로 중심에서 오른쪽으로 hx(왼손이면 음수), 발바닥에서 위로 hy. side -1 이면 왼손(소품을 뒤집어 든다) */
  hx: number
  hy: number
  side: 1 | -1
  /** 기울여 드는 소품(풍선)을 손잡이를 축으로 몸 바깥쪽으로 눕히는 각도 (라디안) — 머리에 닿지 않는 가장 작은 값 */
  lean: number
}
export interface Item {
  id: string
  label: string
  /** items.webp 안의 자리 */
  x: number
  y: number
  w: number
  h: number
  /** 손잡이(손에 닿는 점) — 그림 왼쪽 위 기준 */
  gx: number
  gy: number
  /** true 면 기울여 드는 소품(풍선) — 각도는 주민의 lean */
  tilt: boolean
}

/** assets/atlas.json 의 stamp 와 같아야 한다 (그림과 목록이 어긋나면 불러오기를 거절) */
export const ATLAS_STAMP = 'e20f321a05'
/** 스프라이트 명목 크기와 발바닥 선 (가로 기준은 중앙) */
export const SPRITE_W = 430
export const SPRITE_H = 383
export const FOOT_Y = 367
/** atlas.webp 의 한 칸 (주민은 칸의 가로 중앙, 발은 CELL_FOOT 에 놓인다) */
export const CELL_W = 278
export const CELL_H = 345
export const CELL_FOOT = 343
export const ATLAS_COLS = 9
/** 가장 큰 주민의 키 */
export const TALLEST = 341
export const GROOM_INDEX = 0
export const BRIDE_INDEX = 1
/** 신부가 드는 소품 (액세서리 번호: 0 = 없음) */
export const BRIDE_ACCESSORY = 5

export const RESIDENTS: readonly Resident[] = [
  { id: 'cyrus', label: '리포', h: 341, hx: 63.3, hy: 125.0, side: 1, lean: 0.279 },
  { id: 'reese', label: '리사', h: 336, hx: 76.3, hy: 71.5, side: 1, lean: 0.209 },
  { id: 'raymond', label: '잭슨', h: 341, hx: 58.3, hy: 77.7, side: 1, lean: 0.384 },
  { id: 'bob', label: '히죽', h: 341, hx: 57.2, hy: 70.2, side: 1, lean: 0.524 },
  { id: 'lolly', label: '사이다', h: 341, hx: 59.8, hy: 70.2, side: 1, lean: 0.524 },
  { id: 'punchy', label: '빙티', h: 341, hx: 59.8, hy: 70.2, side: 1, lean: 0.524 },
  { id: 'ankha', label: '클레오', h: 341, hx: 50.7, hy: 66.3, side: 1, lean: 0.524 },
  { id: 'coco', label: '이요', h: 341, hx: 52.0, hy: 75.4, side: 1, lean: 0.454 },
  { id: 'ruby', label: '루나', h: 341, hx: 52.0, hy: 75.4, side: 1, lean: 0.454 },
  { id: 'dotty', label: '서머', h: 341, hx: 53.3, hy: 75.4, side: 1, lean: 0.454 },
  { id: 'chrissy', label: '크리스틴', h: 341, hx: 54.6, hy: 78.0, side: 1, lean: 0.419 },
  { id: 'judy', label: '미애', h: 312, hx: 62.2, hy: 79.0, side: 1, lean: 0.384 },
  { id: 'stitches', label: '패치', h: 313, hx: 56.3, hy: 77.0, side: 1, lean: 0.454 },
  { id: 'maple', label: '메이첼', h: 312, hx: 58.3, hy: 79.0, side: 1, lean: 0.419 },
  { id: 'pekoe', label: '재스민', h: 312, hx: 56.3, hy: 76.0, side: 1, lean: 0.454 },
  { id: 'goldie', label: '카라멜', h: 327, hx: 64.2, hy: 91.0, side: 1, lean: 0.489 },
  { id: 'daisy', label: '바닐라', h: 330, hx: 64.7, hy: 92.0, side: 1, lean: 0.489 },
  { id: 'isabelle', label: '여울', h: 341, hx: 72.9, hy: 104.0, side: 1, lean: 0.419 },
  { id: 'fauna', label: '솔미', h: 325, hx: 66.7, hy: 87.0, side: 1, lean: 0.384 },
  { id: 'beau', label: '피터', h: 341, hx: 59.7, hy: 79.5, side: 1, lean: 0.419 },
  { id: 'diana', label: '나탈리', h: 325, hx: 66.7, hy: 87.0, side: 1, lean: 0.384 },
  { id: 'marshal', label: '쭈니', h: 278, hx: -54.6, hy: 50.7, side: -1, lean: 0.524 },
  { id: 'poppy', label: '다람', h: 278, hx: -50.7, hy: 58.5, side: -1, lean: 0.524 },
  { id: 'roald', label: '펭수', h: 278, hx: 93.8, hy: 98.0, side: 1, lean: 0.14 },
  { id: 'sprinkle', label: '크리미', h: 278, hx: 93.8, hy: 98.0, side: 1, lean: 0.14 },
  { id: 'dom', label: '차둘', h: 278, hx: 97.5, hy: 105.5, side: 1, lean: 0.244 },
  { id: 'willow', label: '마리', h: 278, hx: 92.9, hy: 100.5, side: 1, lean: 0.349 },
  { id: 'sherb', label: '래미', h: 341, hx: 75.4, hy: 94.5, side: 1, lean: 0.454 },
  { id: 'molly', label: '귀오미', h: 306, hx: 59.8, hy: 61.0, side: 1, lean: 0.489 },
  { id: 'zucker', label: '탁호', h: 323, hx: 77.2, hy: 57.0, side: 1, lean: 0.314 },
  { id: 'flurry', label: '뽀야미', h: 281, hx: 84.8, hy: 55.0, side: 1, lean: 0.14 },
  { id: 'merengue', label: '스트로베리', h: 308, hx: 80.5, hy: 87.5, side: 1, lean: 0.175 },
  { id: 'audie', label: '모니카', h: 341, hx: 68.0, hy: 92.5, side: 1, lean: 0.384 },
  { id: 'player1', label: '갈색 머리', h: 339, hx: -58.5, hy: 120.9, side: -1, lean: 0.314 },
  { id: 'player5', label: '화관 소녀', h: 341, hx: 71.7, hy: 105.5, side: 1, lean: 0.279 },
  { id: 'player6', label: '파란 머리', h: 335, hx: 83.6, hy: 126.5, side: 1, lean: 0.14 },
]

export const ITEMS: readonly Item[] = [
  { id: 'balloon-red', label: '빨간 풍선', x: 2, y: 2, w: 59, h: 192, gx: 29.5, gy: 183.4, tilt: true },
  { id: 'balloon-blue', label: '파란 풍선', x: 104, y: 2, w: 59, h: 192, gx: 29.5, gy: 183.4, tilt: true },
  { id: 'balloon-yellow', label: '노란 풍선', x: 206, y: 2, w: 59, h: 192, gx: 29.5, gy: 183.4, tilt: true },
  { id: 'balloon-pink', label: '분홍 풍선', x: 308, y: 2, w: 59, h: 192, gx: 29.5, gy: 183.4, tilt: true },
  { id: 'bouquet', label: '부케', x: 410, y: 2, w: 61, h: 113, gx: 11.0, gy: 101.7, tilt: false },
  { id: 'tulip', label: '튤립', x: 512, y: 2, w: 49, h: 110, gx: 15.2, gy: 99.0, tilt: false },
  { id: 'star', label: '별 지팡이', x: 2, y: 198, w: 47, h: 113, gx: 5.2, gy: 101.7, tilt: false },
  { id: 'pinwheel', label: '바람개비', x: 104, y: 198, w: 65, h: 104, gx: 6.1, gy: 93.6, tilt: false },
  { id: 'lollipop', label: '막대사탕', x: 206, y: 198, w: 98, h: 96, gx: 9.8, gy: 86.4, tilt: false },
  { id: 'popper', label: '파티 폭죽', x: 308, y: 198, w: 73, h: 95, gx: 21.9, gy: 72.2, tilt: false },
  { id: 'lightstick', label: '응원봉', x: 410, y: 198, w: 57, h: 99, gx: 8.5, gy: 89.1, tilt: false },
  { id: 'fan', label: '부채', x: 512, y: 198, w: 81, h: 103, gx: 16.2, gy: 90.6, tilt: false },
]
