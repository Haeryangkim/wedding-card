/**
 * 프레임 렌더러 — 시뮬레이션 상태를 캔버스에 그린다(시뮬과 분리).
 * ctx 는 이미 "논리좌표→디바이스" 로 스케일되어 있고 imageSmoothing=off 상태로 들어온다.
 * (world 내부 전용)
 */
import type { GuestEntry } from '../types'
import { getSprite, SPRITE_H, SPRITE_W, type Dir, type Frame } from '../character'
import type { ActiveBubble } from './bubbles'
import { COUPLE_LABEL_DY, SPAWN_FALL_FROM } from './constants'
import type { Particle } from './effects'
import type { Decor, WorldLayout } from './layout'
import { getLabel, LBL_SCALE } from './labels'
import { PAL } from './palette'
import type { Agent } from './sim'

export interface RenderParams {
  ctx: CanvasRenderingContext2D
  layout: WorldLayout
  backdrop: HTMLCanvasElement
  agents: Agent[]
  entryById: Map<string, GuestEntry>
  bubbles: ActiveBubble[]
  particles: Particle[]
  focusId: string | null
  groomName: string
  brideName: string
  /** 초 단위 시간(아이들 흔들림용) */
  time: number
  fontReady: boolean
  /** dev: 스프라이트가 비어있을 때 실루엣으로 대체 */
  fallback: boolean
}

interface DrawItem {
  sortY: number
  draw: () => void
}

// dev 실루엣용 색(실제 스프라이트가 준비되면 쓰이지 않음)
const FB_SKIN = ['#f0cdb0', '#e7b894', '#d49b74', '#b97f58']
const FB_HAIR = ['#43372c', '#6f4a2f', '#2d2622', '#876445', '#9a9a9a']
const FB_OUTFIT = ['#9fb08f', '#c98f7d', '#8aa6b8', '#c9a05e', '#b58fb0', '#d4b36a']

export function renderWorld(p: RenderParams): void {
  const { ctx, layout, backdrop, agents, time } = p
  const { W, H } = layout

  ctx.clearRect(0, 0, W, H)
  ctx.drawImage(backdrop, 0, 0)

  const items: DrawItem[] = []

  // 장식(가구)
  for (const d of layout.decor) {
    items.push({ sortY: d.y, draw: () => drawDecor(ctx, d) })
  }

  // 신랑·신부(고정 위치, 정면)
  items.push({
    sortY: layout.coupleY,
    draw: () => drawCouple(p, 'groom', layout.groomX, layout.coupleY, p.groomName),
  })
  items.push({
    sortY: layout.coupleY,
    draw: () => drawCouple(p, 'bride', layout.brideX, layout.coupleY, p.brideName),
  })

  // 하객
  for (const a of agents) {
    const entry = p.entryById.get(a.id)
    if (!entry) continue
    items.push({ sortY: a.y, draw: () => drawGuest(p, a, entry) })
  }

  // 빈 상태 안내 표지판
  if (agents.length === 0) {
    const sx = layout.aisleX
    const sy = layout.walk.minY + 26
    items.push({ sortY: sy, draw: () => drawSign(ctx, sx, sy) })
  }

  items.sort((a, b) => a.sortY - b.sortY)
  for (const it of items) it.draw()

  // 파티클(하트·반짝이)
  for (const pt of p.particles) drawParticle(ctx, pt)

  // 말풍선(최상단)
  for (const b of p.bubbles) {
    const entry = p.entryById.get(b.id)
    const a = agents.find((g) => g.id === b.id)
    if (!entry || !a) continue
    drawBubble(p, a, b)
  }

  // 포커스 화살표(해당 캐릭터 위)
  if (p.focusId) {
    const a = agents.find((g) => g.id === p.focusId)
    if (a) drawFocusArrow(ctx, a.x, feetToHeadTop(a) - 10 - bob(time, a.bobPhase), time)
  }
}

// ── 캐릭터 ────────────────────────────────────────────────────

function bob(time: number, phase: number): number {
  return Math.sin(time * 2.4 + phase) * 0.6
}

function feetToHeadTop(a: Agent): number {
  return a.y - SPRITE_H
}

function frameFor(a: Agent): Frame {
  if (!a.moving) return 0
  return Math.floor(a.walkPhase / 5) % 2 === 0 ? 1 : 2
}

