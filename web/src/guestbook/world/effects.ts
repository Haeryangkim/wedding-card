/**
 * 파티클 효과(하트·반짝이) — 빈 바닥 탭 시 하트, 드롭인 시 반짝임.
 * 데이터는 DOM 없이 dt로 갱신, 렌더러가 그림. (world 내부 전용)
 */
export type ParticleKind = 'heart' | 'sparkle'

export interface Particle {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  sway: number
}

export class Effects {
  private particles: Particle[] = []
  private readonly rand: () => number

  constructor(rand: () => number = Math.random) {
    this.rand = rand
  }

  spawnHearts(x: number, y: number, count = 5): void {
    for (let i = 0; i < count; i++) {
      const maxLife = 0.8 + this.rand() * 0.5
      this.particles.push({
        kind: 'heart',
        x: x + (this.rand() - 0.5) * 8,
        y: y - this.rand() * 4,
        vx: (this.rand() - 0.5) * 10,
        vy: -16 - this.rand() * 14,
        life: maxLife,
        maxLife,
        size: 1 + Math.round(this.rand() * 1),
        sway: this.rand() * Math.PI * 2,
      })
    }
  }

  spawnSparkle(x: number, y: number, count = 6): void {
    for (let i = 0; i < count; i++) {
      const maxLife = 0.4 + this.rand() * 0.4
      const ang = this.rand() * Math.PI * 2
      const sp = 6 + this.rand() * 14
      this.particles.push({
        kind: 'sparkle',
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 6,
        life: maxLife,
        maxLife,
        size: 1,
        sway: this.rand() * Math.PI * 2,
      })
    }
  }

  update(dt: number): void {
    const arr = this.particles
    for (const p of arr) {
      p.life -= dt
      p.sway += dt * 6
      p.x += (p.vx + (p.kind === 'heart' ? Math.sin(p.sway) * 6 : 0)) * dt
      p.y += p.vy * dt
      p.vy += (p.kind === 'heart' ? 7 : 26) * dt // 하트는 천천히, 반짝이는 살짝 중력
    }
    this.particles = arr.filter((p) => p.life > 0)
  }

  list(): Particle[] {
    return this.particles
  }

  get count(): number {
    return this.particles.length
  }
}
