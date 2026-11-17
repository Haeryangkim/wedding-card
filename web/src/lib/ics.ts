/**
 * 캘린더 데이터 순수 함수 모음. 브라우저와 Node(vite.config.ts 빌드 플러그인) 양쪽에서 import 되므로
 * 이 파일은 DOM / window / import.meta.env 를 절대 참조하면 안 됩니다.
 * (계약: export 시그니처 변경 금지)
 */
import type { WeddingConfig } from '../config/wedding.ts'

export interface CalendarEvent {
  title: string
  description?: string
  location?: string
  start: Date
  end: Date
  /** 청첩장 URL (있으면 일정에 링크로 첨부) */
  url?: string
}

/** 청첩장 설정 → 캘린더 일정 */
export function weddingEvent(w: WeddingConfig, siteUrl?: string): CalendarEvent {
  const start = new Date(w.datetime)
  const end = new Date(start.getTime() + w.durationMinutes * 60_000)
  const title = `${w.groom.name} ♥ ${w.bride.name} 결혼식`
  // 홀·주소는 비어 있을 수 있다 → 빈 조각과 남는 쉼표가 생기지 않게 있는 것만 잇는다
  const place = [w.venue.name, w.venue.hall].map((s) => (s ?? '').trim()).filter(Boolean).join(' ')
  const location = [place, (w.venue.address ?? '').trim()].filter(Boolean).join(', ')
  const description = [
    `${w.groom.name} ♥ ${w.bride.name}의 결혼식에 초대합니다.`,
    place,
    ...(siteUrl ? [`청첩장 보기: ${siteUrl}`] : []),
  ].join('\n')
  return { title, description, location, start, end, url: siteUrl }
}

/** UTC 기준 iCalendar 날짜-시각 문자열(YYYYMMDDTHHMMSSZ). 한국은 DST 가 없어 UTC 변환이 정확합니다. */
function formatUtc(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

/** RFC 5545 텍스트 값 이스케이프(역슬래시 먼저). */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** 하나의 유니코드 코드포인트가 UTF-8 로 몇 바이트인지. */
function utf8Len(cp: number): number {
  if (cp <= 0x7f) return 1
  if (cp <= 0x7ff) return 2
  if (cp <= 0xffff) return 3
  return 4
}

/**
 * RFC 5545 라인 폴딩: 한 물리 라인이 75 옥텟을 넘지 않도록 CRLF+SPACE 로 접습니다.
 * 코드포인트 단위로 순회하므로 UTF-8 멀티바이트 문자(한글 등)를 중간에서 쪼개지 않습니다.
 */
function foldLine(line: string): string {
  let out = ''
  let octets = 0
  for (const ch of line) {
    const b = utf8Len(ch.codePointAt(0) ?? 0)
    if (octets + b > 75) {
      out += '\r\n '
      octets = 1 // 이어지는 라인 맨 앞의 SPACE 가 1 옥텟을 차지
    }
    out += ch
    octets += b
  }
  return out
}

/** 결정적(deterministic) 32bit FNV-1a 해시 → 8자리 16진수. UID 안정화에 사용. */
function hash32(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * RFC 5545 VCALENDAR 문자열.
 * - CRLF 줄바꿈, UTC 시각, 텍스트 이스케이프, 75 옥텟 폴딩
 * - UID/DTSTAMP 는 일정 내용에서만 파생 → 빌드마다 동일한 결과(재현 가능)
 * - 1일 전 VALARM 포함
 */
export function buildIcs(ev: CalendarEvent): string {
  const dtStart = formatUtc(ev.start)
  const dtEnd = formatUtc(ev.end)
  // DTSTAMP 는 시계(now)가 아니라 일정에서 파생 → 재현 가능한 빌드
  const dtStamp = dtStart
  const uid = `${hash32(`${ev.title}|${ev.location ?? ''}|${dtStart}`)}-${dtStart}@wedding.invitation`

  const rows: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//wedding-card//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeText(ev.title)}`,
  ]
  if (ev.location) rows.push(`LOCATION:${escapeText(ev.location)}`)
  if (ev.description) rows.push(`DESCRIPTION:${escapeText(ev.description)}`)
  if (ev.url) rows.push(`URL:${escapeText(ev.url)}`)
  rows.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(ev.title)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  )

  return rows.map(foldLine).join('\r\n') + '\r\n'
}

/** 구글 캘린더 "일정 추가" 템플릿 URL (전부 URL 인코딩). */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const dates = `${formatUtc(ev.start)}/${formatUtc(ev.end)}`
  const details = [ev.description, ev.url].filter((x): x is string => Boolean(x)).join('\n')
  const parts: string[] = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(ev.title)}`,
    `dates=${dates}`, // 날짜 문자열은 URL-safe(숫자/T/Z), 구분자 '/' 는 그대로 둠
  ]
  if (ev.location) parts.push(`location=${encodeURIComponent(ev.location)}`)
  if (details) parts.push(`details=${encodeURIComponent(details)}`)
  return `https://calendar.google.com/calendar/render?${parts.join('&')}`
}