function spawnYOffset(anim: number): number {
  const e = 1 - Math.pow(1 - anim, 3)
  const fall = -(1 - e) * SPAWN_FALL_FROM
  const bounce = anim > 0.82 ? Math.sin(((anim - 0.82) / 0.18) * Math.PI) * -2.5 : 0
  return fall + bounce
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = PAL.shadow
  ctx.beginPath()
  ctx.ellipse(x, y, w, w * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()
}

interface Fallback {
  skin: string
  hair: string
  outfit: string
  shape: 'suit' | 'dress' | 'plain'
}

function guestFb(entry: GuestEntry): Fallback {
  const ap = entry.appearance
  return {
    skin: FB_SKIN[ap.skin % FB_SKIN.length],
    hair: FB_HAIR[ap.hairColor % FB_HAIR.length],
    outfit: FB_OUTFIT[ap.outfitColor % FB_OUTFIT.length],
    shape: 'plain',
  }
}

function drawGuest(p: RenderParams, a: Agent, entry: GuestEntry): void {
  const { ctx, time } = p
  let alpha = 1
  let yoff = bob(time, a.bobPhase)
  if (a.life === 'spawn') {
    yoff += spawnYOffset(a.anim)
    alpha = Math.min(1, a.anim / 0.3)
  } else if (a.life === 'despawn') {
    alpha = Math.max(0, 1 - a.anim)
    yoff -= a.anim * 3
  }
  if (a.hop > 0) yoff -= Math.sin(Math.min(1, a.hop) * Math.PI) * 4

  ctx.save()
  ctx.globalAlpha = alpha
  if (a.life !== 'spawn') drawShadow(ctx, a.x, a.y, 6)

  // 포커스 링
  if (p.focusId === a.id) {
    ctx.strokeStyle = PAL.accent
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(a.x, a.y, 8, 3.4, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  drawSprite(p, entry.appearance, a.dir, frameFor(a), a.x, a.y + yoff, guestFb(entry))

  if (p.fontReady) {
    const variant = p.focusId === a.id ? 'focus' : 'normal'
    drawLabel(ctx, entry.name, variant, a.x, a.y + yoff - SPRITE_H - 2, p.layout.W)
  }
  ctx.restore()
}

function drawCouple(p: RenderParams, kind: 'groom' | 'bride', x: number, y: number, name: string): void {
  const { ctx, time } = p
  const yoff = Math.sin(time * 1.8 + (kind === 'groom' ? 0 : 1.5)) * 0.5
  drawShadow(ctx, x, y, 7)
  const fb: Fallback =
    kind === 'groom'
      ? { skin: FB_SKIN[0], hair: FB_HAIR[2], outfit: '#352f2a', shape: 'suit' }
      : { skin: FB_SKIN[0], hair: FB_HAIR[0], outfit: '#f6efe4', shape: 'dress' }
  drawSprite(p, kind, 'down', 0, x, y + yoff, fb)
  if (p.fontReady) {
    drawLabel(ctx, name, 'couple', x, y + yoff - SPRITE_H - COUPLE_LABEL_DY, p.layout.W)
  }
}

/** 스프라이트(또는 dev 실루엣) 한 명 그리기 */
function drawSprite(
  p: RenderParams,
  kind: Parameters<typeof getSprite>[0],
  dir: Dir,
  frame: Frame,
  x: number,
  y: number,
  fb: Fallback,
): void {
  const { ctx } = p
  const dx = Math.round(x - SPRITE_W / 2)
  const dy = Math.round(y - SPRITE_H)
  if (p.fallback) {
    drawSilhouette(ctx, dx, dy, fb)
    return
  }
  ctx.drawImage(getSprite(kind, dir, frame), dx, dy)
}

/** dev 전용 대체 실루엣 — 간단한 사람 모양 (실제 스프라이트 준비 전까지만 사용) */
function drawSilhouette(ctx: CanvasRenderingContext2D, dx: number, dy: number, fb: Fallback): void {
  const px = (ox: number, oy: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(dx + ox, dy + oy, w, h)
  }
  px(5, 1, 6, 5, fb.hair) // 머리
  px(5, 4, 6, 5, fb.skin) // 얼굴
  px(6, 6, 1, 1, '#3b332b')
  px(9, 6, 1, 1, '#3b332b')
  if (fb.shape === 'dress') {
    px(5, 9, 6, 5, fb.outfit)
    px(3, 13, 10, 4, fb.outfit)
    px(3, 16, 10, 1, '#e7dcc8')
  } else if (fb.shape === 'suit') {
    px(5, 9, 6, 8, fb.outfit)
    px(7, 9, 2, 5, '#f6efe4')
    px(7, 10, 2, 1, PAL.accent)
  } else {
    px(5, 9, 6, 8, fb.outfit)
  }
  px(6, 17, 2, 3, '#4a4038') // 다리
  px(9, 17, 2, 3, '#4a4038')
}

// ── 이름표 ────────────────────────────────────────────────────

function drawLabel(
  ctx: CanvasRenderingContext2D,
  name: string,
  variant: 'normal' | 'couple' | 'focus',
  cx: number,
  bottomY: number,
  maxX: number,
): void {
  const lab = getLabel(name, variant)
  const w = lab.width / LBL_SCALE
  const h = lab.height / LBL_SCALE
  let x = Math.round(cx - w / 2)
  x = Math.max(2, Math.min(x, maxX - w - 2))
  const y = Math.round(bottomY - h)
  ctx.drawImage(lab, x, y, w, h)
}

// ── 말풍선 ────────────────────────────────────────────────────

function wrapKo(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const ch of text) {
    const test = cur + ch
    if (ctx.measureText(test).width > maxW && cur !== '') {
      lines.push(cur)
      cur = ch
      if (lines.length === maxLines - 1) break
    } else {
      cur = test
    }
  }
  // 남은 글자
  let rest = text.slice(lines.join('').length)
  if (lines.length < maxLines) {
    if (ctx.measureText(rest).width <= maxW) {
      if (rest) lines.push(rest)
    } else {
      while (rest.length > 1 && ctx.measureText(rest + '…').width > maxW) rest = rest.slice(0, -1)
      lines.push(rest + '…')
    }
  } else if (rest) {
    // 마지막 줄 말줄임
    let last = lines[maxLines - 1] ?? ''
    last = last + rest
    while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1)
    lines[maxLines - 1] = last + '…'
  }
  return lines
}

function drawBubble(p: RenderParams, a: Agent, b: ActiveBubble): void {
  const { ctx, layout } = p
  if (!p.fontReady) return
  ctx.font = `8px 'Galmuri9', 'Galmuri11', monospace`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  const maxW = 86
  const lines = wrapKo(ctx, b.text, maxW, 3)
  const lineH = 10
  const padX = 5
  const padY = 4
  let boxW = 0
  for (const ln of lines) boxW = Math.max(boxW, ctx.measureText(ln).width)
  boxW = Math.ceil(boxW) + padX * 2
  const boxH = lines.length * lineH + padY * 2

  let yoff = bob(p.time, a.bobPhase)
  if (a.life === 'spawn') yoff += spawnYOffset(a.anim)
  const headTop = a.y + yoff - SPRITE_H
  const bottom = headTop - 4
  let left = a.x - boxW / 2
  left = Math.max(3, Math.min(left, layout.W - boxW - 3))
  const top = Math.max(2, bottom - boxH)

  // pop 스케일(등장/퇴장)
  const s = 0.7 + 0.3 * b.pop
  ctx.save()
  ctx.globalAlpha = b.pop
  ctx.translate(a.x, bottom)
  ctx.scale(s, s)
  ctx.translate(-a.x, -bottom)

  // 상자
  roundBox(ctx, left, top, boxW, boxH, PAL.bubbleBg, PAL.bubbleLine)
  // 꼬리
  const tailX = Math.max(left + 4, Math.min(a.x, left + boxW - 6))
  ctx.fillStyle = PAL.bubbleBg
  ctx.fillRect(tailX, top + boxH - 1, 4, 3)
  ctx.fillStyle = PAL.bubbleLine
  ctx.fillRect(tailX, top + boxH + 2, 4, 1)
  ctx.fillRect(tailX - 1, top + boxH - 1, 1, 2)
  ctx.fillRect(tailX + 4, top + boxH - 1, 1, 2)

  // 텍스트(타자기: shown 글자까지)
  ctx.fillStyle = PAL.bubbleInk
  let shown = b.shown
  let ty = top + padY
  for (const ln of lines) {
    if (shown <= 0) break
    const take = Math.min(ln.length, shown)
    ctx.fillText(ln.slice(0, take), left + padX, ty)
    shown -= ln.length
    ty += lineH
  }
  ctx.restore()
}

function roundBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  line: string,
): void {
  ctx.fillStyle = line
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = fill
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2)
  // 모서리 깎기
  ctx.fillStyle = line
  ctx.clearRect(x, y, 1, 1)
  ctx.clearRect(x + w - 1, y, 1, 1)
  ctx.clearRect(x, y + h - 1, 1, 1)
  ctx.clearRect(x + w - 1, y + h - 1, 1, 1)
}

