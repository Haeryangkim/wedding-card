import { useEffect, useRef, useState } from 'react'
import type { GuestEntry } from '../types'
import { getSprite, SPRITE_H } from '../character'
import { ensureStyles, headHeight, onStyleLoaded, styleOf, STYLE_META, type StyleId } from '../styles/registry'
import { LOGICAL_W, MAX_STEPS_PER_FRAME, SIM_DT } from '../world/constants'
import {
  computeLayout,
  computeStageLayout,
  stageCapacity,
  STAGE_MIN_H,
  STAGE_MIN_W,
  type StageSpec,
  type WorldLayout,
} from '../world/layout'
import { Simulation } from '../world/sim'
import { renderBackdrop } from '../world/backdrop'
import { renderWorld } from '../world/render'
import { BubbleManager, type BubbleEntry } from '../world/bubbles'
import { Effects } from '../world/effects'
import { clearLabelCache } from '../world/labels'
import { scrollTopForAgent } from '../world/scroll'
import { TapTracker } from '../world/tap'
import './WorldCanvas.css'

export interface WorldCanvasProps {
  entries: GuestEntry[]
  /** 방금 등록한 내 캐릭터 등 강조할 하객 id — 카메라가 해당 캐릭터로 이동하고 말풍선을 띄움 */
  focusId?: string | null
  /** 포커스 "요청" 번호. 값이 바뀌면 같은 focusId 라도 다시 이동·말풍선을 실행한다. */
  focusSeq?: number
  /** 최초 목록 로드가 끝났는지. 생략하면 첫 비어있지 않은 목록을 최초 로드로 본다. */
  loaded?: boolean
  /** 식장 가운데 서 있는 두 사람의 이름표 (생략하면 "신랑"·"신부") */
  groomName?: string
  brideName?: string
  /** 캐릭터를 탭했을 때 */
  onSelect?: (entry: GuestEntry) => void
  /** 신랑·신부를 탭했을 때. 넘기면 두 사람 위에 "눌러보세요" 힌트가 첫 탭 전까지 떠 있다 */
  onSelectCouple?: () => void
  /**
   * 'embed'(기본): 너비에 맞추고 하객 수만큼 아래로 길어진다 (페이지가 스크롤).
   * 'stage': 컨테이너를 정확히 채운다 (스크롤 없음). 하객이 많으면 간격을 줄이고,
   *          화면에 다 세울 수 없으면 최근 하객만 보여 주며 "+N명" 을 표시한다.
   */
  mode?: 'embed' | 'stage'
  /** stage 모드: 위/아래 HUD 가 가리는 높이(CSS px). 장면이 그 안쪽에 배치된다 */
  insetTop?: number
  insetBottom?: number
  /** stage 모드: "+N명" 표시를 눌렀을 때 (전체 목록 열기 등) */
  onOverflowClick?: () => void
  /** 신랑·신부의 그림체 (생략 = 기본 픽셀) */
  coupleStyle?: StyleId
  className?: string
}

/** stage 모드에서 장면 한 화면의 목표 논리 너비 — 실제 너비는 정수 배율에 맞춰 조금 달라진다 */
const STAGE_TARGET_W = 184
/** "눌러보세요" 힌트를 이미 본 적 있는지 (탭 한 번이면 충분히 학습된다) */
const HINT_KEY = 'pixel-couple-hint-seen'

