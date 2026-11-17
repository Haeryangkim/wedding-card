/**
 * 하객 군중 시뮬레이션 코어 — DOM 없이 결정적으로 동작.
 * 같은 시드 + 같은 id 집합이면 항상 같은 궤적을 재현합니다(렌더링과 분리, 단위테스트 대상).
 * (world 내부 전용)
 */
import type { Dir } from '../character'
import {
  ARRIVE_DIST,
  DESPAWN_TIME,
  IDLE_MAX,
  IDLE_MIN,
  SEPARATION_FORCE,
  SPAWN_FALL_TIME,
  SPEED_MAX,
  SPEED_MIN,
  WALK_MAX,
  WALK_MIN,
} from './constants'
import type { WorldLayout } from './layout'
import { hashString, mixSeed, mulberry32, randRange, type Rand } from './rng'

export type AgentLife = 'spawn' | 'alive' | 'despawn'
export type AgentState = 'idle' | 'walk'

export interface Agent {
  id: string
  /** 발(바닥 접점) 좌표 — y정렬·분리 기준 */
  x: number
  y: number
  vx: number
  vy: number
  dir: Dir
  moving: boolean
  /** 걷기 애니메이션 위상(이동 거리 누적) */
  walkPhase: number
  /** 제자리 흔들림용 위상(캐릭터마다 고정 오프셋) */
  bobPhase: number
  state: AgentState
  stateTime: number
  tx: number
  ty: number
  speed: number
  /** 빈 바닥 탭 시 깡총 뛰는 반응(1→0 감쇠) */
  hop: number
  life: AgentLife
  /** 등장/퇴장 진행도 0..1 */
  anim: number
  /** 몸집 배수(그림체별) — 이웃 분리 반경에 곱해진다. 기본 1 */
  size: number
  rng: Rand
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 몸집 배수의 상한 (공간 해시 칸 크기를 정한다) */
export const MAX_AGENT_SIZE = 1.3

/** 신랑·신부/장식을 피하는 회피점 목록 */
interface AvoidPoint {
  x: number
  y: number
  r: number
}

export class Simulation {
  layout: WorldLayout
  readonly seed: number
  readonly agents = new Map<string, Agent>()
  private avoid: AvoidPoint[] = []

  constructor(layout: WorldLayout, seed = 0x51b7) {
    this.layout = layout
    this.seed = seed >>> 0
    this.rebuildAvoid()
  }

  private rebuildAvoid(): void {
    const L = this.layout
    const pts: AvoidPoint[] = [
      { x: L.groomX, y: L.coupleY, r: L.coupleAvoid },
      { x: L.brideX, y: L.coupleY, r: L.coupleAvoid },
    ]
    for (const d of L.decor) pts.push({ x: d.x, y: d.y, r: d.avoid })
    this.avoid = pts
  }

  /** 레이아웃(하객 수에 따른 바닥 크기)이 바뀌면 경계 안으로 재배치 */
  setLayout(layout: WorldLayout): void {
    this.layout = layout
    this.rebuildAvoid()
    const w = layout.walk
    for (const a of this.agents.values()) {
      a.x = clamp(a.x, w.minX, w.maxX)
      a.y = clamp(a.y, w.minY, w.maxY)
      a.tx = clamp(a.tx, w.minX, w.maxX)
      a.ty = clamp(a.ty, w.minY, w.maxY)
    }
  }

  /**
   * 하객 id 집합 동기화: 새 id는 등장, 사라진 id는 퇴장 시작.
   * sizeOf 를 넘기면 하객별 몸집 배수(그림체에 따라 다름)를 맞춘다.
   */
  sync(ids: string[], sizeOf?: (id: string) => number): void {
    const next = new Set(ids)
    for (const a of this.agents.values()) {
      if (!next.has(a.id) && a.life !== 'despawn') {
        a.life = 'despawn'
        a.anim = 0
      }
    }
    for (const id of ids) {
      const existing = this.agents.get(id)
      if (!existing) {
        this.agents.set(id, this.spawn(id))
      } else if (existing.life === 'despawn') {
        // 다시 추가된 경우 되살림
        existing.life = 'alive'
        existing.anim = 1
      }
    }
    if (sizeOf) {
      for (const id of ids) {
        const a = this.agents.get(id)
        if (a) a.size = clamp(sizeOf(id), 0.5, MAX_AGENT_SIZE)
      }
    }
  }

  /** id로부터 결정적으로 성격·시작 위치가 정해지는 에이전트 생성 */
  private spawn(id: string): Agent {
    const seed = mixSeed(this.seed, hashString(id))
    const rng = mulberry32(seed)
    const w = this.layout.walk
    // 장애물에 겹치지 않는 시작점
    let x = randRange(rng, w.minX, w.maxX)
    let y = randRange(rng, w.minY, w.maxY)
    for (let i = 0; i < 8; i++) {
      if (!this.inAvoid(x, y, 2)) break
      x = randRange(rng, w.minX, w.maxX)
      y = randRange(rng, w.minY, w.maxY)
    }
    const speed = randRange(rng, SPEED_MIN, SPEED_MAX)
    const bobPhase = rng() * Math.PI * 2
    const a: Agent = {
      id,
      x,
      y,
      vx: 0,
      vy: 0,
      dir: 'down',
      moving: false,
      walkPhase: rng() * 10,
      bobPhase,
      state: 'idle',
      stateTime: randRange(rng, IDLE_MIN, IDLE_MAX),
      tx: x,
      ty: y,
      speed,
      hop: 0,
      life: 'spawn',
      anim: 0,
      size: 1,
      rng,
    }
    return a
  }

