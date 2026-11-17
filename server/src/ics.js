/**
 * 캘린더(.ics) 생성. web/src/lib/ics.ts 의 weddingEvent + buildIcs 를 그대로 옮긴 것이다
 * (같은 일정이면 프론트 빌드 결과와 바이트 단위로 같은 문자열). 바꾸면 양쪽을 함께 수정.
 */

/**
 * @typedef {object} CalendarEvent
 * @property {string} title
 * @property {string} [description]
 * @property {string} [location]
 * @property {Date} start
 * @property {Date} end
 * @property {string} [url] 청첩장 URL (있으면 일정에 링크로 첨부)
 */

/**
 * 청첩장 설정 → 캘린더 일정
 * @param {any} w WeddingConfig
 * @param {string} [siteUrl]
 * @returns {CalendarEvent}
 */
export function weddingEvent(w, siteUrl) {
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

/** UTC 기준 iCalendar 날짜-시각 문자열(YYYYMMDDTHHMMSSZ). 한국은 DST 가 없어 UTC 변환이 정확하다. @param {Date} d */
function formatUtc(d) {
  const p = (/** @type {number} */ n) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

/** RFC 5545 텍스트 값 이스케이프(역슬래시 먼저). @param {string} s */
function escapeText(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** 하나의 유니코드 코드포인트가 UTF-8 로 몇 바이트인지. @param {number} cp */
function utf8Len(cp) {
  if (cp <= 0x7f) return 1
  if (cp <= 0x7ff) return 2
  if (cp <= 0xffff) return 3
  return 4
}

/**
 * RFC 5545 라인 폴딩: 한 물리 라인이 75 옥텟을 넘지 않도록 CRLF+SPACE 로 접는다.
 * 코드포인트 단위로 순회하므로 UTF-8 멀티바이트 문자(한글 등)를 중간에서 쪼개지 않는다.
 * @param {string} line
 */
function foldLine(line) {
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

/** 결정적(deterministic) 32bit FNV-1a 해시 → 8자리 16진수. UID 안정화에 사용. @param {string} s */
function hash32(s) {
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
 * - UID/DTSTAMP 는 일정 내용에서만 파생 → 같은 일정은 항상 같은 결과
 * - 1일 전 VALARM 포함
 * @param {CalendarEvent} ev
 */
export function buildIcs(ev) {
  const dtStart = formatUtc(ev.start)
  const dtEnd = formatUtc(ev.end)
  const dtStamp = dtStart
  const uid = `${hash32(`${ev.title}|${ev.location ?? ''}|${dtStart}`)}-${dtStart}@wedding.invitation`

  const rows = [
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
