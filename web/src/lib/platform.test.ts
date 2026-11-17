import { describe, it, expect } from 'vitest'
import { isAndroid, isIOS, isKakaoInApp, isMobile } from './platform.ts'

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadDesktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  samsungInternet:
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  kakaoAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.5.5',
  kakaoIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.5.5',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
}

describe('isIOS', () => {
  it('iPhone Safari 는 iOS', () => expect(isIOS(UA.iphoneSafari)).toBe(true))
  it('iPad 데스크톱 UA 는 멀티터치가 있으면 iOS', () =>
    expect(isIOS(UA.ipadDesktop, 5)).toBe(true))
  it('진짜 Mac(터치 없음)은 iOS 아님', () => expect(isIOS(UA.macSafari, 0)).toBe(false))
  it('Android 는 iOS 아님', () => expect(isIOS(UA.androidChrome)).toBe(false))
})

describe('isAndroid', () => {
  it('Android Chrome', () => expect(isAndroid(UA.androidChrome)).toBe(true))
  it('삼성 인터넷', () => expect(isAndroid(UA.samsungInternet)).toBe(true))
  it('iPhone 은 아님', () => expect(isAndroid(UA.iphoneSafari)).toBe(false))
  it('Windows 는 아님', () => expect(isAndroid(UA.windowsChrome)).toBe(false))
})

describe('isKakaoInApp', () => {
  it('카카오톡 인앱(Android)', () => expect(isKakaoInApp(UA.kakaoAndroid)).toBe(true))
  it('카카오톡 인앱(iOS)', () => expect(isKakaoInApp(UA.kakaoIos)).toBe(true))
  it('일반 Safari 는 아님', () => expect(isKakaoInApp(UA.iphoneSafari)).toBe(false))
})

describe('isKakaoInApp + OS 조합', () => {
  it('카카오 Android 는 Android 로도 감지', () => {
    expect(isAndroid(UA.kakaoAndroid)).toBe(true)
    expect(isIOS(UA.kakaoAndroid)).toBe(false)
  })
  it('카카오 iOS 는 iOS 로도 감지', () => {
    expect(isIOS(UA.kakaoIos)).toBe(true)
    expect(isAndroid(UA.kakaoIos)).toBe(false)
  })
})

describe('isMobile', () => {
  it('iPhone / Android / 삼성 / iPad(터치) 는 모바일', () => {
    expect(isMobile(UA.iphoneSafari)).toBe(true)
    expect(isMobile(UA.androidChrome)).toBe(true)
    expect(isMobile(UA.samsungInternet)).toBe(true)
    expect(isMobile(UA.ipadDesktop, 5)).toBe(true)
  })
  it('데스크톱(Windows/Mac) 은 모바일 아님', () => {
    expect(isMobile(UA.windowsChrome)).toBe(false)
    expect(isMobile(UA.macSafari, 0)).toBe(false)
  })
})
