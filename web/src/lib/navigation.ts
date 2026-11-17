/** 길안내 딥링크. (계약: 아래 export 시그니처는 sections/Location.tsx 가 사용 — 변경 금지) */
import { wedding } from '../config/wedding.ts'
import { isAndroid, isIOS } from './platform.ts'
import { loadKakao } from './kakao.ts'

export type NavApp = 'kakaonavi' | 'navermap' | 'tmap'

export interface Destination {
  name: string
  lat: number
  lng: number
}

export const NAV_APPS: { id: NavApp; label: string }[] = [
  { id: 'kakaonavi', label: '카카오내비' },
  { id: 'navermap', label: '네이버지도' },
  { id: 'tmap', label: '티맵' },
]

export type NavPlatform = 'ios' | 'android' | 'desktop'

export interface NavEnv {
  platform: NavPlatform
  /** 네이버지도 appname 등에 쓰이는 현재 페이지 URL/오리진 */
  origin: string
  /** 설정된 경우 카카오내비는 JS SDK 로 실행 */
  kakaoJsKey?: string
}

export interface NavTargets {
  /** iOS 용 커스텀 스킴 URL */
  scheme: string
  /** Android 용 intent:// URL (가능한 경우 S.browser_fallback_url 포함) */
  androidIntent: string
  /** 앱 미설치 시 이동할 스토어 URL (플랫폼에 맞춰 선택됨) */
  storeUrl: string
  /** 데스크톱/웹 폴백 URL */
  webFallback: string
}

const APPLE_STORE = {
  navermap: 'https://apps.apple.com/app/id311867728',
  tmap: 'https://apps.apple.com/app/id431589174',
  // 카카오내비 키리스 폴백은 카카오맵 앱을 사용
  kakaonavi: 'https://apps.apple.com/app/id304608425',
} as const

const PLAY_STORE = {
  navermap: 'https://play.google.com/store/apps/details?id=com.nhn.android.nmap',
  tmap: 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku',
  kakaonavi: 'https://play.google.com/store/apps/details?id=net.daum.android.map',
} as const

function storeUrlFor(app: NavApp, platform: NavPlatform): string {
  return platform === 'android' ? PLAY_STORE[app] : APPLE_STORE[app]
}

/**
 * 순수 함수: 앱/목적지/환경으로부터 실행용 URL 들을 생성합니다(부수효과 없음, 테스트 대상).
 * 좌표 순서에 주의 — 앱마다 lat/lng 파라미터 규칙이 다릅니다.
 */
export function buildNavTargets(app: NavApp, dest: Destination, env: NavEnv): NavTargets {
  const name = encodeURIComponent(dest.name)
  const { lat, lng } = dest
  const store = storeUrlFor(app, env.platform)

  switch (app) {
    case 'navermap': {
      // 네이버지도(공식): dlat=위도, dlng=경도, appname=페이지 URL(인코딩)
      const appname = encodeURIComponent(env.origin || 'wedding-card')
      const q = `dlat=${lat}&dlng=${lng}&dname=${name}&appname=${appname}`
      return {
        scheme: `nmap://route/car?${q}`,
        androidIntent:
          `intent://route/car?${q}#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
          `category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`,
        storeUrl: store,
        // 좌표 기반 /p/directions 포맷은 미확인이라, 안전한 장소 검색으로 폴백
        webFallback: `https://map.naver.com/p/search/${name}`,
      }
    }
    case 'tmap': {
      // 티맵: 공식 공개 URL 스킴 문서가 없음. goalname/goalx/goaly 는 국내 청첩장 코드에서
      // 널리 쓰이나 미검증 변형이며, goalx=경도(lng), goaly=위도(lat) 입니다. (실기기 확인 권장)
      const q = `goalname=${name}&goalx=${lng}&goaly=${lat}`
      return {
        scheme: `tmap://route?${q}`,
        androidIntent:
          `intent://route?${q}#Intent;scheme=tmap;package=com.skt.tmap.ku;` +
          `S.browser_fallback_url=${encodeURIComponent(store)};end`,
        storeUrl: store,
        // 티맵은 웹 경로안내가 없으므로, 목적지 길찾기를 보여주는 카카오맵 웹으로 폴백
        webFallback: `https://map.kakao.com/link/to/${name},${lat},${lng}`,
      }
    }
    case 'kakaonavi': {
      // 키 없이 쓰는 폴백: 카카오맵 앱/웹 길찾기 (ep=위도,경도)
      const web = `https://map.kakao.com/link/to/${name},${lat},${lng}`
      return {
        scheme: `kakaomap://route?ep=${lat},${lng}&by=CAR`,
        androidIntent:
          `intent://route?ep=${lat},${lng}&by=CAR#Intent;scheme=kakaomap;package=net.daum.android.map;` +
          `S.browser_fallback_url=${encodeURIComponent(web)};end`,
        storeUrl: store,
        webFallback: web,
      }
    }
  }
  // NavApp 유니온을 모두 처리 — 도달 불가
  throw new Error(`지원하지 않는 길안내 앱: ${String(app)}`)
}

