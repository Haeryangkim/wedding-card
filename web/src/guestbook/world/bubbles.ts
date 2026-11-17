/**
 * 말풍선 큐 + 타자기 효과 상태 — 하객 메시지를 셔플 순서로 자동 순환하며,
 * 탭/포커스 시 즉시 표시. 표현 레이어라 실시간(dt) 기준으로 동작. (world 내부 전용)
 */

export interface BubbleEntry {
  id: string
  message: string
}

export interface ActiveBubble {
  id: string
  text: string
  /** 공개된 글자 수(타자기) */
  shown: number
  phase: 'in' | 'typing' | 'hold' | 'out'
  /** 현재 phase 경과(초) */
  t: number
  /** 등장/퇴장 애니메이션 0..1 */
  pop: number
}

const MAX_CHARS = 46
const TYPE_CPS = 26 // 초당 글자
const HOLD_BASE = 1.6
const HOLD_PER_CHAR = 0.055
const IN_TIME = 0.16
const OUT_TIME = 0.22
const MAX_ACTIVE = 2
const GAP_MIN = 0.4
const GAP_MAX = 1.6

function clampText(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= MAX_CHARS) return t
  return t.slice(0, MAX_CHARS - 1) + '…'
}

export class BubbleManager {
  private active: ActiveBubble[] = []
  private queue: string[] = []
  private gap = 0.3
  private readonly rand: () => number
  /** 자동 순환으로 동시에 띄우는 말풍선 수 (탭/포커스로 띄운 것은 MAX_ACTIVE 까지) */
  private readonly autoMax: number

  constructor(rand: () => number = Math.random, autoMax: number = MAX_ACTIVE) {
    this.rand = rand
    this.autoMax = Math.max(0, Math.min(MAX_ACTIVE, autoMax))
  }

  private shuffle(ids: string[]): string[] {
    const a = ids.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  /** 탭/포커스 시 즉시 표시(이미 있으면 유지) */
  showNow(entry: BubbleEntry): void {
    if (this.active.some((b) => b.id === entry.id)) return
    if (this.active.length >= MAX_ACTIVE) {
      // 가장 오래된 비포커스 말풍선을 내보냄
      const victim = this.active.shift()
      if (victim) victim.phase = 'out'
    }
    this.active.push({ id: entry.id, text: clampText(entry.message), shown: 0, phase: 'in', t: 0, pop: 0 })
  }

  /** dt(초)만큼 진행. pool = 현재 표시 가능한 하객 목록 */
  update(dt: number, pool: BubbleEntry[]): void {
    const byId = new Map(pool.map((e) => [e.id, e]))

    // 진행 중 말풍선 갱신(풀에서 사라지면 즉시 퇴장)
    for (const b of this.active) {
      if (!byId.has(b.id) && b.phase !== 'out') {
        b.phase = 'out'
        b.t = 0
      }
      b.t += dt
      switch (b.phase) {
        case 'in':
          b.pop = Math.min(1, b.t / IN_TIME)
          if (b.t >= IN_TIME) {
            b.phase = 'typing'
            b.t = 0
            b.pop = 1
          }
          break
        case 'typing': {
          b.shown = Math.floor(b.t * TYPE_CPS)
          if (b.shown >= b.text.length) {
            b.shown = b.text.length
            b.phase = 'hold'
            b.t = 0
          }
          break
        }
        case 'hold':
          if (b.t >= HOLD_BASE + b.text.length * HOLD_PER_CHAR) {
            b.phase = 'out'
            b.t = 0
          }
          break
        case 'out':
          b.pop = Math.max(0, 1 - b.t / OUT_TIME)
          break
      }
    }
    this.active = this.active.filter((b) => !(b.phase === 'out' && b.t >= OUT_TIME))

    // 비포커스 자동 순환: 간격을 두고 큐에서 다음 하객
    if (this.active.length < this.autoMax) {
      this.gap -= dt
      if (this.gap <= 0) {
        const next = this.takeNext(pool)
        if (next) {
          this.active.push({ id: next.id, text: clampText(next.message), shown: 0, phase: 'in', t: 0, pop: 0 })
          this.gap = GAP_MIN + this.rand() * (GAP_MAX - GAP_MIN)
        } else {
          this.gap = 0.5
        }
      }
    }
  }

  private takeNext(pool: BubbleEntry[]): BubbleEntry | undefined {
    const activeIds = new Set(this.active.map((b) => b.id))
    for (let guard = 0; guard < pool.length + 1; guard++) {
      if (this.queue.length === 0) {
        this.queue = this.shuffle(pool.filter((e) => e.message.trim().length > 0).map((e) => e.id))
        if (this.queue.length === 0) return undefined
      }
      const id = this.queue.shift()
      if (id === undefined) return undefined
      if (activeIds.has(id)) continue
      const entry = pool.find((e) => e.id === id)
      if (entry && entry.message.trim().length > 0) return entry
    }
    return undefined
  }

  list(): ActiveBubble[] {
    return this.active
  }

  has(id: string): boolean {
    return this.active.some((b) => b.id === id)
  }
}
