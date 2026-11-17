/**
 * 예식 일시: <input type="date"> / <input type="time"> 값 ↔ "+09:00"(KST) ISO 문자열. 순수 함수.
 * 보는 기기의 시간대와 무관하게 입력한 숫자 그대로를 한국 시간으로 저장한다.
 */

export interface DateTimeParts {
  /** "YYYY-MM-DD" */
  date: string
  /** "HH:MM" (24시간) */
  time: string
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/
const ISO_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?\+09:00$/

/** 달력에 실제로 있는 날짜인가 (2월 30일 등 거르기) */
export function isRealDate(date: string): boolean {
  const m = DATE_RE.exec(date)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 1900 || y > 2200) return false
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

export function isRealTime(time: string): boolean {
  const m = TIME_RE.exec(time)
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59
}

/** ("2027-05-15", "12:30") → "2027-05-15T12:30:00+09:00". 형식이 틀리면 null */
export function toKstIso(date: string, time: string): string | null {
  if (!isRealDate(date) || !isRealTime(time)) return null
  return `${date}T${time.slice(0, 5)}:00+09:00`
}

/** "+09:00" ISO → 입력값. 다른 오프셋/형식이면 그 순간을 KST 로 환산하고, 해석할 수 없으면 null */
export function fromKstIso(iso: string): DateTimeParts | null {
  const m = ISO_RE.exec(iso)
  if (m) return { date: m[1], time: m[2] }
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const k = new Date(t + 9 * 60 * 60 * 1000).toISOString() // KST 벽시계를 UTC 필드로 읽는다
  return { date: k.slice(0, 10), time: k.slice(11, 16) }
}
