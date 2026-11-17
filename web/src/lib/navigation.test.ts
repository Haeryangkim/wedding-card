import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Destination, NavEnv } from './navigation.ts'
import { buildNavTargets, IOS_APP_OPEN_TIMEOUT_MS, onNavAppMissing, openNavigation } from './navigation.ts'

// 위도(lat)와 경도(lng)가 뚜렷이 다른 값 → 좌표 순서 뒤바뀜을 잡아낸다
const dest: Destination = { name: '예시 웨딩홀 & 그랜드,홀', lat: 37.5662952, lng: 126.9779451 }
const NAME = encodeURIComponent(dest.name) // 한글/공백/특수문자 모두 퍼센트 인코딩

const ios: NavEnv = { platform: 'ios', origin: 'https://haeryangkim.github.io/wedding-card/' }
const android: NavEnv = { platform: 'android', origin: 'https://haeryangkim.github.io/wedding-card/' }
const desktop: NavEnv = { platform: 'desktop', origin: 'https://haeryangkim.github.io/wedding-card/' }

describe('특수문자 인코딩', () => {
  it('공백→%20, &→%26, ,→%2C', () => {
    expect(NAME).toContain('%20') // 공백
    expect(NAME).toContain('%26') // &
    expect(NAME).toContain('%2C') // ,
    expect(NAME).not.toContain(' ')
    expect(NAME).not.toContain('&')
  })
})

describe('네이버지도', () => {
  const t = buildNavTargets('navermap', dest, ios)
  it('scheme: dlat=위도, dlng=경도, appname=인코딩된 origin', () => {
    expect(t.scheme).toBe(
      `nmap://route/car?dlat=37.5662952&dlng=126.9779451&dname=${NAME}` +
        `&appname=${encodeURIComponent(ios.origin)}`,
    )
  })
  it('androidIntent 에 네이버 패키지가 포함', () => {
    const a = buildNavTargets('navermap', dest, android)
    expect(a.androidIntent).toContain('package=com.nhn.android.nmap')
    expect(a.androidIntent.startsWith('intent://route/car?dlat=37.5662952&dlng=126.9779451')).toBe(true)
  })
  it('storeUrl 은 플랫폼별', () => {
    expect(buildNavTargets('navermap', dest, ios).storeUrl).toBe('https://apps.apple.com/app/id311867728')
    expect(buildNavTargets('navermap', dest, android).storeUrl).toBe(
      'https://play.google.com/store/apps/details?id=com.nhn.android.nmap',
    )
  })
  it('webFallback 은 네이버 장소 검색', () => {
    expect(t.webFallback).toBe(`https://map.naver.com/p/search/${NAME}`)
  })
})

describe('티맵', () => {
  const t = buildNavTargets('tmap', dest, ios)
  it('scheme: goalx=경도, goaly=위도', () => {
    expect(t.scheme).toBe(`tmap://route?goalname=${NAME}&goalx=126.9779451&goaly=37.5662952`)
  })
  it('androidIntent 에 티맵 패키지와 browser_fallback_url 포함', () => {
    const a = buildNavTargets('tmap', dest, android)
    expect(a.androidIntent).toContain('package=com.skt.tmap.ku')
    expect(a.androidIntent).toContain('S.browser_fallback_url=')
  })
  it('storeUrl 은 플랫폼별', () => {
    expect(buildNavTargets('tmap', dest, ios).storeUrl).toBe('https://apps.apple.com/app/id431589174')
    expect(buildNavTargets('tmap', dest, android).storeUrl).toBe(
      'https://play.google.com/store/apps/details?id=com.skt.tmap.ku',
    )
  })
  it('webFallback 은 카카오맵 길찾기 (티맵 웹 경로 없음)', () => {
    expect(t.webFallback).toBe(`https://map.kakao.com/link/to/${NAME},37.5662952,126.9779451`)
  })
})

describe('카카오내비 (키리스 폴백 = 카카오맵)', () => {
  const t = buildNavTargets('kakaonavi', dest, ios)
  it('scheme: ep=위도,경도&by=CAR', () => {
    expect(t.scheme).toBe('kakaomap://route?ep=37.5662952,126.9779451&by=CAR')
  })
  it('androidIntent 에 카카오맵 패키지와 fallback 포함', () => {
    const a = buildNavTargets('kakaonavi', dest, android)
    expect(a.androidIntent).toContain('scheme=kakaomap;package=net.daum.android.map')
    expect(a.androidIntent).toContain('S.browser_fallback_url=')
  })
  it('webFallback: /link/to/NAME,위도,경도', () => {
    expect(t.webFallback).toBe(`https://map.kakao.com/link/to/${NAME},37.5662952,126.9779451`)
  })
  it('storeUrl 은 카카오맵 앱', () => {
    expect(buildNavTargets('kakaonavi', dest, ios).storeUrl).toBe('https://apps.apple.com/app/id304608425')
    expect(buildNavTargets('kakaonavi', dest, android).storeUrl).toBe(
      'https://play.google.com/store/apps/details?id=net.daum.android.map',
    )
  })
})