function hintSeen(): boolean {
  try {
    return sessionStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}
function markHintSeen(): void {
  try {
    sessionStorage.setItem(HINT_KEY, '1')
  } catch {
    // 저장소를 못 써도 동작에는 지장 없다
  }
}

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** 블랭크(스텁) 스프라이트인지 1회 판정 → dev 실루엣 대체 여부 */
function spritesAreBlank(): boolean {
  try {
    const c = getSprite('groom', 'down', 0)
    const g = c.getContext('2d')
    if (!g) return true
    const { data } = g.getImageData(0, 0, c.width, c.height)
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false
    return true
  } catch {
    return true
  }
}

/** 한 번의 동기화에서 이보다 많은 하객이 새로 나타나면 반짝임을 생략한다 */
const MAX_SPARKLE_ARRIVALS = 5

/** 결혼식장 맵 + 돌아다니는 하객 캐릭터 엔진(명령형). React 는 얇은 래퍼. */
class WorldEngine {
  private readonly canvas: HTMLCanvasElement
  private readonly wrap: HTMLElement
  private readonly ctx: CanvasRenderingContext2D
  private layout: WorldLayout
  private sim: Simulation
  private backdrop: HTMLCanvasElement
  private readonly bubbles: BubbleManager
  private readonly effects: Effects
  private readonly reduced: boolean
  private readonly fallback: boolean

  private entryById = new Map<string, GuestEntry>()
  private pool: BubbleEntry[] = []
  private knownIds = new Set<string>()
  private initialized = false
  private focusId: string | null = null
  private onSelect: ((e: GuestEntry) => void) | undefined
  private onSelectCouple: (() => void) | undefined
  private onOverflow: ((hidden: number) => void) | undefined
  private readonly stage: boolean
  private insetTop = 0
  private insetBottom = 0
  /** props 로 받은 전체 하객 (stage 모드에서는 이 중 일부만 장면에 세운다) */
  private all: GuestEntry[] = []
  private loaded: boolean | undefined
  private overflowCount = 0
  private layoutKey = ''
  /** 신랑·신부 힌트: 0..1 불투명도와 사라지는 중인지 */
  private hintAlpha = 0
  private hintOff = hintSeen()
  private hintSparkleT = 1.2
  private groomName = '신랑'
  private coupleStyle: StyleId = 'pixel'
  private brideName = '신부'

  private cssW = 320
  private cssH = 0
  /** 논리 px 하나의 CSS px 크기 */
  private unit = 320 / LOGICAL_W
  private dpr = 1
  private time = 0
  private lastTs = 0
  private acc = 0
  private fontReady = false
  private visible = true
  private hidden = false
  private raf = 0
  private running = false
  private destroyed = false

  private offStyles: (() => void) | null = null
  private ro: ResizeObserver | null = null
  private io: IntersectionObserver | null = null

  // 포인터(탭 vs 스크롤 구분)
  private tap = new TapTracker()

  constructor(canvas: HTMLCanvasElement, wrap: HTMLElement, stage: boolean) {
    this.canvas = canvas
    this.wrap = wrap
    this.stage = stage
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D 컨텍스트를 사용할 수 없습니다')
    this.ctx = ctx
    this.reduced = prefersReducedMotion()
    this.fallback = import.meta.env.DEV && spritesAreBlank()
    this.layout = computeLayout(0)
    this.sim = new Simulation(this.layout)
    this.backdrop = renderBackdrop(this.layout)
    // stage 모드는 장면이 화면 전체라 말풍선이 겹치면 답답하다 → 자동 말풍선은 한 번에 하나
    this.bubbles = new BubbleManager(Math.random, stage ? 1 : undefined)
    this.effects = new Effects()
  }

  start(): void {
    this.measure()
    this.relayout(true)
    this.setupFonts()

    this.ro = new ResizeObserver(() => this.onResize())
    this.ro.observe(this.wrap)

    this.io = new IntersectionObserver(
      (es) => {
        for (const e of es) this.visible = e.isIntersecting
        this.updateLoop()
      },
      { threshold: 0 },
    )
    this.io.observe(this.canvas)

    // 다른 그림체의 모듈이 뒤늦게 도착하면 (움직임 줄이기 모드의 정지 화면도) 다시 그린다
    this.offStyles = onStyleLoaded(() => {
      if (!this.destroyed && this.reduced) this.draw()
    })

    document.addEventListener('visibilitychange', this.onVisibility)
    // 주소창 접힘·화면 회전: 컨테이너 크기가 바뀌지 않는 브라우저에서도 다시 맞춘다
    window.visualViewport?.addEventListener('resize', this.onResize)
    window.addEventListener('orientationchange', this.onResize)
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerCancel)
    this.canvas.addEventListener('click', this.onClick)

    if (this.reduced) {
      this.settle()
      this.draw()
    } else {
      this.updateLoop()
    }
  }

  destroy(): void {
    this.destroyed = true
    this.running = false
    cancelAnimationFrame(this.raf)
    this.ro?.disconnect()
    this.io?.disconnect()
    this.offStyles?.()
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.visualViewport?.removeEventListener('resize', this.onResize)
    window.removeEventListener('orientationchange', this.onResize)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel)
    this.canvas.removeEventListener('click', this.onClick)
  }

  // ── 외부(props) 연동 ────────────────────────────────────────
  setCoupleStyle(id: StyleId): void {
    if (id === this.coupleStyle) return
    this.coupleStyle = id
    if (this.reduced) this.draw()
  }

  setNames(groomName: string, brideName: string): void {
    if (groomName === this.groomName && brideName === this.brideName) return
    this.groomName = groomName
    this.brideName = brideName
    if (this.reduced) this.draw()
  }

  setEntries(entries: GuestEntry[], loaded?: boolean): void {
    this.all = entries
    this.loaded = loaded
    this.applyEntries()
  }

  /** 전체 하객 중 장면에 세울 하객을 정하고(스테이지 모드의 상한) 시뮬레이션과 맞춘다 */
  private applyEntries(): void {
    const entries = this.visibleEntries()
    this.entryById = new Map(entries.map((e) => [e.id, e]))
    this.pool = entries.map((e) => ({ id: e.id, message: e.message }))
    const ids = entries.map((e) => e.id)

    // 이 장면에 필요한 그림체 모듈을 불러오기 시작한다 (기본 픽셀뿐이면 아무 일도 없다)
    ensureStyles(entries.map((e) => e.appearance))

    this.relayout(false, entries.length)
    this.sim.sync(ids, this.sizeOf)

    const hidden = this.all.length - entries.length
    if (hidden !== this.overflowCount) {
      this.overflowCount = hidden
      this.onOverflow?.(hidden)
    }

    // 최초 로드 이후 새로 등장한 하객엔 반짝임. (한꺼번에 많이 들어온 경우는 "새 하객"이
    // 아니라 목록 재적재이므로 생략)
    if (this.initialized) {
      const fresh = this.sim.list().filter((a) => !this.knownIds.has(a.id) && a.life === 'spawn')
      if (fresh.length <= MAX_SPARKLE_ARRIVALS) {
        for (const a of fresh) this.effects.spawnSparkle(a.x, a.y - 10, 7)
      }
    }
    this.knownIds = new Set(ids)
    // 로드 전의 빈 목록 동기화로 initialized 가 켜지면 첫 실제 목록 전체가 "새 하객"이 된다.
    if (this.loaded ?? this.all.length > 0) this.initialized = true

    if (this.reduced) {
      this.settle()
      this.draw()
    }
  }

  /** 그림체별 몸집 배수 (이웃 간격) */
  private sizeOf = (id: string): number => {
    const e = this.entryById.get(id)
    return e ? STYLE_META[styleOf(e.appearance)].sep : 1
  }

  /** stage 모드: 최근 하객부터 화면 정원만큼. 포커스된 하객은 오래됐어도 반드시 포함한다 */
  private visibleEntries(): GuestEntry[] {
    if (!this.stage) return this.all
    const cap = stageCapacity(this.stageSpec())
    if (this.all.length <= cap) return this.all
    const sorted = [...this.all].sort((a, b) => a.createdAt - b.createdAt)
    const recent = sorted.slice(sorted.length - cap)
    const focus = this.focusId
    if (focus && !recent.some((e) => e.id === focus)) {
      const f = sorted.find((e) => e.id === focus)
      if (f) recent[0] = f
    }
    return recent
  }

  /** 포커스 요청. 같은 id 로 다시 불려도 매번 말풍선(+ embed 모드에서는 스크롤)을 실행한다. */
  setFocus(id: string | null): void {
    this.focusId = id
    // 정원 밖에 있던 하객을 찾는 경우 장면에 불러온다
    if (this.stage && id && !this.entryById.has(id)) this.applyEntries()
    if (id) {
      const entry = this.entryById.get(id)
      if (entry) this.bubbles.showNow({ id, message: entry.message })
      // stage 모드는 한 화면이라 스크롤하지 않는다 — 강조(링·화살표·말풍선)만
      if (!this.stage) this.scrollToAgent(id)
    }
    if (this.reduced) this.draw()
  }

  setOnSelect(cb: ((e: GuestEntry) => void) | undefined): void {
    this.onSelect = cb
  }

  setOnSelectCouple(cb: (() => void) | undefined): void {
    this.onSelectCouple = cb
    if (cb && !this.hintOff) this.hintAlpha = 1
    if (!cb) this.hintAlpha = 0
    if (this.reduced) this.draw()
  }

  setOnOverflow(cb: ((hidden: number) => void) | undefined): void {
    this.onOverflow = cb
    cb?.(this.overflowCount)
  }

  setInsets(top: number, bottom: number): void {
    if (top === this.insetTop && bottom === this.insetBottom) return
    this.insetTop = top
    this.insetBottom = bottom
    if (!this.stage) return
    this.applyEntries()
    if (this.reduced) this.draw()
  }

  // ── 레이아웃 / 사이즈 ──────────────────────────────────────
  private measure(): void {
    this.cssW = Math.max(160, Math.round(this.wrap.clientWidth || this.canvas.clientWidth || 320))
    this.cssH = Math.max(160, Math.round(this.wrap.clientHeight || 0))
    this.dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
  }

  /** stage 모드: 디바이스 픽셀 기준 정수 배율(도트가 고르게 보인다) */
  private stageScale(): number {
    const devW = Math.round(this.cssW * this.dpr)
    const devH = Math.round(this.cssH * this.dpr)
    let scale = Math.max(1, Math.round(devW / STAGE_TARGET_W))
    // 너무 낮거나 좁은 화면(가로 모드 등)에서는 배율을 낮춰 장면이 잘리지 않게 한다
    scale = Math.min(scale, Math.floor(devH / STAGE_MIN_H), Math.floor(devW / STAGE_MIN_W))
    return Math.max(1, scale)
  }

  private stageSpec(): StageSpec {
    const scale = this.stageScale()
    const unit = scale / this.dpr
    return {
      W: Math.ceil(Math.round(this.cssW * this.dpr) / scale),
      H: Math.ceil(Math.round(this.cssH * this.dpr) / scale),
      insetTop: Math.ceil(this.insetTop / unit),
      insetBottom: Math.ceil(this.insetBottom / unit),
    }
  }

  /** 모드에 맞는 레이아웃을 다시 계산하고, 달라졌으면 시뮬레이션·배경·캔버스를 맞춘다 */
  private relayout(force: boolean, guestCount = this.layout.guestCount): void {
    let next: WorldLayout
    let key: string
    if (this.stage) {
      const spec = this.stageSpec()
      key = `s:${spec.W}x${spec.H}:${spec.insetTop}:${spec.insetBottom}:${guestCount}:${this.cssW}x${this.cssH}@${this.dpr}`
      if (!force && key === this.layoutKey) return
      next = computeStageLayout(spec, guestCount)
    } else {
      key = `e:${guestCount}:${this.cssW}@${this.dpr}`
      if (!force && key === this.layoutKey) return
      next = guestCount === this.layout.guestCount ? this.layout : computeLayout(guestCount)
    }
    this.layoutKey = key
    if (next !== this.layout) {
      const sameScene = next.W === this.layout.W && next.H === this.layout.H && next.wallTop === this.layout.wallTop
      this.layout = next
      this.sim.setLayout(next)
      if (!sameScene || force) this.backdrop = renderBackdrop(next)
    }
    this.resizeCanvas()
  }

  private resizeCanvas(): void {
    if (this.stage) {
      const scale = this.stageScale()
      this.unit = scale / this.dpr
      // 크기는 CSS(컨테이너 100%)가 정한다 — 비트맵만 디바이스 해상도로 맞춘다
      this.canvas.style.width = ''
      this.canvas.style.height = ''
      const bw = Math.round(this.cssW * this.dpr)
      const bh = Math.round(this.cssH * this.dpr)
      if (this.canvas.width !== bw) this.canvas.width = bw
      if (this.canvas.height !== bh) this.canvas.height = bh
      this.ctx.imageSmoothingEnabled = false
      return
    }
    const unit = this.cssW / LOGICAL_W
    this.unit = unit
    const cssH = this.layout.H * unit
    this.canvas.style.width = `${this.cssW}px`
    this.canvas.style.height = `${cssH}px`
    this.canvas.width = Math.round(this.cssW * this.dpr)
    this.canvas.height = Math.round(cssH * this.dpr)
    this.ctx.imageSmoothingEnabled = false
  }

  private onResize = (): void => {
    if (this.destroyed) return
    const prevW = this.cssW
    const prevH = this.cssH
    const prevDpr = this.dpr
    this.measure()
    if (this.stage) {
      if (this.cssW === prevW && this.cssH === prevH && this.dpr === prevDpr) return
      // 화면 크기에 따라 정원도 달라진다
      this.applyEntries()
      if (this.reduced) this.draw()
    } else if (this.cssW !== prevW) {
      this.relayout(false)
      if (this.reduced) this.draw()
    }
  }
  private onVisibility = (): void => {
    this.hidden = document.hidden
    this.updateLoop()
  }

  // ── 루프 ────────────────────────────────────────────────────
  private updateLoop(): void {
    if (this.reduced || this.destroyed) return
    const should = this.visible && !this.hidden
    if (should && !this.running) {
      this.running = true
      this.lastTs = performance.now()
      this.raf = requestAnimationFrame(this.frame)
    } else if (!should && this.running) {
      this.running = false
      cancelAnimationFrame(this.raf)
    }
  }

  private frame = (now: number): void => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.frame)
    let dt = (now - this.lastTs) / 1000
    this.lastTs = now
    if (dt > 0.1) dt = 0.1

    this.acc += dt
    let steps = 0
    while (this.acc >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
      this.sim.step(SIM_DT)
      this.acc -= SIM_DT
      steps++
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0

    this.bubbles.update(dt, this.pool)
    this.effects.update(dt)
    this.updateHint(dt)
    this.time += dt
    this.draw()
  }

  /** 신랑·신부 "눌러보세요" 힌트: 첫 탭 뒤 서서히 사라지고, 떠 있는 동안 가끔 반짝인다 */
  private updateHint(dt: number): void {
    if (this.hintOff) {
      if (this.hintAlpha > 0) this.hintAlpha = Math.max(0, this.hintAlpha - dt / 0.35)
      return
    }
    if (this.hintAlpha <= 0) return
    this.hintSparkleT -= dt
    if (this.hintSparkleT <= 0) {
      this.hintSparkleT = 1.5 + Math.random() * 1.2
      const L = this.layout
      const x = (Math.random() < 0.5 ? L.groomX : L.brideX) + (Math.random() - 0.5) * 14
      this.effects.spawnSparkle(x, L.coupleY - 14 - Math.random() * 18, 3)
    }
  }

  /** prefers-reduced-motion: 애니메이션 없이 정착된 한 프레임 */
  private settle(): void {
    for (let i = 0; i < 260; i++) this.sim.step(SIM_DT)
  }

  private draw(): void {
    let sx: number
    let sy: number
    if (this.stage) {
      sx = sy = this.unit * this.dpr
    } else {
      sx = this.canvas.width / this.layout.W
      sy = this.canvas.height / this.layout.H
    }
    this.ctx.setTransform(sx, 0, 0, sy, 0, 0)
    this.ctx.imageSmoothingEnabled = false
    renderWorld({
      ctx: this.ctx,
      sx,
      sy,
      layout: this.layout,
      backdrop: this.backdrop,
      agents: this.sim.list(),
      entryById: this.entryById,
      bubbles: this.reduced ? [] : this.bubbles.list(),
      particles: this.reduced ? [] : this.effects.list(),
      focusId: this.focusId,
      groomName: this.groomName,
      brideName: this.brideName,
      time: this.reduced ? 0 : this.time,
      fontReady: this.fontReady,
      fallback: this.fallback,
      coupleHint: this.hintAlpha,
      coupleStyle: this.coupleStyle,
    })
  }

  private setupFonts(): void {
    const done = () => {
      if (this.destroyed) return
      this.fontReady = true
      clearLabelCache()
      if (this.reduced) this.draw()
    }
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts && typeof fonts.load === 'function') {
      Promise.all([fonts.load("9px 'Galmuri11'"), fonts.load("8px 'Galmuri9'")])
        .then(done)
        .catch(done)
    } else {
      done()
    }
  }

  // ── 포인터(탭/스크롤) ──────────────────────────────────────
  private toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect()
    const unit = this.stage ? this.unit : r.width / this.layout.W
    return { x: (clientX - r.left) / unit, y: (clientY - r.top) / unit }
  }

  // pointerdown/up 은 탭인지 기록만 하고, 동작은 click 에서 한다.
  // (pointerup 에서 카드·팝업을 띄우면 터치의 합성 click 이 방금 뜬 오버레이의 버튼에 떨어진다)
  private onPointerDown = (e: PointerEvent): void => {
    this.tap.down(e.clientX, e.clientY, performance.now())
  }

  private onPointerCancel = (): void => {
    this.tap.cancel()
  }

  private onPointerUp = (e: PointerEvent): void => {
    this.tap.up(e.clientX, e.clientY, performance.now())
  }

  private onClick = (): void => {
    const p = this.tap.consume()
    if (!p) return
    const { x, y } = this.toLogical(p.x, p.y)
    this.handleTap(x, y)
  }

  private handleTap(lx: number, ly: number): void {
    if (this.onSelectCouple && this.hitCouple(lx, ly)) {
      const L = this.layout
      this.effects.spawnHearts((L.groomX + L.brideX) / 2, L.coupleY - SPRITE_H + 4, 6)
      if (!this.hintOff) {
        this.hintOff = true
        markHintSeen()
        if (this.reduced) this.hintAlpha = 0
      }
      this.onSelectCouple()
      if (this.reduced) this.draw()
      return
    }
    const hit = this.pickAgent(lx, ly)
    if (hit) {
      const entry = this.entryById.get(hit.id)
      if (entry) {
        this.bubbles.showNow({ id: entry.id, message: entry.message })
        this.onSelect?.(entry)
      }
      if (this.reduced) this.draw()
      return
    }
    // 빈 바닥 → 하트 + 주변 하객 깡총
    if (ly >= this.layout.walk.minY - 6) {
      this.effects.spawnHearts(lx, ly, 5)
      for (const a of this.sim.list()) {
        if (a.life !== 'alive') continue
        const d = Math.hypot(a.x - lx, a.y - ly)
        if (d < 26) {
          a.hop = 1
          a.dir = a.x < lx ? 'right' : 'left'
        }
      }
      if (this.reduced) this.draw()
    }
  }

  /** 신랑·신부(이름표·힌트 말풍선 포함)를 눌렀는지. 두 사람 사이 틈도 포함해 넉넉하게 잡는다 */
  private hitCouple(lx: number, ly: number): boolean {
    const L = this.layout
    const top = L.coupleY - SPRITE_H - (this.hintAlpha > 0.5 ? 34 : 20)
    return lx >= L.groomX - 13 && lx <= L.brideX + 13 && ly >= top && ly <= L.coupleY + 4
  }

  /** 발 기준 스프라이트 박스로 히트테스트. 앞(큰 y)부터 우선 */
  private pickAgent(lx: number, ly: number) {
    const agents = this.sim.list()
    const ppu = this.stage ? this.unit * this.dpr : this.canvas.width / this.layout.W
    let best: { id: string; y: number } | null = null
    for (const a of agents) {
      if (a.life === 'despawn') continue
      const entry = this.entryById.get(a.id)
      if (!entry) continue
      const id = styleOf(entry.appearance)
      const withinX = Math.abs(lx - a.x) <= STYLE_META[id].halfW
      const withinY = ly <= a.y + 2 && ly >= a.y - headHeight(id, ppu) - 2
      if (withinX && withinY && (!best || a.y > best.y)) best = { id: a.id, y: a.y }
    }
    return best
  }

  private scrollToAgent(id: string): void {
    const a = this.sim.list().find((g) => g.id === id)
    if (!a) return
    const r = this.canvas.getBoundingClientRect()
    const unit = r.width / this.layout.W
    const top = scrollTopForAgent(r.top + a.y * unit, window.scrollY, window.innerHeight)
    if (top === null) return // 캐릭터가 이미 화면 안에 보임
    window.scrollTo({ top, behavior: this.reduced ? 'auto' : 'smooth' })
  }
}

