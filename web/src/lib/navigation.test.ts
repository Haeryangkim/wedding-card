import { describe, it, expect } from 'vitest'
import type { Destination, NavEnv } from './navigation.ts'
import { buildNavTargets } from './navigation.ts'

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
