import { describe, it, expect, afterEach, vi } from 'vitest'
import { countdown } from './date.ts'

const target = new Date('2027-05-15T12:30:00+09:00')
const at = (iso: string): number => new Date(iso).getTime()

describe('countdown.totalDays (KST 달력 기준 D-day)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('예식 당일 아침은 0일 (남은 시간 카운터는 그대로)', () => {
    const cd = countdown(target, at('2027-05-15T09:00:00+09:00'))
    expect(cd.done).toBe(false)
    expect(cd.totalDays).toBe(0)
    expect([cd.days, cd.hours, cd.minutes, cd.seconds]).toEqual([0, 3, 30, 0])
  })

  it('전날은 시각과 무관하게 1일', () => {
    expect(countdown(target, at('2027-05-14T10:00:00+09:00')).totalDays).toBe(1)
    expect(countdown(target, at('2027-05-14T23:59:00+09:00')).totalDays).toBe(1)
    expect(countdown(target, at('2027-05-14T00:00:00+09:00')).totalDays).toBe(1)
  })

  it('이틀 전 밤은 2일, 한 달 전은 달을 넘겨 계산', () => {
    expect(countdown(target, at('2027-05-13T23:59:59+09:00')).totalDays).toBe(2)
    expect(countdown(target, at('2027-04-15T18:00:00+09:00')).totalDays).toBe(30)
  })

  it('기기 시간대가 KST 가 아니어도 한국 날짜 기준', () => {
    for (const tz of ['America/Los_Angeles', 'Pacific/Kiritimati', 'UTC']) {
      vi.stubEnv('TZ', tz)
      expect(countdown(target, at('2027-05-15T09:00:00+09:00')).totalDays).toBe(0)
      expect(countdown(target, at('2027-05-14T10:00:00+09:00')).totalDays).toBe(1)
    }
  })

  it('예식 시작 이후는 done', () => {
    const cd = countdown(target, at('2027-05-15T12:30:00+09:00'))
    expect(cd.done).toBe(true)
    expect(cd.totalDays).toBe(0)
  })
})
