/**
 * 프레임 렌더러 — 시뮬레이션 상태를 캔버스에 그린다(시뮬과 분리).
 * ctx 는 이미 "논리좌표→디바이스" 로 스케일되어 있고 imageSmoothing=off 상태로 들어온다.
 *
 * 그림체가 섞여 있다: 기본 픽셀은 장면의 도트 배율 그대로, 다른 그림체는 기기 픽셀 좌표에 직접
 * (도트는 정수배 최근접 확대, 벡터는 기기 해상도 캔버스를 1:1 로) 그린다. 발 위치(x, y)가 공통 기준이고
 * 그림자·이름표·말풍선·링은 그림체별 수치(styles/registry.ts 의 STYLE_META)를 쓴다.
 * 스타일 모듈이 아직 안 온 하객은 그림자·이름표만 보이다가 준비되면 나타난다.
 * (world 내부 전용)
 */
import type { GuestEntry } from '../types'
import { getSprite, SPRITE_H, SPRITE_W, type Dir, type Frame } from '../character'
import { blitScale, getSpriteAt, headHeight, spriteScale, styleOf, STYLE_META, type SpriteKind } from '../styles/registry'
import type { ActiveBubble } from './bubbles'
import { COUPLE_LABEL_DY, SPAWN_FALL_FROM } from './constants'
import type { Particle } from './effects'
import type { Decor, WorldLayout } from './layout'
import { getLabel, LBL_SCALE } from './labels'
import { PAL } from './palette'
import type { Agent } from './sim'

export interface RenderParams {
  ctx: CanvasRenderingContext2D
  /** 논리 px 하나의 기기 픽셀 수 (ctx 에 걸린 배율과 같아야 한다) */
  sx: number
  sy: number
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
  /** 신랑·신부 위 "눌러보세요" 힌트 불투명도 (0 또는 생략 = 없음) */
  coupleHint?: number
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
  const crowded = crowdedLabels(agents, p.focusId, layout)
  for (const a of agents) {
    const entry = p.entryById.get(a.id)
    if (!entry) continue
    items.push({ sortY: a.y, draw: () => drawGuest(p, a, entry, !crowded.has(a.id)) })
  }

  // 빈 상태 안내 표지판
  if (agents.length === 0) {
    const sx = layout.aisleX
    const sy = layout.walk.minY + 46
    items.push({ sortY: sy, draw: () => drawSign(ctx, sx, sy) })
  }

  items.sort((a, b) => a.sortY - b.sortY)
  for (const it of items) it.draw()

  // 파티클(하트·반짝이)
  for (const pt of p.particles) drawParticle(ctx, pt)

  if (p.coupleHint && p.coupleHint > 0) drawCoupleHint(p, p.coupleHint)

  // 말풍선(최상단)
  for (const b of p.bubbles) {
    const entry = p.entryById.get(b.id)
    const a = agents.find((g) => g.id === b.id)
    if (!entry || !a) continue
    drawBubble(p, a, b, entry)
  }

  // 포커스 화살표(해당 캐릭터 위)
  if (p.focusId) {
    const a = agents.find((g) => g.id === p.focusId)
    const entry = a && p.entryById.get(a.id)
    if (a && entry) drawFocusArrow(ctx, a.x, a.y - headOf(p, entry) - 10 - bob(time, a.bobPhase), time)
  }
}

// ── 캐릭터 ────────────────────────────────────────────────────

function bob(time: number, phase: number): number {
  return Math.sin(time * 2.4 + phase) * 0.6
}

/** 발에서 머리 꼭대기까지(논리 px) — 그림체와 실제 확대 배율에 따라 다르다 */
function headOf(p: RenderParams, entry: GuestEntry): number {
  return headHeight(styleOf(entry.appearance), p.sx)
}

/** 걷기 4박자: 왼발 → 모음 → 오른발 → 모음. 모음(0)에서 상체가 1px 올라와 걸음마다 bob 이 생긴다. */
const WALK_CYCLE: Frame[] = [1, 0, 2, 0]
/** 한 박자에 해당하는 이동 거리(논리 px) */
const STEP_LEN = 3.5

