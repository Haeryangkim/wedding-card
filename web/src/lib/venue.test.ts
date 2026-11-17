import { describe, expect, it } from 'vitest'
import { wedding as demo } from '../config/wedding'
import { DEFAULT_COORDS, isVenueLocationUnset, isVenueUndecided, VENUE_PLACEHOLDER, venueSearchLinks } from './venue'

describe('isVenueUndecided', () => {
  it('이름이 비었거나 자리표시 이름이면 미정', () => {
    expect(isVenueUndecided({ name: '  ' })).toBe(true)
    expect(isVenueUndecided({ name: VENUE_PLACEHOLDER })).toBe(true)
    expect(isVenueUndecided({ name: '더채플앳청담' })).toBe(false)
  })
})

describe('isVenueLocationUnset', () => {
  it('자리표시 좌표(서울시청) 그대로면 위치를 고르지 않은 것', () => {
    expect(isVenueLocationUnset({ ...DEFAULT_COORDS })).toBe(true)
    expect(isVenueLocationUnset({ lat: DEFAULT_COORDS.lat + 1e-8, lng: DEFAULT_COORDS.lng })).toBe(true)
  })

  it('조금이라도 다른 좌표는 고른 것으로 본다', () => {
    expect(isVenueLocationUnset({ lat: 37.5237, lng: 127.0473 })).toBe(false)
    expect(isVenueLocationUnset({ lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng + 1e-5 })).toBe(false)
  })

  it('숫자가 아닌 좌표는 지도에 쓸 수 없다', () => {
    expect(isVenueLocationUnset({ lat: Number.NaN, lng: 127 })).toBe(true)
  })

  it('번들된 데모 청첩장은 지도가 보여야 한다', () => {
    expect(isVenueLocationUnset(demo.venue)).toBe(false)
  })
})

describe('venueSearchLinks', () => {
  it('주소가 있으면 주소로, 없으면 이름으로 검색한다', () => {
    const byAddress = venueSearchLinks({ name: '더채플', address: '서울 강남구 선릉로 757' })
    expect(byAddress.map((l) => l.url)).toEqual([
      `https://map.kakao.com/link/search/${encodeURIComponent('서울 강남구 선릉로 757')}`,
      `https://map.naver.com/p/search/${encodeURIComponent('서울 강남구 선릉로 757')}`,
    ])
    expect(venueSearchLinks({ name: '더채플 & 홀', address: ' ' })[0].url).toBe(
      `https://map.kakao.com/link/search/${encodeURIComponent('더채플 & 홀')}`,
    )
  })

  it('둘 다 없으면 링크가 없다', () => {
    expect(venueSearchLinks({ name: '', address: '' })).toEqual([])
  })
})
