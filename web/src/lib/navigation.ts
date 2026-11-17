/** 길안내 딥링크. (계약: 아래 export 시그니처는 sections/Location.tsx 가 사용 — 변경 금지) */
import { isAndroid, isIOS } from './platform.ts'
import { kakaoJsKey, loadKakao } from './kakao.ts'

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
  return { platform, origin, kakaoJsKey: kakaoJsKey() }
}

/** iOS 에서 스킴 실행 후 앱이 열렸는지 판단하기까지 기다리는 시간 */
export const IOS_APP_OPEN_TIMEOUT_MS = 2500

type NavAppMissingListener = (storeUrl: string) => void
const appMissingListeners = new Set<NavAppMissingListener>()

/**
 * iOS 에서 앱이 열리지 않은 것으로 보일 때(미설치 추정) 스토어 URL 을 전달받는다.
 * 페이지를 강제로 이동시키지 않고, 화면에 "앱 설치" 링크를 띄우는 용도. 반환값은 구독 해제 함수.
 */
export function onNavAppMissing(listener: NavAppMissingListener): () => void {
  appMissingListeners.add(listener)
  return () => {
    appMissingListeners.delete(listener)
  }
}

/**
 * iOS: 커스텀 스킴으로 이동한다. 일정 시간 뒤에도 페이지가 한 번도 가려지거나 포커스를
 * 잃지 않았다면 앱이 없는 것으로 보고 onNavAppMissing 구독자에게 스토어 URL 을 알린다.
 *
 * 청첩장 탭을 스토어로 자동 이동시키지는 않는다: iOS Safari 는 스킴 이동 시 "앱에서 열까요?"
 * 확인창을 띄우는데 그동안에도 페이지는 보이는 상태이고 타이머가 계속 돌기 때문에,
 * 앱이 설치된 하객(확인이 늦거나 취소한 경우)까지 App Store 로 보내 버리게 된다.
 */
function launchIosWithFallback(scheme: string, fallbackUrl: string): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let wasHidden = false
  const startedAt = Date.now()

  const cleanup = (): void => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', cancel)
    window.removeEventListener('blur', cancel)
  }
  const cancel = (): void => {
    wasHidden = true
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
    timer = undefined
    cleanup()
    // 앱이 열렸던 흔적(가려짐/포커스 상실)이 있으면 아무것도 하지 않는다.
    if (wasHidden || document.hidden) return
    if (typeof document.hasFocus === 'function' && !document.hasFocus()) return
    // 타이머가 한참 늦게 실행됐다면 그 사이 페이지가 멈춰 있었던 것(앱 전환) → 무시
    if (Date.now() - startedAt > IOS_APP_OPEN_TIMEOUT_MS + 1000) return
    for (const listener of appMissingListeners) listener(fallbackUrl)
  }, IOS_APP_OPEN_TIMEOUT_MS)
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
 * 해당 앱으로 목적지 길안내를 실행. 앱 미설치 시 Android 는 스토어/웹으로 폴백하고,
 * iOS 는 onNavAppMissing 으로 스토어 URL 을 알린다(페이지는 이동시키지 않음).
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
