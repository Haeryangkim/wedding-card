/**
 * 카카오 JavaScript SDK 지연 로딩 + 초기화.
 * 카카오내비 공식 길안내(Kakao.Navi.start)는 JS SDK 와 JavaScript 키가 필요합니다.
 * 키는 청첩장별 설정이 아니라 서비스(빌드) 설정입니다: VITE_KAKAO_JS_KEY.
 * 키가 설정된 경우에만 사용하며, SDK 스크립트는 최초 1회만 삽입합니다.
 * (브라우저 전용 — DOM 참조. 빌드(vite.config.ts)나 순수 로직에서 import 하지 않습니다.)
 */

export interface KakaoNaviStartOptions {
  name: string
  /** 경도(longitude) */
  x: number
  /** 위도(latitude) */
  y: number
  coordType: 'wgs84' | 'katec'
}

export interface KakaoStatic {
  init(jsKey: string): void
  isInitialized(): boolean
  Navi: { start(options: KakaoNaviStartOptions): void }
}

declare global {
  interface Window {
    Kakao?: KakaoStatic
  }
}

/**
 * 카카오 공식 JS SDK (버전 고정).
 * SRI integrity 해시는 배포 전에 공식 값으로 추가하는 것을 권장합니다
 * (현 시점에 검증된 해시가 없어 생략 — 잘못된 해시는 로드를 완전히 막습니다).
 */
const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'

/** 빌드 시 지정한 카카오 JavaScript 키 (없으면 undefined → 키 없이 동작하는 방식으로 대체) */
export function kakaoJsKey(): string | undefined {
  const key = ((import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) ?? '').trim()
  return key || undefined
}

let loadPromise: Promise<KakaoStatic> | null = null

/** 카카오 SDK 를 로드/초기화하고 전역 Kakao 객체를 반환합니다(중복 로드 방지). */
export function loadKakao(jsKey: string): Promise<KakaoStatic> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise<KakaoStatic>((resolve, reject) => {
    const ready = (k: KakaoStatic): void => {
      if (!k.isInitialized()) k.init(jsKey)
      resolve(k)
    }

    if (window.Kakao) {
      ready(window.Kakao)
      return
    }

    const existing = document.getElementById('kakao-js-sdk') as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')
    const onLoad = (): void => {
      const k = window.Kakao
      if (k) ready(k)
      else reject(new Error('카카오 SDK 를 불러오지 못했습니다.'))
    }
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener(
      'error',
      () => {
        loadPromise = null // 실패 시 다음 시도에서 다시 로드할 수 있도록 초기화
        reject(new Error('카카오 SDK 스크립트 로드에 실패했습니다.'))
      },
      { once: true },
    )

    if (!existing) {
      script.id = 'kakao-js-sdk'
      script.src = SDK_URL
      script.async = true
      script.crossOrigin = 'anonymous'
      document.head.appendChild(script)
    }
  })

  return loadPromise
}
