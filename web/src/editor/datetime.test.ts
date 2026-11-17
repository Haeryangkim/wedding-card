import { describe, expect, it } from 'vitest'
import { fromKstIso, isRealDate, isRealTime, toKstIso } from './datetime'

/** 서버(server/src/wedding-config.js)의 형식 검사와 같은 정규식 */
const SERVER_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?\+09:00$/

describe('toKstIso', () => {
  it('입력한 숫자 그대로 +09:00 ISO 를 만든다', () => {
    expect(toKstIso('2027-05-15', '12:30')).toBe('2027-05-15T12:30:00+09:00')
    expect(toKstIso('2027-01-01', '00:00')).toBe('2027-01-01T00:00:00+09:00')
    // 일부 브라우저는 초까지 준다
    expect(toKstIso('2027-05-15', '12:30:00')).toBe('2027-05-15T12:30:00+09:00')
  })

  it('서버 형식을 만족하고 같은 순간을 가리킨다', () => {
    const iso = toKstIso('2027-05-15', '12:30')!
    expect(SERVER_RE.test(iso)).toBe(true)
    expect(new Date(iso).toISOString()).toBe('2027-05-15T03:30:00.000Z')
  })

  it('없는 날짜·시간·빈 값은 null', () => {
    expect(toKstIso('2027-02-30', '12:00')).toBeNull()
    expect(toKstIso('2027-13-01', '12:00')).toBeNull()
    expect(toKstIso('2027-05-15', '24:00')).toBeNull()
    expect(toKstIso('2027-05-15', '')).toBeNull()
    expect(toKstIso('', '12:00')).toBeNull()
    expect(toKstIso('27-5-15', '12:00')).toBeNull()
  })
})

describe('isRealDate / isRealTime', () => {
  it('윤년', () => {
    expect(isRealDate('2028-02-29')).toBe(true)
    expect(isRealDate('2027-02-29')).toBe(false)
  })
  it('시간 범위', () => {
    expect(isRealTime('23:59')).toBe(true)
    expect(isRealTime('12:60')).toBe(false)
    expect(isRealTime('9:00')).toBe(false)
  })
})

describe('fromKstIso', () => {
  it('+09:00 ISO 를 그대로 나눈다 (왕복)', () => {
    expect(fromKstIso('2027-05-15T12:30:00+09:00')).toEqual({ date: '2027-05-15', time: '12:30' })
    const parts = fromKstIso(toKstIso('2030-12-31', '23:05')!)!
    expect(toKstIso(parts.date, parts.time)).toBe('2030-12-31T23:05:00+09:00')
  })

  it('다른 오프셋은 한국 시간으로 환산', () => {
    expect(fromKstIso('2027-05-15T03:30:00Z')).toEqual({ date: '2027-05-15', time: '12:30' })
    expect(fromKstIso('2027-05-14T20:00:00-05:00')).toEqual({ date: '2027-05-15', time: '10:00' })
  })

  it('해석할 수 없으면 null', () => {
    expect(fromKstIso('')).toBeNull()
    expect(fromKstIso('내일')).toBeNull()
  })
})