  private inAvoid(x: number, y: number, pad: number): boolean {
    for (const p of this.avoid) {
      const dx = x - p.x
      const dy = y - p.y
      const r = p.r + pad
      if (dx * dx + dy * dy < r * r) return true
    }
    return false
  }

  private pickTarget(a: Agent): void {
    const w = this.layout.walk
    const r = a.rng
    // 가끔 바닥 전역의 임의 지점을 골라 전체적으로 고르게 퍼지도록 한다
    const global = r() < 0.3
    let tx = a.x
    let ty = a.y
    for (let i = 0; i < 6; i++) {
      if (global) {
        tx = randRange(r, w.minX, w.maxX)
        ty = randRange(r, w.minY, w.maxY)
      } else {
        const ang = r() * Math.PI * 2
        const dist = randRange(r, 16, 58)
        tx = clamp(a.x + Math.cos(ang) * dist, w.minX, w.maxX)
        ty = clamp(a.y + Math.sin(ang) * dist, w.minY, w.maxY)
      }
      if (!this.inAvoid(tx, ty, 3)) break
    }
    a.tx = tx
    a.ty = ty
  }

  /** 고정 타임스텝으로 한 스텝 전진 */
  step(dt: number): void {
    const w = this.layout.walk
    const list = [...this.agents.values()]

    // 공간 해시(이웃 분리용) — 살아있는/등장 중 에이전트만
    const sepR = this.layout.separation
    const cell = sepR * MAX_AGENT_SIZE
    const grid = new Map<number, Agent[]>()
    const key = (cx: number, cy: number) => (cx + 4096) * 100000 + (cy + 4096)
    for (const a of list) {
      if (a.life === 'despawn') continue
      const cx = Math.floor(a.x / cell)
      const cy = Math.floor(a.y / cell)
      const k = key(cx, cy)
      const bucket = grid.get(k)
      if (bucket) bucket.push(a)
      else grid.set(k, [a])
    }

    // 1단계: 속도 계산(현재 위치 스냅샷 기준 → 순서 무관·결정적)
    for (const a of list) {
      // 등장/퇴장 애니메이션 진행
      if (a.life === 'spawn') {
        a.anim += dt / SPAWN_FALL_TIME
        if (a.anim >= 1) {
          a.anim = 1
          a.life = 'alive'
        }
        a.vx = 0
        a.vy = 0
        a.moving = false
        continue
      }
      if (a.life === 'despawn') {
        a.anim += dt / DESPAWN_TIME
        a.vx = 0
        a.vy = 0
        a.moving = false
        continue
      }

      // 상태 머신
      a.stateTime -= dt
      if (a.stateTime <= 0) {
        if (a.state === 'idle') {
          a.state = 'walk'
          a.stateTime = randRange(a.rng, WALK_MIN, WALK_MAX)
          this.pickTarget(a)
        } else {
          a.state = 'idle'
          a.stateTime = randRange(a.rng, IDLE_MIN, IDLE_MAX)
        }
      }

      let dvx = 0
      let dvy = 0
      if (a.state === 'walk') {
        const dx = a.tx - a.x
        const dy = a.ty - a.y
        const d = Math.hypot(dx, dy)
        if (d <= ARRIVE_DIST) {
          a.state = 'idle'
          a.stateTime = randRange(a.rng, IDLE_MIN, IDLE_MAX)
        } else {
          dvx = (dx / d) * a.speed
          dvy = (dy / d) * a.speed
        }
      }

      // 이웃 분리
      let sx = 0
      let sy = 0
      const cx = Math.floor(a.x / cell)
      const cy = Math.floor(a.y / cell)
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = grid.get(key(gx, gy))
          if (!bucket) continue
          for (const b of bucket) {
            if (b === a) continue
            const dx = a.x - b.x
            const dy = a.y - b.y
            const d2 = dx * dx + dy * dy
            const r = sepR * (a.size + b.size) * 0.5
            if (d2 > 0 && d2 < r * r) {
              const d = Math.sqrt(d2)
              const f = (1 - d / r) / d
              sx += dx * f
              sy += dy * f
            }
          }
        }
      }
      dvx += sx * SEPARATION_FORCE
      dvy += sy * SEPARATION_FORCE

      // 장애물(신랑·신부/장식) 회피
      for (const p of this.avoid) {
        const dx = a.x - p.x
        const dy = a.y - p.y
        const d = Math.hypot(dx, dy)
        if (d < p.r && d > 0.001) {
          const f = ((p.r - d) / p.r) * SEPARATION_FORCE * 1.4
          dvx += (dx / d) * f
          dvy += (dy / d) * f
        }
      }

      a.vx = dvx
      a.vy = dvy
    }

    // 2단계: 적분 + 경계 클램프 + 방향/프레임
    for (const a of list) {
      if (a.life === 'despawn') {
        if (a.anim >= 1) this.agents.delete(a.id)
        continue
      }
      if (a.life === 'spawn') continue

      a.x = clamp(a.x + a.vx * dt, w.minX, w.maxX)
      a.y = clamp(a.y + a.vy * dt, w.minY, w.maxY)

      const sp = Math.hypot(a.vx, a.vy)
      a.moving = sp > 2.5
      if (a.moving) {
        a.walkPhase += sp * dt
        if (Math.abs(a.vx) > Math.abs(a.vy) + 0.5) {
          a.dir = a.vx < 0 ? 'left' : 'right'
        } else {
          a.dir = a.vy < 0 ? 'up' : 'down'
        }
      }
      if (a.hop > 0) a.hop = Math.max(0, a.hop - dt * 3.2)
    }
  }

  /** 에이전트 배열(렌더용; 렌더러가 y정렬) */
  list(): Agent[] {
    return [...this.agents.values()]
  }
}
