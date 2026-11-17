import { describe, expect, it } from 'vitest'
import { TapTracker } from './tap'

describe('TapTracker', () => {
  it('짧고 움직임 없는 누름은 탭으로 기록되고 한 번만 꺼내진다', () => {
    const t = new TapTracker()
    t.down(100, 200, 0)
    t.up(103, 204, 120)
    expect(t.consume()).toEqual({ x: 103, y: 204 })
    expect(t.consume()).toBeNull()
  })

  it('pointerup 만으로는 아무것도 실행되지 않는다 (click 전에는 consume 하지 않음)', () => {
    const t = new TapTracker()
    t.down(0, 0, 0)
    t.up(0, 0, 10)
    // 다음 누름이 시작되면 이전에 남은 탭은 버린다
    t.down(50, 50, 1000)
    expect(t.consume()).toBeNull()
  })

  it('많이 움직였거나 길게 누르면 탭이 아니다', () => {
    const t = new TapTracker()
    t.down(0, 0, 0)
    t.up(11, 0, 100)
    expect(t.consume()).toBeNull()
    t.down(0, 0, 0)
    t.up(0, 0, 601)
    expect(t.consume()).toBeNull()
  })

  it('pointercancel(스크롤 시작) 뒤에는 탭이 없다', () => {
    const t = new TapTracker()
    t.down(0, 0, 0)
    t.cancel()
    t.up(0, 0, 50)
    expect(t.consume()).toBeNull()
  })

  it('pointerdown 없는 click(키보드·합성 클릭)은 무시된다', () => {
    const t = new TapTracker()
    expect(t.consume()).toBeNull()
    t.up(5, 5, 5)
    expect(t.consume()).toBeNull()
  })
})
