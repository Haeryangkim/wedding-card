import { describe, expect, it } from 'vitest'
import { computeLayout, computeStageLayout, stageCapacity, STAGE_MAX_GUESTS } from './layout'
import { SEPARATION_RADIUS, SIM_DT } from './constants'
import { Simulation } from './sim'

describe('computeLayout (embed)', () => {
  it('하객 수만큼 바닥이 길어지고, 벽은 맨 위에서 시작한다', () => {
    const small = computeLayout(2)
    const big = computeLayout(120)
    expect(big.H).toBeGreaterThan(small.H)
    expect(small.wallTop).toBe(0)
    expect(small.separation).toBe(SEPARATION_RADIUS)
  })
})

describe('computeStageLayout', () => {
  const spec = { W: 195, H: 422, insetTop: 34, insetBottom: 52 }

  it('장면 크기는 하객 수와 무관하게 컨테이너로 정해진다', () => {
    const a = computeStageLayout(spec, 0)
    const b = computeStageLayout(spec, 60)
    expect([a.W, a.H]).toEqual([195, 422])
    expect([b.W, b.H]).toEqual([195, 422])
    expect(b.walk).toEqual(a.walk)
  })

  it('HUD 안쪽에 놓인다: 벽은 위 HUD 아래에서 시작하고 걷기 영역은 아래 HUD 위에서 끝난다', () => {
    const l = computeStageLayout(spec, 10)
    expect(l.wallTop).toBe(34)
    expect(l.coupleY).toBeGreaterThan(34 + 36)
    expect(l.walk.maxY).toBeLessThanOrEqual(422 - 52)
    expect(l.walk.minY).toBeLessThan(l.walk.maxY)
  })

  it('하객이 많으면 간격을 줄인다 (하한 있음)', () => {
    expect(computeStageLayout(spec, 3).separation).toBe(SEPARATION_RADIUS)
    const crowded = computeStageLayout(spec, 60).separation
    expect(crowded).toBeLessThan(SEPARATION_RADIUS)
    expect(crowded).toBeGreaterThanOrEqual(10)
  })

  it('아주 낮은 화면에서도 걷기 영역이 뒤집히지 않는다', () => {
    const l = computeStageLayout({ W: 300, H: 120, insetTop: 40, insetBottom: 60 }, 5)
    expect(l.walk.maxY).toBeGreaterThan(l.walk.minY)
    expect(l.H).toBeGreaterThanOrEqual(l.walk.maxY)
  })

  it('정원: 화면이 클수록 많이, 상한은 STAGE_MAX_GUESTS', () => {
    const small = stageCapacity({ W: 180, H: 320, insetTop: 32, insetBottom: 48 })
    const large = stageCapacity({ W: 240, H: 700, insetTop: 32, insetBottom: 48 })
    expect(small).toBeGreaterThanOrEqual(8)
    expect(small).toBeLessThan(large)
    expect(large).toBe(STAGE_MAX_GUESTS)
  })

  it('스테이지 레이아웃에서도 하객은 걷기 경계 안에 머문다', () => {
    const layout = computeStageLayout(spec, 60)
    const sim = new Simulation(layout, 11)
    sim.sync(Array.from({ length: 60 }, (_, i) => `g${i}`))
    for (let i = 0; i < 1500; i++) sim.step(SIM_DT)
    for (const a of sim.list()) {
      expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true)
      expect(a.x).toBeGreaterThanOrEqual(layout.walk.minX - 1e-6)
      expect(a.x).toBeLessThanOrEqual(layout.walk.maxX + 1e-6)
      expect(a.y).toBeGreaterThanOrEqual(layout.walk.minY - 1e-6)
      expect(a.y).toBeLessThanOrEqual(layout.walk.maxY + 1e-6)
    }
  })
})