// ── 장식 ──────────────────────────────────────────────────────

function drawDecor(ctx: CanvasRenderingContext2D, d: Decor): void {
  drawShadow(ctx, d.x, d.y, d.kind === 'flowerStand' ? 5 : 9)
  const px = (ox: number, oy: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(d.x + ox), Math.round(d.y + oy), w, h)
  }
  if (d.kind === 'flowerStand') {
    px(-1, -14, 2, 14, PAL.woodDk) // 기둥
    px(-4, -1, 8, 2, PAL.wood) // 받침
    // 꽃다발
    px(-5, -22, 10, 8, PAL.leaf)
    px(-4, -24, 8, 4, PAL.leafHi)
    px(-3, -22, 3, 3, PAL.roseA)
    px(1, -23, 3, 3, PAL.roseB)
    px(-1, -20, 3, 3, PAL.cream)
    px(-4, -19, 2, 2, PAL.gold)
  } else if (d.kind === 'cakeTable') {
    px(-9, -6, 18, 8, PAL.cloth)
    px(-9, 0, 18, 2, PAL.clothSh)
    // 케이크
    px(-5, -14, 10, 8, PAL.cream)
    px(-5, -11, 10, 1, PAL.roseB)
    px(-5, -7, 10, 1, PAL.carpetEdge)
    px(-1, -17, 2, 3, PAL.gold)
    px(-4, -13, 2, 2, PAL.roseA)
    px(2, -13, 2, 2, PAL.roseA)
  } else {
    // roundTable
    px(-9, -4, 18, 7, PAL.cloth)
    px(-9, 1, 18, 2, PAL.clothSh)
    px(-10, -4, 20, 2, '#ffffffcc')
    // 센터피스
    px(-2, -10, 4, 6, PAL.leaf)
    px(-3, -11, 3, 3, PAL.roseA)
    px(0, -12, 3, 3, PAL.roseB)
    px(-1, -9, 2, 2, PAL.gold)
  }
}