/** 현재 실행 환경(플랫폼/오리진/카카오 키)을 감지합니다. */
function detectNavEnv(): NavEnv {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const mtp =
    typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number'
      ? navigator.maxTouchPoints
      : 0
  let platform: NavPlatform = 'desktop'
  if (isIOS(ua, mtp)) platform = 'ios'
  else if (isAndroid(ua)) platform = 'android'
  const origin = typeof window !== 'undefined' ? window.location.href : ''
  return { platform, origin, kakaoJsKey: wedding.kakaoJsKey }
}

/**
 * iOS: 커스텀 스킴으로 이동 후, 앱이 열려 페이지가 백그라운드로 가지 않으면(타이머가 취소되지 않으면)
 * 폴백 URL 로 이동. visibilitychange/pagehide/blur 로 타이머를 취소합니다.
 */
function launchIosWithFallback(scheme: string, fallbackUrl: string): void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const cleanup = (): void => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', cancel)
    window.removeEventListener('blur', cancel)
  }
  const cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    cleanup()
  }
  const onVisibility = (): void => {
    if (document.hidden) cancel()
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', cancel)
  window.addEventListener('blur', cancel)

  window.location.href = scheme
  timer = setTimeout(() => {
    cleanup()
    window.location.href = fallbackUrl
  }, 2000)
}

/** 카카오내비 공식 길안내 (JS SDK). 실패 시 키리스 폴백으로 전환. */
function launchKakaoNavi(dest: Destination, env: NavEnv): void {
  const key = env.kakaoJsKey
  if (!key) {
    launchKeyless('kakaonavi', dest, env)
    return
  }
  loadKakao(key)
    .then((Kakao) => {
      Kakao.Navi.start({ name: dest.name, x: dest.lng, y: dest.lat, coordType: 'wgs84' })
    })
    .catch(() => {
      // SDK 로드/실행 실패 → 카카오맵 웹 길찾기로 폴백
      const t = buildNavTargets('kakaonavi', dest, env)
      window.open(t.webFallback, '_blank', 'noopener')
    })
}

/** 스킴/인텐트/웹 폴백을 플랫폼에 맞춰 실행. */
function launchKeyless(app: NavApp, dest: Destination, env: NavEnv): void {
  const t = buildNavTargets(app, dest, env)
  if (env.platform === 'android') {
    window.location.href = t.androidIntent
    return
  }
  if (env.platform === 'ios') {
    launchIosWithFallback(t.scheme, t.storeUrl)
    return
  }
  window.open(t.webFallback, '_blank', 'noopener')
}

/**
 * 해당 앱으로 목적지 길안내를 실행. 앱 미설치 시 스토어/웹으로 폴백.
 * 반드시 클릭 핸들러 안에서 동기적으로 호출해야 합니다(iOS 스킴/인텐트 제약).
 */
export function openNavigation(app: NavApp, dest: Destination): void {
  const env = detectNavEnv()
  if (app === 'kakaonavi') {
    launchKakaoNavi(dest, env)
    return
  }
  launchKeyless(app, dest, env)
}
