import { describe, expect, it } from 'vitest'
import { computeLayout } from './layout'
import { Simulation } from './sim'
import { SIM_DT } from './constants'

function run(ids: string[], seed: number, steps: number): Simulation {
  const sim = new Simulation(computeLayout(ids.length), seed)
  sim.sync(ids)
  for (let i = 0; i < steps; i++) sim.step(SIM_DT)
  return sim
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `guest-${i}`)

describe('Simulation', () => {
  it('하객이 항상 걷기 경계 안에 머문다 (수천 스텝, NaN 없음)', () => {
    const layout = computeLayout(40)
    const sim = new Simulation(layout, 7)
    sim.sync(ids(40))
    const w = layout.walk
    for (let i = 0; i < 5000; i++) {
      sim.step(SIM_DT)
      for (const a of sim.list()) {
        expect(Number.isFinite(a.x)).toBe(true)
        expect(Number.isFinite(a.y)).toBe(true)
        expect(Number.isFinite(a.vx)).toBe(true)
        expect(Number.isFinite(a.vy)).toBe(true)
        expect(a.x).toBeGreaterThanOrEqual(w.minX - 1e-6)
        expect(a.x).toBeLessThanOrEqual(w.maxX + 1e-6)
        expect(a.y).toBeGreaterThanOrEqual(w.minY - 1e-6)
        expect(a.y).toBeLessThanOrEqual(w.maxY + 1e-6)
      }
    }
  })

  it('같은 시드 + 같은 id 면 동일하게 재현된다', () => {
    const a = run(ids(25), 123, 1500)
    const b = run(ids(25), 123, 1500)
    for (const ag of a.list()) {
      const bg = b.agents.get(ag.id)
      expect(bg).toBeDefined()
      expect(bg?.x).toBe(ag.x)
      expect(bg?.y).toBe(ag.y)
      expect(bg?.dir).toBe(ag.dir)
    }
  })

  it('id 추가 순서가 달라도 각 하객 궤적은 동일하다 (순서 무관)', () => {
    const forward = run(['a', 'b', 'c', 'd'], 55, 1200)
    const sim = new Simulation(computeLayout(4), 55)
    sim.sync(['d', 'c', 'b', 'a'])
    for (let i = 0; i < 1200; i++) sim.step(SIM_DT)
    for (const id of ['a', 'b', 'c', 'd']) {
      const f = forward.agents.get(id)
      const r = sim.agents.get(id)
      expect(f?.x).toBeCloseTo(r?.x ?? NaN, 9)
      expect(f?.y).toBeCloseTo(r?.y ?? NaN, 9)
    }
  })

  it('하객 시작 위치/성격은 id 로부터 결정된다', () => {
    const a = new Simulation(computeLayout(1), 9)
    a.sync(['solo'])
    const b = new Simulation(computeLayout(1), 9)
    b.sync(['solo'])
    const pa = a.agents.get('solo')
    const pb = b.agents.get('solo')
    expect(pa?.x).toBe(pb?.x)
    expect(pa?.y).toBe(pb?.y)
    expect(pa?.speed).toBe(pb?.speed)
  })

  it('id 집합 동기화로 추가·삭제가 처리된다', () => {
    const sim = new Simulation(computeLayout(3), 1)
    sim.sync(['a', 'b', 'c'])
    expect(sim.agents.size).toBe(3)
    // 정착
    for (let i = 0; i < 120; i++) sim.step(SIM_DT)
    // b 제거 → despawn 표시 후 일정 스텝 뒤 삭제
    sim.sync(['a', 'c'])
    expect(sim.agents.get('b')?.life).toBe('despawn')
    for (let i = 0; i < 60; i++) sim.step(SIM_DT)
    expect(sim.agents.has('b')).toBe(false)
    expect(sim.agents.size).toBe(2)
    // 새 id 추가 → 등장
    sim.sync(['a', 'c', 'z'])
    expect(sim.agents.get('z')?.life).toBe('spawn')
  })

  it('레이아웃 변경 시 기존 하객을 새 경계로 클램프한다', () => {
    const sim = new Simulation(computeLayout(150), 3)
    sim.sync(ids(150))
    for (let i = 0; i < 300; i++) sim.step(SIM_DT)
    const small = computeLayout(2)
    sim.setLayout(small)
    for (const a of sim.list()) {
      expect(a.x).toBeGreaterThanOrEqual(small.walk.minX)
      expect(a.x).toBeLessThanOrEqual(small.walk.maxX)
      expect(a.y).toBeGreaterThanOrEqual(small.walk.minY)
      expect(a.y).toBeLessThanOrEqual(small.walk.maxY)
    }
  })
})
