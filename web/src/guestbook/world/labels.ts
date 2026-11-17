/**
 * 이름표 캔버스 캐시 — 이름마다 픽셀폰트(Galmuri11) 알약(pill)을 한 번만 그려 재사용.
 * 150명 라벨을 매 프레임 텍스트로 그리지 않기 위함. (world 내부 전용)
 */
import { PAL } from './palette'

/** 라벨 내부 렌더 스케일(폰트 선명도용). 렌더 시 1/LBL 로 축소 배치 */
export const LBL_SCALE = 2
const FONT_PX = 8
const MAX_TEXT_W = 56 // 논리 px 기준 최대 폭(이보다 길면 말줄임)

interface LabelStyle {
  bg: string
  ink: string
  line: string
}

const cache = new Map<string, HTMLCanvasElement>()
let measureCtx: CanvasRenderingContext2D | null = null

function font(): string {
  return `${FONT_PX * LBL_SCALE}px 'Galmuri11', monospace`
}

function getMeasure(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    measureCtx = c.getContext('2d')
  }
  if (!measureCtx) throw new Error('no 2d context')
  measureCtx.font = font()
  return measureCtx
}

function truncate(ctx: CanvasRenderingContext2D, name: string): string {
  const maxW = MAX_TEXT_W * LBL_SCALE
  if (ctx.measureText(name).width <= maxW) return name
  let s = name
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1)
  return s + '…'
}

/** 캐시 비우기(폰트 로드 완료 후 호출하여 폴백 폰트로 구운 라벨 갱신) */
export function clearLabelCache(): void {
  cache.clear()
}

/**
 * 이름표 캔버스. 그려진 폭/높이는 LBL_SCALE 배이므로 렌더에서 /LBL_SCALE 로 배치.
 * variant: 'normal' | 'couple' | 'focus'
 */
export function getLabel(name: string, variant: 'normal' | 'couple' | 'focus'): HTMLCanvasElement {
  const key = `${variant}|${name}`
  const hit = cache.get(key)
  if (hit) return hit

  const style: LabelStyle =
    variant === 'focus'
      ? { bg: PAL.labelBg, ink: '#ffffff', line: PAL.accent }
      : variant === 'couple'
        ? { bg: '#fff8ec', ink: PAL.accent, line: PAL.gold }
        : { bg: 'rgba(255,253,248,0.80)', ink: PAL.labelInk, line: 'rgba(160,140,110,0.55)' }

  const m = getMeasure()
  const text = truncate(m, name)
  const padX = 3 * LBL_SCALE
  const padY = 2 * LBL_SCALE
  const tw = Math.ceil(m.measureText(text).width)
  const w = tw + padX * 2
  const h = FONT_PX * LBL_SCALE + padY * 2

  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) return c
  g.imageSmoothingEnabled = false

  // 알약 배경
  if (variant === 'focus') {
    g.fillStyle = PAL.accent
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ffffff'
  } else {
    g.fillStyle = style.line
    g.fillRect(0, 0, w, h)
    g.fillStyle = style.bg
    g.fillRect(LBL_SCALE, LBL_SCALE, w - LBL_SCALE * 2, h - LBL_SCALE * 2)
    g.fillStyle = style.ink
  }
  // 모서리 1픽셀(LBL_SCALE) 깎아 알약 느낌
  g.clearRect(0, 0, LBL_SCALE, LBL_SCALE)
  g.clearRect(w - LBL_SCALE, 0, LBL_SCALE, LBL_SCALE)
  g.clearRect(0, h - LBL_SCALE, LBL_SCALE, LBL_SCALE)
  g.clearRect(w - LBL_SCALE, h - LBL_SCALE, LBL_SCALE, LBL_SCALE)

  g.font = font()
  g.textBaseline = 'middle'
  g.textAlign = 'center'
  g.fillStyle = style.ink
  g.fillText(text, w / 2, h / 2 + LBL_SCALE * 0.5)

  cache.set(key, c)
  return c
}
