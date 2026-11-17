// web/src/lib/ics.test.ts 를 그대로 옮긴 테스트 (서버 포팅본이 프론트와 같은 결과를 내는지 확인)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIcs, weddingEvent } from '../src/ics.js'
import { validConfig } from './helpers.js'

const wedding = validConfig()

/** @param {string} s 테스트용 UTF-8 바이트 길이 */
function utf8ByteLength(s) {
  return Buffer.byteLength(s, 'utf8')
}

const ev = {
  title: '김신랑 ♥ 박신부 결혼식',
  description: '김신랑 ♥ 박신부의 결혼식에 초대합니다.',
  location: '예시웨딩홀 3층 그랜드홀, 서울특별시 중구 세종대로 110',
  start: new Date('2027-05-15T12:30:00+09:00'),
  end: new Date('2027-05-15T14:00:00+09:00'),
  url: 'https://our.wedding/w/our-wedding',
}

test('weddingEvent: 설정값에서 제목/장소/시간을 구성한다', () => {
  const e = weddingEvent(wedding, 'https://our.wedding/w/our-wedding')
  assert.equal(e.title, '김신랑 ♥ 박신부 결혼식')
  assert.equal(e.location, '예시웨딩홀 3층 그랜드홀, 서울특별시 중구 세종대로 110')
  // 12:30 KST = 03:30 UTC, +90분 → 05:00 UTC
  assert.equal(e.start.toISOString(), '2027-05-15T03:30:00.000Z')
  assert.equal(e.end.toISOString(), '2027-05-15T05:00:00.000Z')
  assert.equal(e.url, 'https://our.wedding/w/our-wedding')
  assert.ok(e.description?.includes('https://our.wedding/w/our-wedding'))
})

test('weddingEvent: siteUrl 이 없으면 url 과 링크가 포함되지 않는다', () => {
  const e = weddingEvent(wedding)
  assert.equal(e.url, undefined)
  assert.ok(!e.description?.includes('http'))
})

test('buildIcs: UTC 시각으로 DTSTART/DTEND 를 출력한다 (KST→UTC)', () => {
  const ics = buildIcs(ev)
  assert.ok(ics.includes('DTSTART:20270515T033000Z'))
  assert.ok(ics.includes('DTEND:20270515T050000Z'))
})

test('buildIcs: CRLF 줄바꿈만 사용하고 VCALENDAR 로 시작한다', () => {
  const ics = buildIcs(ev)
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
  assert.equal(ics.match(/(?<!\r)\n/), null) // \r 없는 단독 \n 이 없어야 한다
})

test('buildIcs: 필수 RFC 5545 속성과 1일 전 VALARM 을 포함한다', () => {
  const ics = buildIcs(ev)
  for (const token of ['VERSION:2.0', 'UID:', 'DTSTAMP:', 'SUMMARY:', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1D', 'END:VALARM']) {
    assert.ok(ics.includes(token), token)
  }
})

test('buildIcs: 텍스트 특수문자를 이스케이프한다 (\\ ; , 개행)', () => {
  const ics = buildIcs({ ...ev, title: 'A,B;C\\D\nE', description: undefined, location: undefined, url: undefined })
  assert.ok(ics.includes('SUMMARY:A\\,B\\;C\\\\D\\nE'))
})

test('buildIcs: 75 옥텟 폴딩 — 한글을 쪼개지 않고, 접은 뒤 복원하면 원본과 같다', () => {
  const longDesc = '하'.repeat(80) // 각 3바이트
  const ics = buildIcs({ ...ev, description: longDesc })
  for (const line of ics.split('\r\n')) {
    if (line === '') continue
    assert.ok(utf8ByteLength(line) <= 75, `line too long: ${utf8ByteLength(line)}`)
  }
  assert.ok(ics.includes('\r\n '))
  const unfolded = ics.replace(/\r\n /g, '')
  const descLine = unfolded.split('\r\n').find((l) => l.startsWith('DESCRIPTION:'))
  assert.equal(descLine, `DESCRIPTION:${longDesc}`)
  // 접힌 결과가 깨지지 않은 UTF-8 인지 (바이트로 바꿨다 되돌려도 동일)
  assert.equal(Buffer.from(ics, 'utf8').toString('utf8'), ics)
})

test('buildIcs: 결정적 — 같은 일정은 항상 같은 문자열, UID/DTSTAMP 도 고정', () => {
  assert.equal(buildIcs(ev), buildIcs(ev))
  const a = buildIcs(weddingEvent(wedding, 'https://x.example/'))
  const b = buildIcs(weddingEvent(wedding, 'https://x.example/'))
  assert.equal(a, b)
  assert.ok(a.includes('DTSTAMP:20270515T033000Z'))
  // 프론트(web/src/lib/ics.ts)와 같은 UID 규칙: FNV-1a(title|location|dtstart)-dtstart@wedding.invitation
  assert.match(a, /\r\nUID:[0-9a-f]{8}-20270515T033000Z@wedding\.invitation\r\n/)
})
