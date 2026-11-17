import { describe, it, expect } from 'vitest'
import { preferredCalendarTargetFor } from './calendar.ts'

describe('preferredCalendarTargetFor', () => {
  it('Android 는 google 추천', () => {
    expect(
      preferredCalendarTargetFor(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('google')
  })
  it('iPhone 은 device 추천', () => {
    expect(
      preferredCalendarTargetFor(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('device')
  })
  it('macOS/데스크톱은 device 추천', () => {
    expect(
      preferredCalendarTargetFor(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      ),
    ).toBe('device')
    expect(preferredCalendarTargetFor('')).toBe('device')
  })
})
