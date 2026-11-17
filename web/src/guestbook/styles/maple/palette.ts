/**
 * 팔레트와 색 램프 (이 스타일 전용, 직접 고른 색).
 * 셀 셰이딩: 재질마다 [하이라이트, 기본, 음영 1톤, 외곽선]. 외곽선은 재질 색이 살짝 도는 아주 어두운 색.
 */
export type RGB = readonly [number, number, number]

export function hex(h: string): RGB {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

export const SKINS: { label: string; hex: string }[] = [
  { label: '밝은 톤', hex: '#ffe9d8' },
  { label: '복숭아', hex: '#fbd5b5' },
  { label: '웜 베이지', hex: '#eebb90' },
  { label: '허니', hex: '#d49a6a' },
  { label: '브라운', hex: '#a9704a' },
  { label: '딥 브라운', hex: '#7a4c34' },
]

export const HAIR_COLORS: { label: string; hex: string }[] = [
  { label: '흑발', hex: '#40394a' },
  { label: '다크 브라운', hex: '#62412f' },
  { label: '브라운', hex: '#96602f' },
  { label: '오렌지 브라운', hex: '#c47a3a' },
  { label: '금발', hex: '#f0cc62' },
  { label: '애쉬', hex: '#a8a4a8' },
  { label: '은발', hex: '#e6e4ea' },
  { label: '체리 레드', hex: '#c8474e' },
  { label: '로즈 핑크', hex: '#f098b0' },
  { label: '스카이', hex: '#6fb0e0' },
  { label: '민트', hex: '#7fd0b0' },
  { label: '라벤더', hex: '#a98ad8' },
]

export const OUTFIT_COLORS: { label: string; hex: string }[] = [
  { label: '차콜', hex: '#565868' },
  { label: '네이비', hex: '#3e5290' },
  { label: '하늘', hex: '#6ea4dc' },
  { label: '민트', hex: '#74c8b0' },
  { label: '풀색', hex: '#7cb05c' },
  { label: '레몬', hex: '#f0cc50' },
  { label: '오렌지', hex: '#f09448' },
  { label: '레드', hex: '#d84c50' },
  { label: '핑크', hex: '#f490ac' },
  { label: '와인', hex: '#983a54' },
  { label: '보라', hex: '#9470cc' },
  { label: '아이보리', hex: '#f2e6c8' },
]

export const FIX = {
  white: hex('#fbf7f0'),
  ivory: hex('#f4ead6'),
  ink: hex('#2c2634'),
  black: hex('#3a3644'),
  brown: hex('#7a5038'),
  denim: hex('#5878b8'),
  beige: hex('#d8c098'),
  gold: hex('#f2c444'),
  red: hex('#e0505c'),
  pink: hex('#f8a0b8'),
  leaf: hex('#6cb060'),
  straw: hex('#ecd08c'),
  veil: hex('#eef4fb'),
  lens: hex('#d4f0f8'),
} as const

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function toHsl(c: RGB): [number, number, number] {
  const r = c[0] / 255
  const g = c[1] / 255
  const b = c[2] / 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  const d = mx - mn
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return [h, s, l]
}

function fromHsl(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r, g, b] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]
  const m = l - c / 2
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/** 명도·채도를 곱해 파생색을 만든다 */
export function tone(c: RGB, lMul: number, sMul = 1): RGB {
  const [h, s, l] = toHsl(c)
  return fromHsl(h, clamp01(s * sMul), clamp01(l * lMul))
}
/** 명도를 직접 지정 */
export function withL(c: RGB, l: number, sMul = 1): RGB {
  const [h, s] = toHsl(c)
  return fromHsl(h, clamp01(s * sMul), clamp01(l))
}
export function lum(c: RGB): number {
  return toHsl(c)[2]
}

/** [하이라이트, 기본, 음영, 외곽선] */
export function ramp(base: RGB): readonly [RGB, RGB, RGB, RGB] {
  const [h, s, l] = toHsl(base)
  const light = l > 0.72
  // 음영은 색조를 살짝 차갑게(보라 쪽), 하이라이트는 밝고 따뜻하게
  const cool = (deg: number) => {
    const d = ((265 - h + 540) % 360) - 180
    return h + Math.max(-deg, Math.min(deg, d))
  }
  const hi = fromHsl(h, clamp01(s * 0.9), clamp01(l + (1 - l) * 0.42))
  const sh = fromHsl(cool(light ? 6 : 10), clamp01(s * (light ? 0.75 : 1.02)), clamp01(l * (light ? 0.86 : 0.78)))
  const deep = fromHsl(cool(16), clamp01(Math.max(s, 0.12) * 0.7), clamp01(l * 0.34))
  const ln = mix(deep, [38, 30, 46], light ? 0.45 : 0.55)
  return [hi, base, sh, ln]
}
