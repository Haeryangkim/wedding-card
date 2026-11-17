/** 캘린더 일정 등록 (브라우저 측). sections/Calendar.tsx 가 사용 */
import type { CalendarEvent } from './ics'
import { googleCalendarUrl } from './ics'
import { isAndroid, isKakaoInApp } from './platform.ts'
import { apiBase } from '../platform/api'

export type { CalendarEvent } from './ics'
export { weddingEvent, buildIcs, googleCalendarUrl } from './ics'

/** .ics 파일명 (데모: 빌드 시 사이트 루트에 생성 / 실제: 서버의 /w/<slug>/wedding.ics) */
export const ICS_FILENAME = 'wedding.ics'

export type CalendarTarget = 'device' | 'google'

/** 순수 함수: UA 로부터 추천 대상 결정 (Android → google, 그 외 → device). 테스트 대상. */
export function preferredCalendarTargetFor(ua: string): CalendarTarget {
  return isAndroid(ua) ? 'google' : 'device'
}

/** 현재 기기에서 기본으로 추천할 대상 (iOS/macOS → device, Android → google) */
export function preferredCalendarTarget(): CalendarTarget {
  return preferredCalendarTargetFor(typeof navigator !== 'undefined' ? navigator.userAgent : '')
}

/**
 * 순수 함수: 이 청첩장의 .ics 주소. 테스트 대상.
 *  - 데모: 빌드 시 사이트 루트에 만들어지는 정적 파일 (`${baseUrl}wedding.ics`)
 *  - 실제 청첩장: 서버가 만들어 주는 `${apiBase}/w/<slug>/wedding.ics`
 * @param baseUrl 사이트 base 경로 (예: "/", "/wedding-card/")
 * @param apiBase API 오리진 ("" = 같은 오리진, null = 서버 없음)
 */
export function icsUrlFor(slug: string, isDemo: boolean, baseUrl: string, apiBase: string | null): string {
  if (isDemo || apiBase === null) return `${baseUrl}${ICS_FILENAME}`
  return `${apiBase}/w/${encodeURIComponent(slug)}/${ICS_FILENAME}`
}

/**
 * 순수 함수: .ics 주소(상대/절대)로 이동할 URL. 테스트 대상.
 * 카카오톡 인앱 브라우저(WebView)는 text/calendar 를 처리하지 못하므로, 외부 브라우저
 * (Safari/기본 브라우저)로 .ics 를 열게 하는 kakaotalk://web/openExternal 스킴을 쓴다.
 * @param ua 사용자 에이전트
 * @param icsUrl icsUrlFor() 결과
 * @param origin 현재 페이지 오리진 (예: "https://example.com")
 */
export function calendarHref(ua: string, icsUrl: string, origin: string): string {
  if (!isKakaoInApp(ua)) return icsUrl
  let abs: string
  try {
    abs = new URL(icsUrl, origin).href
  } catch {
    return icsUrl
  }
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(abs)}`
}

/** 순수 함수: 데모(정적 파일)용 calendarHref. baseUrl 은 사이트 base 경로 */
export function deviceCalendarHref(ua: string, baseUrl: string, origin: string): string {
  return calendarHref(ua, `${baseUrl}${ICS_FILENAME}`, origin)
}

/**
 * 기기 기본 캘린더: 실제 파일(.ics) 주소로 이동.
 * (Blob/data URL 다운로드보다 실파일 이동이 안정적. 카카오톡 인앱에서는 외부 브라우저로 연다)
 */
export function openDeviceCalendar(slug: string, isDemo: boolean): void {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const icsUrl = icsUrlFor(slug, isDemo, import.meta.env.BASE_URL, apiBase())
  window.location.href = calendarHref(ua, icsUrl, window.location.origin)
}

/** 구글 캘린더 일정 추가 화면 열기 (새 탭) */
export function openGoogleCalendar(ev: CalendarEvent): void {
  window.open(googleCalendarUrl(ev), '_blank', 'noopener')
}
