/** 무광 파스텔 팔레트 (이 스타일 전용, 직접 고른 색). */
export interface Swatch {
  label: string
  hex: string
}

export const SKINS: Swatch[] = [
  { label: '밝은 톤', hex: '#fde3cf' },
  { label: '살구 톤', hex: '#f8d2b3' },
  { label: '웜 베이지', hex: '#efbf98' },
  { label: '허니', hex: '#dea77c' },
  { label: '브론즈', hex: '#b9805c' },
  { label: '딥 브라운', hex: '#8a5a42' },
]

export const HAIR_COLORS: Swatch[] = [
  { label: '흑갈색', hex: '#3d3134' },
  { label: '다크 브라운', hex: '#5b4034' },
  { label: '밤색', hex: '#84563a' },
  { label: '카라멜', hex: '#b9814f' },
  { label: '허니 블론드', hex: '#e2bd76' },
  { label: '애쉬 그레이', hex: '#9b9aa3' },
  { label: '은발', hex: '#dcd8d2' },
  { label: '로즈 핑크', hex: '#e79aa6' },
  { label: '와인', hex: '#8c4250' },
  { label: '민트 블루', hex: '#7fb8b4' },
]

export const OUTFIT_COLORS: Swatch[] = [
  { label: '네이비', hex: '#4b5a85' },
  { label: '차콜', hex: '#5a5560' },
  { label: '베이지', hex: '#d9bf9a' },
  { label: '와인', hex: '#a8505c' },
  { label: '포레스트', hex: '#5f8a66' },
  { label: '스카이', hex: '#8fbbdc' },
  { label: '핑크', hex: '#f0a6b4' },
  { label: '라벤더', hex: '#b3a0d6' },
  { label: '머스타드', hex: '#e3b85a' },
  { label: '코랄', hex: '#ee8f77' },
  { label: '민트', hex: '#9fd3c0' },
  { label: '크림', hex: '#f6ead6' },
]

export const INK = '#4a3436' // 눈·선 (검정 대신 따뜻한 고동색)
export const BLUSH = '#f08f8f'
export const CREAM = '#fbf4e8'
