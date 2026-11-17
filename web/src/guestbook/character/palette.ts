/**
 * 팔레트 + 색 램프.
 * 템플릿의 한 글자 = 재질 톤. 각 재질군은 4톤(하이라이트/기본/음영/딥) 램프를 가지며
 * 기본색 하나에서 유도한다. 음영은 보라·남색 쪽으로, 하이라이트는 노란 쪽으로 색조를 밀어
 * (hue shift) 평면적인 명도 변화가 아닌 도트 특유의 풍부한 색감을 만든다.
 * 외곽선은 검정이 아니라 인접 재질의 딥 톤(컬러 아웃라인).
 */

export type RGB = readonly [number, number, number]

/* ── 옵션 팔레트 (Appearance 인덱스와 1:1) ─────────────────────── */
export const SKINS: { label: string; hex: string }[] = [
  { label: '밝은 톤', hex: '#fde4d0' },
  { label: '복숭아', hex: '#f3c9a0' },
  { label: '웜 베이지', hex: '#e0aa7c' },
  { label: '허니', hex: '#c68c5e' },
  { label: '브라운', hex: '#9c6642' },
  { label: '딥 브라운', hex: '#70452e' },
]

export const HAIR_COLORS: { label: string; hex: string }[] = [
  { label: '자연 흑', hex: '#3a3340' },
  { label: '다크 브라운', hex: '#57392c' },
  { label: '브라운', hex: '#84532f' },
  { label: '밤색', hex: '#a8643a' },
  { label: '애쉬 그레이', hex: '#9a958f' },
  { label: '허니 블론드', hex: '#d9a94e' },
  { label: '금발', hex: '#efd27a' },
  { label: '로즈 핑크', hex: '#e58fa3' },
  { label: '와인', hex: '#8a3350' },
  { label: '은발', hex: '#dcd9d6' },
]

export const OUTFIT_COLORS: { label: string; hex: string }[] = [
  { label: '차콜', hex: '#4d4f5c' },
  { label: '네이비', hex: '#3c4c80' },
  { label: '세이지', hex: '#7c9a6c' },
  { label: '더스티 블루', hex: '#6f93b8' },
  { label: '플럼', hex: '#8a5a88' },
  { label: '머스터드', hex: '#d3a744' },
  { label: '테라코타', hex: '#c06a4c' },
  { label: '로즈', hex: '#dc8f9c' },
  { label: '버건디', hex: '#8c3346' },
  { label: '민트', hex: '#7cc0ae' },
  { label: '라벤더', hex: '#a99bd6' },
  { label: '아이보리', hex: '#eadbb6' },
]

/* ── 색 연산 ─────────────────────────────────────────────── */
export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

function rgbToHsl(c: RGB): [number, number, number] {
  const r = c[0] / 255
  const g = c[1] / 255
  const b = c[2] / 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  const d = mx - mn
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (mx === r) h = ((g - b) / d) % 6
  else if (mx === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = l - c / 2
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/** 색조 h 를 target 쪽으로 최단 호를 따라 최대 deg 만큼 이동 */
function hueToward(h: number, target: number, deg: number): number {
  let d = ((target - h + 540) % 360) - 180
  if (Math.abs(d) < deg) return target
  d = d > 0 ? deg : -deg
  return (h + d + 360) % 360
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

const COOL = 262 // 음영이 향하는 색조(남보라)
const WARM = 48 // 하이라이트가 향하는 색조(따뜻한 노랑)

/** [하이라이트, 기본, 음영, 딥(외곽선)] */
export type Ramp = readonly [RGB, RGB, RGB, RGB]

const PLUM: RGB = [58, 40, 66] // 외곽선이 수렴하는 어두운 자줏빛

export function ramp(base: RGB): Ramp {
  const [h, s, l] = rgbToHsl(base)
  // 무채색에 가까우면 음영에 살짝 보랏빛을 입혀 탁해지지 않게
  const sat = s < 0.08 ? 0.1 : s
  // 밝은 색(피부·흰 천)은 HSL 채도가 과하게 높으므로 음영에서 채도를 눌러 준다
  const calm = l > 0.7 ? 0.62 : l > 0.55 ? 0.82 : 1
  // 어두운 옷(네이비·차콜)은 명도 차가 작으니 색조를 더 크게 돌려 음영=보라, 하이라이트=따뜻한 회청
  const dk = l < 0.38 ? 1 : 0
  const hi = hslToRgb(
    hueToward(h, WARM, dk ? 16 : 10),
    clamp01(sat * (dk ? 0.78 : 0.92)),
    clamp01(l + (1 - l) * (dk ? 0.26 : 0.34) + 0.03),
  )
  const sh = hslToRgb(hueToward(h, COOL, dk ? 22 : 12), clamp01(sat * calm * (dk ? 1.12 : 1.04)), clamp01(l * 0.8 - 0.02))
  const dpRaw = hslToRgb(
    hueToward(h, COOL, dk ? 30 : 22),
    clamp01(sat * calm * 0.95),
    Math.max(0.13, clamp01(l * (l > 0.7 ? 0.42 : 0.52) - 0.02)),
  )
  return [hi, base, sh, mix(dpRaw, PLUM, l > 0.7 ? 0.42 : 0.3)]
}

/** 기본색을 어둡고(혹은 밝고) 살짝 차갑게 — 보조 의상색 유도용 */
export function shiftTone(base: RGB, lMul: number, sMul = 1, hueDeg = 0): RGB {
  const [h, s, l] = rgbToHsl(base)
  return hslToRgb(h + hueDeg, clamp01(s * sMul), clamp01(l * lMul))
}
export function withLightness(base: RGB, l: number, sMul = 1): RGB {
  const [h, s] = rgbToHsl(base)
  return hslToRgb(h, clamp01(s * sMul), clamp01(l))
}
export function lightnessOf(base: RGB): number {
  return rgbToHsl(base)[2]
}

/* ── 고정 색 ─────────────────────────────────────────────── */
export const FIXED = {
  white: hexToRgb('#f7f1e6'),
  cream: hexToRgb('#efe2c8'),
  charcoal: hexToRgb('#474857'),
  ink: hexToRgb('#34303f'),
  shoeBrown: hexToRgb('#6b4638'),
  shoeBlack: hexToRgb('#3b3642'),
  eye: hexToRgb('#3a2b3a'),
  eyeWhite: hexToRgb('#fffaf2'),
  gold: hexToRgb('#e2b54e'),
  flower: hexToRgb('#ec8fa6'),
  leaf: hexToRgb('#6f9e5c'),
  lens: hexToRgb('#cfe6ee'),
  red: hexToRgb('#c8475c'),
} as const
