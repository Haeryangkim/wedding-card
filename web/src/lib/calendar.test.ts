import { describe, it, expect } from 'vitest'
import { calendarHref, deviceCalendarHref, icsUrlFor, preferredCalendarTargetFor } from './calendar.ts'

describe('preferredCalendarTargetFor', () => {
  it('Android 는 google 추천', () => {
    expect(
      preferredCalendarTargetFor(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('google')
  })
  it('iPhone 은 device 추천', () => {
    expect(
      preferredCalendarTargetFor(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('device')
  })
  it('macOS/데스크톱은 device 추천', () => {
    expect(
      preferredCalendarTargetFor(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      ),
    ).toBe('device')
    expect(preferredCalendarTargetFor('')).toBe('device')
  })
})

describe('deviceCalendarHref', () => {
  const SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  const KAKAO_IOS =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5'
  const KAKAO_ANDROID =
    'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36;KAKAOTALK 2410850'

  it('일반 브라우저는 base 경로의 wedding.ics 로 바로 이동', () => {
    expect(deviceCalendarHref(SAFARI, '/', 'https://our.wedding')).toBe('/wedding.ics')
    expect(deviceCalendarHref(SAFARI, '/wedding-card/', 'https://user.github.io')).toBe('/wedding-card/wedding.ics')
  })

  it('카카오톡 인앱은 외부 브라우저로 절대 URL 을 연다', () => {
    expect(deviceCalendarHref(KAKAO_IOS, '/wedding-card/', 'https://user.github.io')).toBe(
      'kakaotalk://web/openExternal?url=' +
        encodeURIComponent('https://user.github.io/wedding-card/wedding.ics'),
    )
    expect(deviceCalendarHref(KAKAO_ANDROID, '/', 'https://our.wedding')).toBe(
      'kakaotalk://web/openExternal?url=' + encodeURIComponent('https://our.wedding/wedding.ics'),
    )
  })

  it('오리진을 알 수 없으면 상대 경로로 폴백', () => {
    expect(deviceCalendarHref(KAKAO_IOS, '/', '')).toBe('/wedding.ics')
  })
})

describe('icsUrlFor', () => {
  it('데모는 빌드된 정적 파일', () => {
    expect(icsUrlFor('demo', true, '/wedding-card/', null)).toBe('/wedding-card/wedding.ics')
    expect(icsUrlFor('demo', true, '/', '')).toBe('/wedding.ics')
  })
  it('실제 청첩장은 서버의 /w/<slug>/wedding.ics', () => {
    expect(icsUrlFor('our-day', false, '/', '')).toBe('/w/our-day/wedding.ics')
    expect(icsUrlFor('our-day', false, '/app/', 'https://api.example.com')).toBe(
      'https://api.example.com/w/our-day/wedding.ics',
    )
  })
})

describe('calendarHref', () => {
  const KAKAO =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5'
  it('카카오톡 인앱: 상대/절대 .ics 주소 모두 외부 브라우저용 절대 URL 로', () => {
    expect(calendarHref(KAKAO, '/w/our-day/wedding.ics', 'https://our.site')).toBe(
      'kakaotalk://web/openExternal?url=' + encodeURIComponent('https://our.site/w/our-day/wedding.ics'),
    )
    expect(calendarHref(KAKAO, 'https://api.example.com/w/a-b/wedding.ics', 'https://our.site')).toBe(
      'kakaotalk://web/openExternal?url=' + encodeURIComponent('https://api.example.com/w/a-b/wedding.ics'),
    )
  })
  it('일반 브라우저는 그대로', () => {
    expect(calendarHref('Mozilla/5.0 Safari', '/w/abc/wedding.ics', 'https://our.site')).toBe('/w/abc/wedding.ics')
  })
})
