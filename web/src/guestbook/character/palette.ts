/**
 * 재질(material) id, 기본 색 팔레트, 색 연산.
 * 파츠 그리기 함수는 "재질 id" 를 찍고, 마지막에 외형에 맞는 색으로 해석(resolve)한다.
 * 음영/하이라이트는 기본색에서 자동 유도 → 색 하나만 고르면 조화로운 명암이 따라온다.
 */

/** 재질 id. 0 = 투명. (enum 금지 → const 객체) */
export const M = {
  NONE: 0,
  OUTLINE: 1,
  SKIN: 2,
  SKIN_SH: 3,
  SKIN_HI: 4,
  HAIR: 5,
  HAIR_SH: 6,
  HAIR_HI: 7,
  CLOTH: 8, // 주 의상색
  CLOTH_SH: 9,
  CLOTH_HI: 10,
  CLOTH2: 11, // 보조 의상(바지·치마·트림)
  CLOTH2_SH: 12,
  LIGHT: 13, // 셔츠·드레스·베일 등 밝은 천
  LIGHT_SH: 14,
  EYE: 15,
  MOUTH: 16,
  BLUSH: 17,
  SHOE: 18,
  SHOE_SH: 19,
  ACC: 20, // 액세서리 주색
  ACC_SH: 21,
  ACC2: 22, // 액세서리 보조색
  LENS: 23, // 안경 렌즈
  GOLD: 24, // 금속·장식
} as const
export type Mat = (typeof M)[keyof typeof M]

export type RGB = readonly [number, number, number]
export type RGBA = readonly [number, number, number, number]

/* ── 기본 팔레트 (Appearance 인덱스와 1:1) ───────────────────────── */

/** 피부 (>=5) */
export const SKINS: { label: string; hex: string }[] = [
  { label: '밝은 톤', hex: '#ffe0c2' },
  { label: '복숭아', hex: '#f6c69c' },
  { label: '웜 베이지', hex: '#e7ac82' },
  { label: '올리브', hex: '#cf8f63' },
  { label: '브라운', hex: '#a9683f' },
  { label: '딥 브라운', hex: '#7c4a2c' },
]

/** 머리 색 (>=8) */
export const HAIR_COLORS: { label: string; hex: string }[] = [
  { label: '자연 흑', hex: '#2b2630' },
  { label: '다크 브라운', hex: '#45342a' },
  { label: '브라운', hex: '#6d4a30' },
  { label: '밤색', hex: '#8a4f2e' },
  { label: '애쉬', hex: '#8f8a86' },
  { label: '다크 골드', hex: '#b08a4a' },
  { label: '금발', hex: '#e0bb6f' },
  { label: '복숭아 핑크', hex: '#d98fa2' },
  { label: '와인', hex: '#6f2f44' },
]

/** 의상 색 (>=8) */
export const OUTFIT_COLORS: { label: string; hex: string }[] = [
  { label: '차콜', hex: '#43454f' },
  { label: '네이비', hex: '#3a456e' },
  { label: '세이지', hex: '#6f8a64' },
  { label: '더스티 블루', hex: '#5d7c99' },
  { label: '플럼', hex: '#7c5473' },
  { label: '머스터드', hex: '#c6a24e' },
  { label: '테라코타', hex: '#b5654a' },
  { label: '크림', hex: '#ece0c8' },
  { label: '로즈', hex: '#c88890' },
]

/* ── 고정 색 ─────────────────────────────────────────────── */
export const OUTLINE_HEX = '#2a2330'
export const EYE_HEX = '#352c33'
export const MOUTH_HEX = '#a05a52'
export const BLUSH_HEX = '#f0a8a0'
export const SHOE_HEX = '#4b3a32'
export const LIGHT_HEX = '#f6efe2' // 흰 셔츠/드레스/베일
export const GOLD_HEX = '#d7b45e'

/* ── 색 연산 ─────────────────────────────────────────────── */
export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

const clamp255 = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : Math.round(n))

/** f<1 어둡게 (약간 채도/색조 유지). */
export function darken(c: RGB, f: number): RGB {
  return [clamp255(c[0] * f), clamp255(c[1] * f), clamp255(c[2] * f)]
}
/** t(0~1) 만큼 흰색으로. */
export function lighten(c: RGB, t: number): RGB {
  return [
    clamp255(c[0] + (255 - c[0]) * t),
    clamp255(c[1] + (255 - c[1]) * t),
    clamp255(c[2] + (255 - c[2]) * t),
  ]
}
export function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    clamp255(a[0] + (b[0] - a[0]) * t),
    clamp255(a[1] + (b[1] - a[1]) * t),
    clamp255(a[2] + (b[2] - a[2]) * t),
  ]
}
