import { useEffect, useRef } from 'react'
import type { GuestEntry } from '../types'
import { wedding } from '../../config/wedding'
import { getSprite, SPRITE_H } from '../character'
import { LOGICAL_W, MAX_STEPS_PER_FRAME, SIM_DT } from '../world/constants'
import { computeLayout, type WorldLayout } from '../world/layout'
import { Simulation } from '../world/sim'
import { renderBackdrop } from '../world/backdrop'
import { renderWorld } from '../world/render'
import { BubbleManager, type BubbleEntry } from '../world/bubbles'
import { Effects } from '../world/effects'
import { clearLabelCache } from '../world/labels'
import './WorldCanvas.css'

export interface WorldCanvasProps {
  entries: GuestEntry[]
  /** 방금 등록한 내 캐릭터 등 강조할 하객 id — 카메라가 해당 캐릭터로 이동하고 말풍선을 띄움 */
  focusId?: string | null
  /** 캐릭터를 탭했을 때 */
  onSelect?: (entry: GuestEntry) => void
  className?: string
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

  private cssW = 320
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

  private ro: ResizeObserver | null = null
  private io: IntersectionObserver | null = null

  // 포인터(탭 vs 스크롤 구분)
  private downX = 0
  private downY = 0
  private downT = 0
  private tracking = false

  constructor(canvas: HTMLCanvasElement, wrap: HTMLElement) {
    this.canvas = canvas
    this.wrap = wrap
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D 컨텍스트를 사용할 수 없습니다')
    this.ctx = ctx
    this.reduced = prefersReducedMotion()
    this.fallback = import.meta.env.DEV && spritesAreBlank()
    this.layout = computeLayout(0)
    this.sim = new Simulation(this.layout)
    this.backdrop = renderBackdrop(this.layout)
    this.bubbles = new BubbleManager()
    this.effects = new Effects()
  }

