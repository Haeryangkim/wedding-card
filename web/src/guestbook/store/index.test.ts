import { describe, it, expect, beforeEach } from 'vitest'
import { getStore, resetStore } from './index'

describe('getStore', () => {
  beforeEach(() => resetStore())

  it('데모는 LocalStore, 실제 청첩장은 ApiStore', () => {
    expect(getStore('demo', true).mode).toBe('local')
    expect(getStore('our-day', false).mode).toBe('api')
  })

  it('같은 청첩장은 같은 인스턴스, 다른 청첩장은 다른 인스턴스', () => {
    const a = getStore('our-day', false)
    expect(getStore('our-day', false)).toBe(a)
    expect(getStore('other-day', false)).not.toBe(a)
  })
})
