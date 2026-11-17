import { describe, it, expect } from 'vitest'
import { scrollTopForAgent } from './scroll.ts'

describe('scrollTopForAgent', () => {
  it('캐릭터가 화면 안에 있으면 스크롤하지 않는다', () => {
    expect(scrollTopForAgent(400, 1200, 800)).toBeNull()
  })

  it('캔버스가 화면보다 짧아도, 화면 밖(위)으로 벗어나 있으면 스크롤한다', () => {
    // 캐릭터가 뷰포트 위 600px → 문서 Y 1400 을 화면 중앙으로
    expect(scrollTopForAgent(-600, 2000, 800)).toBe(1000)
  })

  it('화면 아래에 있으면 아래로 스크롤한다', () => {
    expect(scrollTopForAgent(1500, 300, 800)).toBe(1400)
  })

  it('화면 가장자리 여백 안이면 스크롤하고, 결과는 0 미만이 되지 않는다', () => {
    expect(scrollTopForAgent(10, 100, 800)).toBe(0)
    expect(scrollTopForAgent(790, 0, 800)).toBe(390)
  })
})
