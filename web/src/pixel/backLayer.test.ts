import { describe, expect, it } from 'vitest'
import { backSteps, layerDepthOf, shouldCloseOnPop } from './backLayer'

describe('layerDepthOf', () => {
  it('pxLayer 가 없거나 이상하면 0', () => {
    expect(layerDepthOf(null)).toBe(0)
    expect(layerDepthOf(undefined)).toBe(0)
    expect(layerDepthOf('x')).toBe(0)
    expect(layerDepthOf({})).toBe(0)
    expect(layerDepthOf({ pxLayer: true })).toBe(0)
    expect(layerDepthOf({ pxLayer: -1 })).toBe(0)
    expect(layerDepthOf({ pxLayer: 1.5 })).toBe(0)
  })
  it('기록된 깊이를 돌려준다', () => {
    expect(layerDepthOf({ pxLayer: 1 })).toBe(1)
    expect(layerDepthOf({ pxLayer: 2 })).toBe(2)
  })
})

describe('shouldCloseOnPop', () => {
  it('팝업(1)에서 뒤로 → 바닥 항목에 도착하면 팝업을 닫는다', () => {
    expect(shouldCloseOnPop(null, 1)).toBe(true)
  })
  it('사진 뷰어(2)에서 뒤로 → 뷰어만 닫히고 팝업은 남는다', () => {
    expect(shouldCloseOnPop({ pxLayer: 1 }, 2)).toBe(true)
    expect(shouldCloseOnPop({ pxLayer: 1 }, 1)).toBe(false)
  })
  it('같은 깊이의 항목에 도착하면 닫지 않는다', () => {
    expect(shouldCloseOnPop({ pxLayer: 2 }, 2)).toBe(false)
  })
})

describe('backSteps', () => {
  it('팝업을 화면에서 닫으면 한 칸', () => {
    expect(backSteps({ pxLayer: 1 }, 1)).toBe(1)
  })
  it('뷰어가 열린 채 팝업을 닫으면 두 칸', () => {
    expect(backSteps({ pxLayer: 2 }, 1)).toBe(2)
  })
  it('뷰어만 닫으면 한 칸', () => {
    expect(backSteps({ pxLayer: 2 }, 2)).toBe(1)
  })
  it('이미 우리 항목 위가 아니면 움직이지 않는다', () => {
    expect(backSteps(null, 1)).toBe(0)
    expect(backSteps({ pxLayer: 1 }, 2)).toBe(0)
  })
})
