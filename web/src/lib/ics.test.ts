import { describe, it, expect } from 'vitest'
import type { CalendarEvent } from './ics.ts'
import { buildIcs, googleCalendarUrl, weddingEvent } from './ics.ts'
import { wedding } from '../config/wedding.ts'

/** 테스트용 UTF-8 바이트 길이 */
function utf8ByteLength(s: string): number {
  let n = 0
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0
    n += cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4
  }
  return n
}

const ev: CalendarEvent = {
  title: '김신랑 ♥ 박신부 결혼식',
  description: '김신랑 ♥ 박신부의 결혼식에 초대합니다.',
  location: '예시웨딩홀 3층 그랜드홀, 서울특별시 중구 세종대로 110',
  start: new Date('2027-05-15T12:30:00+09:00'),
  end: new Date('2027-05-15T14:00:00+09:00'),
  url: 'https://haeryangkim.github.io/wedding-card/',
}

describe('weddingEvent', () => {
  it('설정값에서 제목/장소/시간을 구성한다', () => {
    const e = weddingEvent(wedding, 'https://haeryangkim.github.io/wedding-card/')
    expect(e.title).toBe('김신랑 ♥ 박신부 결혼식')
    expect(e.location).toBe('예시웨딩홀 3층 그랜드홀, 서울특별시 중구 세종대로 110')
    // 12:30 KST = 03:30 UTC, +90분 → 05:00 UTC
    expect(e.start.toISOString()).toBe('2027-05-15T03:30:00.000Z')
    expect(e.end.toISOString()).toBe('2027-05-15T05:00:00.000Z')
    expect(e.url).toBe('https://haeryangkim.github.io/wedding-card/')
    expect(e.description).toContain('https://haeryangkim.github.io/wedding-card/')
  })

  it('siteUrl 이 없으면 url 과 링크가 포함되지 않는다', () => {
    const e = weddingEvent(wedding)
    expect(e.url).toBeUndefined()
    expect(e.description).not.toContain('http')
  })
})

describe('buildIcs', () => {
  it('UTC 시각으로 DTSTART/DTEND 를 출력한다 (KST→UTC)', () => {
    const ics = buildIcs(ev)
    expect(ics).toContain('DTSTART:20270515T033000Z')
    expect(ics).toContain('DTEND:20270515T050000Z')
  })

  it('CRLF 줄바꿈만 사용하고 VCALENDAR 로 시작한다', () => {
    const ics = buildIcs(ev)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('\r\n')).toBe(true)
    // \r 없는 단독 \n 이 없어야 한다
    expect(ics.match(/(?<!\r)\n/)).toBeNull()
  })

  it('필수 RFC 5545 속성과 1일 전 VALARM 을 포함한다', () => {
    const ics = buildIcs(ev)
    for (const token of ['VERSION:2.0', 'UID:', 'DTSTAMP:', 'SUMMARY:', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1D', 'END:VALARM']) {
      expect(ics).toContain(token)
    }
  })

  it('텍스트 특수문자를 이스케이프한다 (\\ ; , 개행)', () => {
    const special: CalendarEvent = {
      ...ev,
      title: 'A,B;C\\D\nE',
      description: undefined,
      location: undefined,
      url: undefined,
    }
    const ics = buildIcs(special)
    expect(ics).toContain('SUMMARY:A\\,B\\;C\\\\D\\nE')
  })

  it('75 옥텟 폴딩 — 한글을 쪼개지 않고, 접은 뒤 복원하면 원본과 같다', () => {
    const longDesc = '하'.repeat(80) // 각 3바이트
    const e: CalendarEvent = { ...ev, description: longDesc }
    const ics = buildIcs(e)

    // 모든 물리 라인이 75 옥텟 이하
    for (const line of ics.split('\r\n')) {
      if (line === '') continue
      expect(utf8ByteLength(line)).toBeLessThanOrEqual(75)
    }
    // 실제로 접혔는지 (CRLF+SPACE 존재)
    expect(ics).toContain('\r\n ')

    // 언폴딩(‘\r\n ’ 제거) 후 DESCRIPTION 값이 원본과 동일 (멀티바이트 손상 없음)
    const unfolded = ics.replace(/\r\n /g, '')
    const descLine = unfolded.split('\r\n').find((l) => l.startsWith('DESCRIPTION:'))
    expect(descLine).toBe(`DESCRIPTION:${longDesc}`)
  })

  it('결정적(deterministic) — 같은 일정은 항상 같은 문자열, UID/DTSTAMP 도 고정', () => {
    expect(buildIcs(ev)).toBe(buildIcs(ev))
    const a = buildIcs(weddingEvent(wedding, 'https://x.example/'))
    const b = buildIcs(weddingEvent(wedding, 'https://x.example/'))
    expect(a).toBe(b)
    // DTSTAMP 가 시계가 아닌 일정에서 파생 → DTSTART 와 동일
    expect(a).toContain('DTSTAMP:20270515T033000Z')
  })
})

describe('googleCalendarUrl', () => {
  it('TEMPLATE 액션과 UTC dates, 인코딩된 값들을 포함한다', () => {
    const url = googleCalendarUrl(ev)
    expect(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE')).toBe(true)
    expect(url).toContain('dates=20270515T033000Z/20270515T050000Z')
    expect(url).toContain(`text=${encodeURIComponent(ev.title)}`)
    expect(url).toContain(`location=${encodeURIComponent(ev.location as string)}`)
    expect(url).toContain('details=')
    // 공백은 %20 로 인코딩 (원시 공백 없음)
    expect(url.includes(' ')).toBe(false)
  })
})