  start(): void {
    this.measure()
    this.resizeCanvas()
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

    document.addEventListener('visibilitychange', this.onVisibility)
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerCancel)

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
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel)
  }

  // ── 외부(props) 연동 ────────────────────────────────────────
  setEntries(entries: GuestEntry[]): void {
    this.entryById = new Map(entries.map((e) => [e.id, e]))
    this.pool = entries.map((e) => ({ id: e.id, message: e.message }))
    const ids = entries.map((e) => e.id)

    if (entries.length !== this.layout.guestCount) {
      this.layout = computeLayout(entries.length)
      this.sim.setLayout(this.layout)
      this.backdrop = renderBackdrop(this.layout)
      this.resizeCanvas()
    }
    this.sim.sync(ids)

    // 최초 로드 이후 새로 등장한 하객엔 반짝임
    if (this.initialized) {
      for (const a of this.sim.list()) {
        if (!this.knownIds.has(a.id) && a.life === 'spawn') {
          this.effects.spawnSparkle(a.x, a.y - 10, 7)
        }
      }
    }
    this.knownIds = new Set(ids)
    this.initialized = true

    if (this.reduced) {
      this.settle()
      this.draw()
    }
  }

  setFocus(id: string | null): void {
    const changed = id !== this.focusId
    this.focusId = id
    if (id && changed) {
      const entry = this.entryById.get(id)
      if (entry) this.bubbles.showNow({ id, message: entry.message })
      this.scrollToAgent(id)
    }
    if (this.reduced) this.draw()
  }

  setOnSelect(cb: ((e: GuestEntry) => void) | undefined): void {
    this.onSelect = cb
  }

  // ── 레이아웃 / 사이즈 ──────────────────────────────────────
  private measure(): void {
    this.cssW = Math.max(160, Math.round(this.wrap.clientWidth || this.canvas.clientWidth || 320))
    this.dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
  }

  private resizeCanvas(): void {
    const unit = this.cssW / LOGICAL_W
    const cssH = this.layout.H * unit
    this.canvas.style.width = `${this.cssW}px`
    this.canvas.style.height = `${cssH}px`
    this.canvas.width = Math.round(this.cssW * this.dpr)
    this.canvas.height = Math.round(cssH * this.dpr)
    this.ctx.imageSmoothingEnabled = false
  }

  private onResize(): void {
    const prevW = this.cssW
    this.measure()
    if (this.cssW !== prevW) {
      this.resizeCanvas()
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
    this.time += dt
    this.draw()
  }

  /** prefers-reduced-motion: 애니메이션 없이 정착된 한 프레임 */
  private settle(): void {
    for (let i = 0; i < 260; i++) this.sim.step(SIM_DT)
  }

  private draw(): void {
    const sx = this.canvas.width / LOGICAL_W
    const sy = this.canvas.height / this.layout.H
    this.ctx.setTransform(sx, 0, 0, sy, 0, 0)
    this.ctx.imageSmoothingEnabled = false
    renderWorld({
      ctx: this.ctx,
      layout: this.layout,
      backdrop: this.backdrop,
      agents: this.sim.list(),
      entryById: this.entryById,
      bubbles: this.reduced ? [] : this.bubbles.list(),
      particles: this.reduced ? [] : this.effects.list(),
      focusId: this.focusId,
      groomName: wedding.groom.name,
      brideName: wedding.bride.name,
      time: this.reduced ? 0 : this.time,
      fontReady: this.fontReady,
      fallback: this.fallback,
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
    const unit = r.width / LOGICAL_W
    return { x: (clientX - r.left) / unit, y: (clientY - r.top) / unit }
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.tracking = true
    this.downX = e.clientX
    this.downY = e.clientY
    this.downT = performance.now()
  }

  private onPointerCancel = (): void => {
    this.tracking = false
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.tracking) return
    this.tracking = false
    const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY)
    const dur = performance.now() - this.downT
    if (moved > 10 || dur > 600) return // 스크롤/롱프레스 → 탭 아님
    const { x, y } = this.toLogical(e.clientX, e.clientY)
    this.handleTap(x, y)
  }

  private handleTap(lx: number, ly: number): void {
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

  /** 발 기준 스프라이트 박스로 히트테스트. 앞(큰 y)부터 우선 */
  private pickAgent(lx: number, ly: number) {
    const agents = this.sim.list()
    let best: { id: string; y: number } | null = null
    for (const a of agents) {
      if (a.life === 'despawn') continue
      const withinX = Math.abs(lx - a.x) <= 8
      const withinY = ly <= a.y + 2 && ly >= a.y - SPRITE_H - 2
      if (withinX && withinY && (!best || a.y > best.y)) best = { id: a.id, y: a.y }
    }
    return best
  }

  private scrollToAgent(id: string): void {
    const a = this.sim.list().find((g) => g.id === id)
    if (!a) return
    const r = this.canvas.getBoundingClientRect()
    const unit = r.width / LOGICAL_W
    const screenY = r.top + window.scrollY + a.y * unit
    const target = screenY - window.innerHeight / 2
    if (r.height <= window.innerHeight + 40) return // 이미 다 보임
    window.scrollTo({ top: Math.max(0, target), behavior: this.reduced ? 'auto' : 'smooth' })
  }
}

export function WorldCanvas({ entries, focusId, onSelect, className }: WorldCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<WorldEngine | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const engine = new WorldEngine(canvas, wrap)
    engineRef.current = engine
    engine.start()
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setEntries(entries)
  }, [entries])

  useEffect(() => {
    engineRef.current?.setFocus(focusId ?? null)
  }, [focusId])

  useEffect(() => {
    engineRef.current?.setOnSelect(onSelect)
  }, [onSelect])

  return (
    <div ref={wrapRef} className={`world-canvas-wrap${className ? ` ${className}` : ''}`}>
      <canvas ref={canvasRef} className="world-canvas" />
    </div>
  )
}
