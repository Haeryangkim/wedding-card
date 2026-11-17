/**
 * 사용자 에이전트(UA) 기반 플랫폼 감지.
 * 순수 함수(UA 문자열을 인자로 받음)와, navigator 를 읽는 얇은 래퍼로 분리하여 테스트 가능하게 합니다.
 */

/**
 * iOS 여부.
 * iPadOS 13+ 는 데스크톱 Safari 와 동일한 "Macintosh" UA 를 보내므로,
 * 멀티터치(maxTouchPoints > 1) 를 함께 보고 iPad 를 구분합니다.
 */
export function isIOS(ua: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPod|iPad/i.test(ua)) return true
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return true
  return false
}

export function isAndroid(ua: string): boolean {
  return /Android/i.test(ua)
}

/** 카카오톡 인앱 브라우저(iOS/Android 모두 UA 에 KAKAOTALK 토큰 포함) */
export function isKakaoInApp(ua: string): boolean {
  return /KAKAOTALK/i.test(ua)
}

export function isMobile(ua: string, maxTouchPoints = 0): boolean {
  return isIOS(ua, maxTouchPoints) || isAndroid(ua) || /Mobi/i.test(ua)
}

function navUA(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent : ''
}

function navTouch(): number {
  if (typeof navigator === 'undefined') return 0
  const mtp = navigator.maxTouchPoints
  return typeof mtp === 'number' ? mtp : 0
}

export const isIOSDevice = (): boolean => isIOS(navUA(), navTouch())
export const isAndroidDevice = (): boolean => isAndroid(navUA())
export const isKakaoInAppBrowser = (): boolean => isKakaoInApp(navUA())
export const isMobileDevice = (): boolean => isMobile(navUA(), navTouch())
