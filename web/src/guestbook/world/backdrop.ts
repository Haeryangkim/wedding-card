/**
 * 정적 배경(벽·바닥·아일 카펫·꽃 아치·드레이프·전구)을 오프스크린 캔버스에 미리 그린다.
 * 매 프레임 drawImage 한 번으로 재사용. 레이아웃(크기) 변경 시에만 다시 그림.
 * (world 내부 전용)
 */
import type { WorldLayout } from './layout'
import { PAL } from './palette'

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  return c
}

/** 배경을 1:1 논리 해상도로 렌더(상단에서 ctx가 정수배 확대) */
export function renderBackdrop(layout: WorldLayout): HTMLCanvasElement {
  const { W, H, backdropH, aisleX, aisleHalf, coupleY } = layout
  const c = makeCanvas(W, H)
  const g = c.getContext('2d')
  if (!g) return c
  g.imageSmoothingEnabled = false
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    g.fillStyle = color
    g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
  }

  // ── 벽(상단 밴드) 세로 그라데이션 ─────────────────────────────
  for (let y = 0; y < backdropH; y++) {
    const t = y / backdropH
    px(0, y, W, 1, mix(PAL.wallTop, PAL.wallBot, t))
  }
  // 걸레받이 라인
  px(0, backdropH - 2, W, 2, PAL.floorLine)

  // ── 바닥(마루 널) ───────────────────────────────────────────
  for (let y = backdropH; y < H; y++) {
    const row = Math.floor((y - backdropH) / 6)
    px(0, y, W, 1, row % 2 === 0 ? PAL.floorA : PAL.floorB)
  }
  // 원근감용 세로 널 라인(옅게)
  for (let x = 16; x < W; x += 24) {
    for (let y = backdropH + 3; y < H; y += 2) px(x, y, 1, 1, PAL.floorLine)
  }

  // ── 아일 카펫 ───────────────────────────────────────────────
  const cLeft = aisleX - aisleHalf
  const cw = aisleHalf * 2
  px(cLeft, backdropH, cw, H - backdropH, PAL.carpet)
  px(cLeft, backdropH, 2, H - backdropH, PAL.carpetDk) // 좌측 음영
  px(aisleX + aisleHalf - 2, backdropH, 2, H - backdropH, PAL.carpetDk)
  px(cLeft - 1, backdropH, 1, H - backdropH, PAL.carpetEdge) // 금색 테두리
  px(aisleX + aisleHalf, backdropH, 1, H - backdropH, PAL.carpetEdge)
  // 가운데 러너 무늬(작은 마름모)
  for (let y = backdropH + 10; y < H; y += 18) {
    px(aisleX - 1, y - 2, 2, 1, PAL.carpetRunner)
    px(aisleX - 2, y - 1, 4, 1, PAL.carpetRunner)
    px(aisleX - 3, y, 6, 1, PAL.carpetRunner)
    px(aisleX - 2, y + 1, 4, 1, PAL.carpetRunner)
    px(aisleX - 1, y + 2, 2, 1, PAL.carpetRunner)
  }

  // ── 드레이프(양옆 천) ───────────────────────────────────────
  for (const side of [0, 1]) {
    const x0 = side === 0 ? 0 : W - 14
    px(x0, 0, 14, backdropH - 1, PAL.drape)
    for (let i = 0; i < 3; i++) {
      px(x0 + 3 + i * 4, 0, 1, backdropH - 1, PAL.drapeSh) // 주름
    }
    px(x0, 0, 14, 2, PAL.drapeSh)
  }

  // ── 꽃 아치 ∩ ───────────────────────────────────────────────
  const archCx = aisleX
  const rx = 58
  const baseY = backdropH - 2
  const ry = baseY - 5
  const steps = 54
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (i / steps) * Math.PI
    const x = archCx + Math.cos(a) * rx
    const y = baseY + Math.sin(a) * ry
    // 잎 덩어리
    leafBlob(px, x, y, i)
    // 군데군데 꽃
    if (i % 5 === 2) rose(px, x + (i % 3) - 1, y + 1, i)
    if (i % 7 === 0) rose(px, x - 1, y - 2, i + 3)
  }
  // 아치 상단 리본/포인트 꽃
  rose(px, archCx - 1, baseY - ry - 2, 11)

  // ── 전구 줄(아치 위로 늘어진 스웨그) ─────────────────────────
  const lights = 11
  for (let i = 0; i <= lights; i++) {
    const t = i / lights
    const x = 8 + t * (W - 16)
    // 완만한 현수선
    const sag = Math.sin(t * Math.PI) * 6
    const y = 6 + (1 - Math.sin(t * Math.PI)) * 4 + sag * 0.2 + 3
    px(x, 3, 1, Math.max(1, y - 3), PAL.wire)
    px(x - 1, y, 3, 3, PAL.bulbOn)
    px(x, y, 1, 1, PAL.bulbHi)
  }

  // ── 신랑·신부 발밑 작은 단(러그) ────────────────────────────
  const dw = 54
  g.fillStyle = PAL.carpetRunner
  ellipse(g, archCx, coupleY + 4, dw / 2, 7)
  g.fillStyle = PAL.carpetEdge
  ellipse(g, archCx, coupleY + 4, dw / 2, 7, true)

  return c
}

type Px = (x: number, y: number, w: number, h: number, color: string) => void

function leafBlob(px: Px, x: number, y: number, i: number): void {
  const hi = i % 3 === 0 ? PAL.leafHi : PAL.leaf
  px(x - 2, y - 1, 4, 3, PAL.leafDk)
  px(x - 2, y - 2, 3, 3, hi)
  px(x, y, 3, 2, PAL.leaf)
  px(x - 1, y - 1, 2, 2, hi)
}

function rose(px: Px, x: number, y: number, i: number): void {
  const petal = i % 2 === 0 ? PAL.roseA : PAL.roseB
  px(x - 1, y - 1, 3, 3, petal)
  px(x - 1, y - 2, 2, 1, PAL.cream)
  px(x, y, 1, 1, PAL.gold)
}

function ellipse(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  stroke = false,
): void {
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  if (stroke) {
    g.lineWidth = 1
    g.stroke()
  } else {
    g.fill()
  }
}

/** #rrggbbaa 두 색 선형보간 */
function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t)
  const gg = Math.round(pa[1] + (pb[1] - pa[1]) * t)
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t)
  return `rgb(${r},${gg},${bl})`
}

function parseHex(s: string): [number, number, number] {
  return [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ]
}