function frameFor(a: Agent): Frame {
  if (!a.moving) return 0
  return WALK_CYCLE[Math.floor(a.walkPhase / STEP_LEN) % WALK_CYCLE.length]
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

/**
 * 이름표가 바로 뒤에 선 다른 하객의 얼굴을 가리게 되는 하객 id 집합.
 * (키 큰 스프라이트라 붐빌 때 이름표가 얼굴을 덮는다 → 그런 이름표는 숨기고, 탭/목록으로 확인)
 * 포커스된 하객의 이름표는 항상 보인다.
 */
function crowdedLabels(agents: Agent[], focusId: string | null, layout: WorldLayout): Set<string> {
  const out = new Set<string>()
  const reach = SPRITE_H - 12 // 내 이름표(머리 위)와 겹치는 뒤쪽 하객의 얼굴 높이 범위
  const coupleCx = (layout.groomX + layout.brideX) / 2
  const coupleHalf = (layout.brideX - layout.groomX) / 2 + 28
  for (const a of agents) {
    if (a.id === focusId) continue
    // 신랑·신부 바로 앞에 선 하객의 이름표는 두 사람을 가린다
    if (a.y - layout.coupleY < SPRITE_H + 14 && Math.abs(a.x - coupleCx) < coupleHalf) {
      out.add(a.id)
      continue
    }
    for (const b of agents) {
      if (b === a || b.life === 'despawn') continue
      const dy = a.y - b.y
      if (dy > 2 && dy < reach && Math.abs(a.x - b.x) < SPRITE_W - 2) {
        out.add(a.id)
        break
      }
    }
  }
  return out
}

function drawGuest(p: RenderParams, a: Agent, entry: GuestEntry, showLabel: boolean): void {
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

  const meta = STYLE_META[styleOf(entry.appearance)]
  ctx.save()
  ctx.globalAlpha = alpha
  // 벡터 그림체는 스프라이트 안에 그림자가 있다 (shadowR = 0)
  if (a.life !== 'spawn' && meta.shadowR > 0) drawShadow(ctx, a.x, a.y - 1, meta.shadowR)

  // 포커스 링
  if (p.focusId === a.id) {
    ctx.strokeStyle = PAL.accent
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(a.x, a.y - 1, meta.halfW, 4, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  drawSprite(p, entry.appearance, a.dir, frameFor(a), a.x, a.y + yoff, guestFb(entry))

  if (p.fontReady && showLabel) {
    const variant = p.focusId === a.id ? 'focus' : 'normal'
    drawLabel(ctx, entry.name, variant, a.x, a.y + yoff - headOf(p, entry) - 2, p.layout.W)
  }
  ctx.restore()
}

function drawCouple(p: RenderParams, kind: 'groom' | 'bride', x: number, y: number, name: string): void {
  const { ctx, time } = p
  const yoff = Math.sin(time * 1.8 + (kind === 'groom' ? 0 : 1.5)) * 0.5
  drawShadow(ctx, x, y - 1, kind === 'bride' ? 10 : 7)
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
  kind: SpriteKind,
  dir: Dir,
  frame: Frame,
  x: number,
  y: number,
  fb: Fallback,
): void {
  const { ctx } = p
  const id = styleOf(kind)
  if (id === 'pixel') {
    const dx = Math.round(x - SPRITE_W / 2)
    const dy = Math.round(y - SPRITE_H)
    if (p.fallback) {
      drawSilhouette(ctx, dx, dy, fb)
      return
    }
    ctx.drawImage(getSprite(kind, dir, frame), dx, dy)
    return
  }
  // 다른 그림체: 기기 픽셀 좌표에 직접 그린다 (도트 = 정수배 최근접, 벡터 = 구운 크기 그대로(dpr 2 초과분만 확대) + 스무딩)
  const scale = spriteScale(id, p.sx)
  const sprite = getSpriteAt(kind, dir, frame, scale)
  const meta = STYLE_META[id]
  if (!sprite) {
    // 스타일 모듈을 불러오는 중이거나 불러오지 못했다 — 이름표·탭 판정만 떠다니지 않게 대체 실루엣을 세운다
    if (meta.shadowR === 0) drawShadow(ctx, x, y - 1, 7)
    drawSilhouette(ctx, Math.round(x - SPRITE_W / 2), Math.round(y - SPRITE_H), fb)
    return
  }
  const k = blitScale(id, scale)
  const w = sprite.width * k
  const h = sprite.height * k
  const devX = Math.round(x * p.sx - w / 2)
  const devY = Math.round(y * p.sy - (h * meta.footY) / meta.nominalH)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = !meta.pixelated
  ctx.drawImage(sprite, devX, devY, w, h)
  ctx.imageSmoothingEnabled = false
  ctx.setTransform(p.sx, 0, 0, p.sy, 0, 0)
}

/** 대체 실루엣 — 간단한 사람 모양 (dev 폴백, 그리고 그림체 모듈이 아직 없거나 불러오지 못한 하객) */
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

/** 신랑·신부 머리 위에 떠서 살짝 오르내리는 "눌러보세요" 말풍선 */
function drawCoupleHint(p: RenderParams, alpha: number): void {
  const { ctx, layout, time } = p
  if (!p.fontReady) return
  const text = '눌러보세요'
  ctx.font = `8px 'Galmuri9', 'Galmuri11', monospace`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const boxW = Math.ceil(ctx.measureText(text).width) + 10
  const boxH = 15
  const cx = Math.round((layout.groomX + layout.brideX) / 2)
  const bottom = layout.coupleY - SPRITE_H - COUPLE_LABEL_DY - 15 + Math.round(Math.sin(time * 3) * 1.5)
  const left = Math.round(cx - boxW / 2)
  const top = bottom - boxH
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
  ctx.fillStyle = PAL.accent
  ctx.fillRect(left + 1, top, boxW - 2, boxH)
  ctx.fillRect(left, top + 1, boxW, boxH - 2)
  // 꼬리
  ctx.fillRect(cx - 2, top + boxH, 4, 1)
  ctx.fillRect(cx - 1, top + boxH + 1, 2, 1)
  ctx.fillStyle = '#fffdf8'
  ctx.fillText(text, left + 5, top + 4)
  ctx.restore()
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

function drawBubble(p: RenderParams, a: Agent, b: ActiveBubble, entry: GuestEntry): void {
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
  const headTop = a.y + yoff - headOf(p, entry)
  const bottom = headTop - 4
  let left = a.x - boxW / 2
  left = Math.max(3, Math.min(left, layout.W - boxW - 3))
  let top = Math.max(layout.wallTop + 2, bottom - boxH)

  // 신랑·신부(와 이름표)를 가리게 되면 옆으로 비키고, 화면이 좁아 옆자리가 없으면 캐릭터 발아래에 띄운다
  // (두 사람은 눌러서 인사말을 여는 주인공)
  const cL = layout.groomX - 11
  const cR = layout.brideX + 11
  const cTop = layout.coupleY - SPRITE_H - 14
  const covers = (l: number) => top < layout.coupleY && top + boxH > cTop && l < cR && l + boxW > cL
  let below = false
  if (covers(left)) {
    const side = a.x >= layout.aisleX ? Math.min(cR + 1, layout.W - boxW - 3) : Math.max(cL - 1 - boxW, 3)
    if (!covers(side)) {
      left = side
    } else {
      below = true
      top = Math.round(Math.min(a.y + yoff + 6, layout.H - boxH - 2))
    }
  }

  // pop 스케일(등장/퇴장)
  const s = 0.7 + 0.3 * b.pop
  const pivotY = below ? top : bottom
  ctx.save()
  ctx.globalAlpha = b.pop
  ctx.translate(a.x, pivotY)
  ctx.scale(s, s)
  ctx.translate(-a.x, -pivotY)

  // 상자
  roundBox(ctx, left, top, boxW, boxH, PAL.bubbleBg, PAL.bubbleLine)
  // 꼬리 (발아래에 띄울 때는 위쪽으로)
  const tailX = Math.max(left + 4, Math.min(a.x, left + boxW - 6))
  if (below) {
    ctx.fillStyle = PAL.bubbleBg
    ctx.fillRect(tailX, top - 2, 4, 3)
    ctx.fillStyle = PAL.bubbleLine
    ctx.fillRect(tailX, top - 3, 4, 1)
    ctx.fillRect(tailX - 1, top - 2, 1, 2)
    ctx.fillRect(tailX + 4, top - 2, 1, 2)
  } else {
    ctx.fillStyle = PAL.bubbleBg
    ctx.fillRect(tailX, top + boxH - 1, 4, 3)
    ctx.fillStyle = PAL.bubbleLine
    ctx.fillRect(tailX, top + boxH + 2, 4, 1)
    ctx.fillRect(tailX - 1, top + boxH - 1, 1, 2)
    ctx.fillRect(tailX + 4, top + boxH - 1, 1, 2)
  }

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
  drawShadow(ctx, d.x, d.y, d.kind === 'flowerStand' ? 7 : 15)
  const px = (ox: number, oy: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(d.x + ox), Math.round(d.y + oy), w, h)
  }
  if (d.kind === 'flowerStand') {
    // 하객 어깨 높이의 꽃 스탠드
    px(-1, -22, 3, 22, PAL.woodDk) // 기둥
    px(0, -22, 1, 22, PAL.wood)
    px(-5, -2, 11, 3, PAL.wood) // 받침
    px(-5, 0, 11, 1, PAL.woodDk)
    // 꽃다발
    px(-7, -33, 15, 12, PAL.leaf)
    px(-6, -35, 13, 4, PAL.leafHi)
    px(-8, -30, 2, 6, PAL.leaf)
    px(7, -30, 2, 6, PAL.leaf)
    px(-5, -32, 4, 4, PAL.roseA)
    px(1, -34, 4, 4, PAL.roseB)
    px(-1, -29, 4, 4, PAL.cream)
    px(3, -28, 3, 3, PAL.roseA)
    px(-6, -26, 3, 3, PAL.roseB)
    px(-4, -31, 1, 1, PAL.cream)
    px(2, -33, 1, 1, PAL.cream)
    px(-2, -25, 2, 2, PAL.gold)
  } else if (d.kind === 'cakeTable') {
    // 식탁보를 씌운 테이블
    px(-14, -12, 28, 3, '#ffffffcc')
    px(-14, -9, 28, 10, PAL.cloth)
    px(-14, -1, 28, 3, PAL.clothSh)
    px(-10, -9, 1, 9, PAL.clothSh)
    px(9, -9, 1, 9, PAL.clothSh)
    // 3단 케이크
    px(-8, -19, 16, 7, PAL.cream)
    px(-8, -14, 16, 1, PAL.roseB)
    px(-6, -25, 12, 6, PAL.cream)
    px(-6, -21, 12, 1, PAL.carpetEdge)
    px(-4, -30, 8, 5, PAL.cream)
    px(-4, -27, 8, 1, PAL.roseB)
    px(-1, -34, 2, 4, PAL.gold)
    px(-7, -18, 2, 2, PAL.roseA)
    px(5, -18, 2, 2, PAL.roseA)
    px(-1, -24, 2, 2, PAL.roseA)
  } else {
    // roundTable
    px(-12, -12, 24, 3, '#ffffffcc')
    px(-14, -10, 28, 2, '#ffffffcc')
    px(-14, -8, 28, 9, PAL.cloth)
    px(-14, -1, 28, 3, PAL.clothSh)
    px(-9, -8, 1, 8, PAL.clothSh)
    px(8, -8, 1, 8, PAL.clothSh)
    // 센터피스
    px(-3, -19, 6, 8, PAL.leaf)
    px(-5, -21, 4, 4, PAL.roseA)
    px(0, -23, 4, 4, PAL.roseB)
    px(-2, -17, 3, 3, PAL.cream)
    px(2, -18, 2, 2, PAL.gold)
    // 접시
    px(-11, -10, 4, 1, PAL.clothSh)
    px(7, -10, 4, 1, PAL.clothSh)
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
  // 판: 글자 두 줄(8px)이 테두리에 닿지 않도록 넉넉하게
  px(-27, -48, 54, 34, PAL.cloth)
  px(-27, -48, 54, 2, PAL.gold)
  px(-27, -16, 54, 2, PAL.gold)
  px(-27, -48, 2, 34, PAL.gold)
  px(25, -48, 2, 34, PAL.gold)
  // 하트
  px(-3, -44, 2, 2, PAL.heart)
  px(1, -44, 2, 2, PAL.heart)
  px(-3, -42, 6, 2, PAL.heart)
  px(-2, -40, 4, 1, PAL.heart)
  ctx.font = `8px 'Galmuri9', 'Galmuri11', monospace`
  ctx.fillStyle = PAL.inkSoft
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('첫 축하를', Math.round(x), Math.round(y) - 37)
  ctx.fillText('남겨주세요', Math.round(x), Math.round(y) - 27)
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