export function WorldCanvas({
  entries,
  focusId,
  focusSeq,
  loaded,
  groomName,
  brideName,
  onSelect,
  onSelectCouple,
  mode = 'embed',
  insetTop = 0,
  insetBottom = 0,
  onOverflowClick,
  coupleStyle = 'pixel',
  className,
}: WorldCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<WorldEngine | null>(null)
  const stage = mode === 'stage'
  /** stage 모드에서 화면에 다 세우지 못한 하객 수 */
  const [hidden, setHidden] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const engine = new WorldEngine(canvas, wrap, stage)
    engineRef.current = engine
    engine.setOnOverflow(setHidden)
    engine.start()
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [stage])

  useEffect(() => {
    engineRef.current?.setInsets(insetTop, insetBottom)
  }, [insetTop, insetBottom, stage])

  useEffect(() => {
    engineRef.current?.setNames(groomName?.trim() || '신랑', brideName?.trim() || '신부')
  }, [groomName, brideName, stage])

  useEffect(() => {
    engineRef.current?.setCoupleStyle(coupleStyle)
  }, [coupleStyle, stage])

  useEffect(() => {
    engineRef.current?.setEntries(entries, loaded)
  }, [entries, loaded, stage])

  useEffect(() => {
    engineRef.current?.setFocus(focusId ?? null)
  }, [focusId, focusSeq, stage])

  useEffect(() => {
    engineRef.current?.setOnSelect(onSelect)
  }, [onSelect, stage])

  useEffect(() => {
    engineRef.current?.setOnSelectCouple(onSelectCouple)
  }, [onSelectCouple, stage])

  const moreLabel = `+${hidden}명`
  return (
    <div
      ref={wrapRef}
      className={`world-canvas-wrap${stage ? ' world-canvas-wrap--stage' : ''}${className ? ` ${className}` : ''}`}
    >
      <canvas
        ref={canvasRef}
        className="world-canvas"
        role="img"
        aria-label={`결혼식장을 거니는 하객 캐릭터 ${entries.length}명`}
      />
      {stage &&
        hidden > 0 &&
        (onOverflowClick ? (
          <button
            type="button"
            className="world-canvas-more"
            style={{ bottom: insetBottom + 8 }}
            onClick={onOverflowClick}
            aria-label={`화면에 없는 하객 ${hidden}명 더 보기`}
          >
            {moreLabel}
          </button>
        ) : (
          <span className="world-canvas-more" style={{ bottom: insetBottom + 8 }}>
            {moreLabel}
          </span>
        ))}
    </div>
  )
}
