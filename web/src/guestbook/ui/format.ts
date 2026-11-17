import type { Side } from '../types'

export function sideLabel(side: Side): string {
  return side === 'groom' ? '신랑측' : '신부측'
}

export function shortDate(ts: number): string {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}.${m}.${day}`
}

export function fullDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 상대 시간 표기 (오래되면 짧은 날짜로) */
export function relativeTime(ts: number, now = Date.now()): string {
  const diff = now - ts
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (diff < 0) return shortDate(ts)
  if (diff < min) return '방금 전'
  if (diff < hour) return `${Math.floor(diff / min)}분 전`
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`
  return shortDate(ts)
}