describe('좌표 순서 회귀 방지 (lat vs lng)', () => {
  it('각 앱이 올바른 슬롯에 위도/경도를 넣는다', () => {
    const n = buildNavTargets('navermap', dest, desktop)
    const m = buildNavTargets('tmap', dest, desktop)
    const k = buildNavTargets('kakaonavi', dest, desktop)
    // 네이버: dlat=위도
    expect(n.scheme).toContain('dlat=37.5662952')
    expect(n.scheme).toContain('dlng=126.9779451')
    // 티맵: goaly=위도, goalx=경도
    expect(m.scheme).toContain('goaly=37.5662952')
    expect(m.scheme).toContain('goalx=126.9779451')
    // 카카오맵: ep=위도,경도
    expect(k.scheme).toContain('ep=37.5662952,126.9779451')
  })
})

describe('iOS 스킴 실행 후 앱 미설치 폴백 (openNavigation)', () => {
  const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  const STORE = 'https://apps.apple.com/app/id311867728'

  /** node 환경용 최소 window/document 대역 */
  function setup() {
    const docListeners = new Map<string, Set<() => void>>()
    const winListeners = new Map<string, Set<() => void>>()
    const on = (m: Map<string, Set<() => void>>) => (type: string, fn: () => void) => {
      if (!m.has(type)) m.set(type, new Set())
      m.get(type)!.add(fn)
    }
    const off = (m: Map<string, Set<() => void>>) => (type: string, fn: () => void) => {
      m.get(type)?.delete(fn)
    }
    const fire = (m: Map<string, Set<() => void>>, type: string) => {
      for (const fn of [...(m.get(type) ?? [])]) fn()
    }
    const hrefs: string[] = []
    const location = {
      get href() {
        return hrefs[hrefs.length - 1] ?? 'https://our.wedding/'
      },
      set href(v: string) {
        hrefs.push(v)
      },
    }
    const doc = {
      hidden: false,
      focused: true,
      hasFocus() {
        return doc.focused
      },
      addEventListener: on(docListeners),
      removeEventListener: off(docListeners),
    }
    vi.stubGlobal('navigator', { userAgent: IPHONE_UA, maxTouchPoints: 5 })
    vi.stubGlobal('document', doc)
    vi.stubGlobal('window', {
      location,
      addEventListener: on(winListeners),
      removeEventListener: off(winListeners),
      open: vi.fn(),
    })
    const missing: string[] = []
    const unsubscribe = onNavAppMissing((url) => missing.push(url))
    return {
      hrefs,
      doc,
      missing,
      unsubscribe,
      fireDoc: (t: string) => fire(docListeners, t),
      fireWin: (t: string) => fire(winListeners, t),
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('페이지가 계속 보이는 상태였으면 스토어로 이동하지 않고 설치 링크만 알린다', () => {
    const env = setup()
    openNavigation('navermap', dest)
    expect(env.hrefs).toHaveLength(1)
    expect(env.hrefs[0].startsWith('nmap://route/car?')).toBe(true)

    vi.advanceTimersByTime(IOS_APP_OPEN_TIMEOUT_MS - 1)
    expect(env.missing).toEqual([])
    vi.advanceTimersByTime(1)
    expect(env.missing).toEqual([STORE])
    // 청첩장 탭 자체는 스토어로 이동하지 않는다
    expect(env.hrefs).toHaveLength(1)
    env.unsubscribe()
  })

  it('페이지가 가려졌으면(앱이 열림) 아무것도 하지 않는다', () => {
    const env = setup()
    openNavigation('navermap', dest)
    env.doc.hidden = true
    env.fireDoc('visibilitychange')
    env.doc.hidden = false // 앱에서 돌아옴
    vi.advanceTimersByTime(IOS_APP_OPEN_TIMEOUT_MS * 2)
    expect(env.missing).toEqual([])
    expect(env.hrefs).toHaveLength(1)
    env.unsubscribe()
  })

  it('blur / pagehide 로 포커스를 잃었으면 아무것도 하지 않는다', () => {
    for (const type of ['blur', 'pagehide']) {
      const env = setup()
      openNavigation('tmap', dest)
      env.fireWin(type)
      vi.advanceTimersByTime(IOS_APP_OPEN_TIMEOUT_MS * 2)
      expect(env.missing).toEqual([])
      expect(env.hrefs).toHaveLength(1)
      env.unsubscribe()
    }
  })

  it('타이머 시점에 문서가 포커스를 잃은 상태면 아무것도 하지 않는다', () => {
    const env = setup()
    openNavigation('navermap', dest)
    env.doc.focused = false // 이벤트 없이 포커스만 잃은 경우(확인창 등)
    vi.advanceTimersByTime(IOS_APP_OPEN_TIMEOUT_MS)
    expect(env.missing).toEqual([])
    env.unsubscribe()
  })

  it('타이머가 한참 늦게 실행되면(페이지가 멈춰 있었음) 아무것도 하지 않는다', () => {
    const env = setup()
    openNavigation('navermap', dest)
    // 타이머는 실행되지 않은 채 시계만 흐른 상황(백그라운드 스로틀링)을 흉내
    vi.setSystemTime(Date.now() + 10_000)
    vi.advanceTimersByTime(IOS_APP_OPEN_TIMEOUT_MS)
    expect(env.missing).toEqual([])
    env.unsubscribe()
  })
})