// ── 빈 상태 안내 표지판 ───────────────────────────────────────

function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  drawShadow(ctx, x, y, 9)
  const px = (ox: number, oy: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x + ox), Math.round(y + oy), w, h)
  }
  px(-1, -16, 2, 16, PAL.woodDk) // 기둥
  px(-22, -40, 44, 26, PAL.cloth)
  px(-22, -40, 44, 2, PAL.gold)
  px(-22, -16, 44, 2, PAL.gold)
  px(-22, -40, 2, 26, PAL.gold)
  px(20, -40, 2, 26, PAL.gold)
  // 하트
  px(-3, -34, 2, 2, PAL.heart)
  px(1, -34, 2, 2, PAL.heart)
  px(-3, -32, 6, 2, PAL.heart)
  px(-2, -30, 4, 1, PAL.heart)
  ctx.font = `7px 'Galmuri9', 'Galmuri11', monospace`
  ctx.fillStyle = PAL.inkSoft
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('첫 축하를', x, y - 25)
  ctx.fillText('남겨주세요', x, y - 18)
}

// ── 파티클 ────────────────────────────────────────────────────

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const a = Math.max(0, Math.min(1, p.life / p.maxLife))
  ctx.save()
  ctx.globalAlpha = a
  const x = Math.round(p.x)
  const y = Math.round(p.y)
  if (p.kind === 'heart') {
    const s = p.size
    ctx.fillStyle = PAL.heart
    ctx.fillRect(x - 2 * s, y - 1 * s, 2 * s, 2 * s)
    ctx.fillRect(x, y - 1 * s, 2 * s, 2 * s)
    ctx.fillRect(x - 2 * s, y, 4 * s, 2 * s)
    ctx.fillRect(x - 1 * s, y + 2 * s, 2 * s, 1 * s)
    ctx.fillStyle = PAL.heartHi
    ctx.fillRect(x - 1 * s, y, 1 * s, 1 * s)
  } else {
    ctx.fillStyle = PAL.sparkle
    ctx.fillRect(x, y - 1, 1, 3)
    ctx.fillRect(x - 1, y, 3, 1)
  }
  ctx.restore()
}

function drawFocusArrow(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const yo = Math.round(Math.sin(time * 5) * 1.5)
  ctx.fillStyle = PAL.accent
  const ax = Math.round(x)
  const ay = Math.round(y + yo)
  ctx.fillRect(ax - 3, ay - 4, 6, 2)
  ctx.fillRect(ax - 2, ay - 2, 4, 2)
  ctx.fillRect(ax - 1, ay, 2, 2)
}
