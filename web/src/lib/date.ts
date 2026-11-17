/**
 * 날짜/시간 순수 함수 모음.
 * 예식 일시는 config 에 +09:00(KST) 오프셋 ISO 로 저장되지만, 보는 사람의 기기 시간대와
 * 무관하게 "한국 시간" 기준으로 달력/카운트다운이 맞아야 하므로 KST 로 고정해 계산합니다.
 */

const KST = 'Asia/Seoul'
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

export interface KstParts {
  year: number
  month: number // 1~12
  day: number // 1~31
  hour: number // 0~23
  minute: number
  weekday: number // 0=일 ~ 6=토
}

/** 임의의 순간(Date)을 한국 시간(KST)의 달력 값으로 분해 */
export function kstParts(date: Date): KstParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const map: Record<string, string> = {}
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  const year = Number(map.year)
  const month = Number(map.month)
  const day = Number(map.day)
  return {
    year,
    month,
    day,
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    // 요일은 시간대에 의존하지 않도록 UTC 기준으로 해당 연·월·일의 요일을 계산
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  }
}

/** "2027년 5월 15일 토요일 오후 12시 30분" 형태의 한글 날짜 문장 */
export function formatKoreanDate(date: Date): string {
  const { year, month, day, hour, minute, weekday } = kstParts(date)
  const ampm = hour < 12 ? '오전' : '오후'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const time = minute > 0 ? `${ampm} ${h12}시 ${minute}분` : `${ampm} ${h12}시`
  return `${year}년 ${month}월 ${day}일 ${WEEKDAY_KO[weekday]}요일 ${time}`
}

/** "2027. 05. 15. SAT" 형태의 짧은 라틴 표기 (표지용) */
export function formatLatinDate(date: Date): string {
  const { year, month, day, weekday } = kstParts(date)
  const dd = String(day).padStart(2, '0')
  const mm = String(month).padStart(2, '0')
  const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
  return `${year}. ${mm}. ${dd}. ${WD[weekday]}`
}

/** "오후 12시 30분" 형태의 시간만 */
export function formatKoreanTime(date: Date): string {
  const { hour, minute } = kstParts(date)
  const ampm = hour < 12 ? '오전' : '오후'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return minute > 0 ? `${ampm} ${h12}시 ${minute}분` : `${ampm} ${h12}시`
}

export interface MonthGrid {
  year: number
  month: number // 1~12
  /** 6행 × 7열(일~토). 해당 월이 아닌 칸은 null */
  weeks: (number | null)[][]
}

/** 해당 연·월의 달력 그리드(일요일 시작). 시간대 비의존(UTC 기준 계산). */
export function monthGrid(year: number, month: number): MonthGrid {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  while (cells.length < 42) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  // 마지막 주가 전부 null 이면 제거 (5주로 끝나는 달)
  while (weeks.length > 1 && weeks[weeks.length - 1].every((c) => c === null)) weeks.pop()
  return { year, month, weeks }
}

export interface Countdown {
  /** 예식 시작 시각이 지났는가 */
  done: boolean
  days: number
  hours: number
  minutes: number
  seconds: number
  /** 한국 날짜(KST 달력) 기준 남은 일수 — 예식 당일 0, 전날 1 (D-day 문구용) */
  totalDays: number
}

/**
 * 목표 시각까지 남은 시간. now 기본값은 현재. (절대 순간 차이라 시간대 비의존)
 * totalDays 만은 24시간 단위가 아니라 KST 달력 날짜 차이다(하객이 기대하는 D-day).
 */
export function countdown(target: Date, now: number = Date.now()): Countdown {
  const diff = target.getTime() - now
  if (diff <= 0) {
    return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0, totalDays: 0 }
  }
  const sec = Math.floor(diff / 1000)
  const t = kstParts(target)
  const n = kstParts(new Date(now))
  const totalDays = Math.round(
    (Date.UTC(t.year, t.month - 1, t.day) - Date.UTC(n.year, n.month - 1, n.day)) / 86400000,
  )
  return {
    done: false,
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
    totalDays,
  }
}
