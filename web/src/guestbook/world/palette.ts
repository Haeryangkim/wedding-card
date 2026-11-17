/**
 * 장면 픽셀아트 팔레트 — 청첩장의 따뜻한 종이 톤과 어울리도록 손으로 고른 색.
 * (캔버스 도트 색은 토큰 규칙 예외: 여기서 직접 정의)
 * (world 내부 전용)
 */
export const PAL = {
  // 벽/하늘 (상단 배경 그라데이션)
  wallTop: '#f6eeddff',
  wallBot: '#ece0c9ff',
  // 바닥 널(마루)
  floorA: '#efe7d6ff',
  floorB: '#e8dcc5ff',
  floorLine: '#d8c8aaff',
  // 아일 카펫 (장밋빛 테라코타)
  carpet: '#cf8e7cff',
  carpetDk: '#b8715fff',
  carpetEdge: '#c2a15aff', // 금색 테두리
  carpetRunner: '#dda897ff',
  // 아치 잎사귀 (세이지)
  leaf: '#6f8a64ff',
  leafDk: '#546c4bff',
  leafHi: '#89a079ff',
  // 꽃
  roseA: '#d98b86ff',
  roseB: '#e7a9a0ff',
  cream: '#f4e6d2ff',
  gold: '#c2a15aff',
  goldHi: '#e7cf93ff',
  // 드레이프(천)
  drape: '#f3e7d2ff',
  drapeSh: '#e4d2b4ff',
  // 전구 줄
  wire: '#9a8a6aff',
  bulbOn: '#f7da8eff',
  bulbHi: '#fff1c6ff',
  // 가구
  wood: '#c6a06eff',
  woodDk: '#a9824fff',
  cloth: '#fbf4e6ff',
  clothSh: '#eee3cbff',
  // 그림자/잉크
  shadow: 'rgba(59,51,43,0.14)',
  ink: '#3b332bff',
  inkSoft: '#7a6f63ff',
  // 라벨
  labelBg: '#fffdf8f2',
  labelInk: '#4a4038ff',
  labelLine: '#d8c7a8ff',
  // 말풍선
  bubbleBg: '#fffdf8ff',
  bubbleLine: '#caa98aff',
  bubbleInk: '#463c33ff',
  // 포인트(하이라이트/하트)
  accent: '#b5654aff',
  heart: '#d07a74ff',
  heartHi: '#eaa49bff',
  sparkle: '#f1d98cff',
} as const
