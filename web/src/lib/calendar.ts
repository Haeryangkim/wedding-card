/** 캘린더 일정 등록 (브라우저 측). (계약: export 시그니처는 sections/ 가 사용 — 변경 금지) */
import type { CalendarEvent } from './ics'
import { googleCalendarUrl } from './ics'
import { isAndroid, isKakaoInApp } from './platform.ts'

export type { CalendarEvent } from './ics'
export { weddingEvent, buildIcs, googleCalendarUrl } from './ics'

/** 빌드 시 vite 플러그인이 사이트 루트에 생성하는 정적 .ics 파일명 */
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
 * 순수 함수: 기기 캘린더용 .ics 로 이동할 URL. 테스트 대상.
 * 카카오톡 인앱 브라우저(WebView)는 text/calendar 를 처리하지 못하므로, 외부 브라우저
 * (Safari/기본 브라우저)로 .ics 를 열게 하는 kakaotalk://web/openExternal 스킴을 쓴다.
 * @param ua 사용자 에이전트
 * @param baseUrl 사이트 base 경로 (예: "/", "/wedding-card/")
 * @param origin 현재 페이지 오리진 (예: "https://example.com")
 */
export function deviceCalendarHref(ua: string, baseUrl: string, origin: string): string {
  const path = `${baseUrl}${ICS_FILENAME}`
  if (!isKakaoInApp(ua)) return path
  let abs: string
  try {
    abs = new URL(path, origin).href
  } catch {
    return path
  }
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(abs)}`
}

/**
 * 기기 기본 캘린더: 빌드 시 생성되는 실제 정적 파일 wedding.ics 로 이동.
 * (Blob/data URL 다운로드보다 실파일 이동이 안정적. 카카오톡 인앱에서는 외부 브라우저로 연다)
 */
export function openDeviceCalendar(): void {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  window.location.href = deviceCalendarHref(ua, import.meta.env.BASE_URL, window.location.origin)
}

/** 구글 캘린더 일정 추가 화면 열기 (새 탭) */
export function openGoogleCalendar(ev: CalendarEvent): void {
  window.open(googleCalendarUrl(ev), '_blank', 'noopener')
}
