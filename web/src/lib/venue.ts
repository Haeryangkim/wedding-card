/** 장소를 아직 정하지 않은 청첩장에 들어가는 이름 (서버는 장소 이름을 비워 둘 수 없다) */
export const VENUE_PLACEHOLDER = '예식 장소 미정'

/**
 * 지도 위치를 정하기 전에 들어가는 자리표시 좌표(서울시청). 서버는 좌표를 비워 둘 수 없어 이 값을 저장하고,
 * 화면은 이 값이면 "위치 미정" 으로 보고 지도·길안내를 보여 주지 않는다.
 */
export const DEFAULT_COORDS = { lat: 37.5662952, lng: 126.9779451 } as const

const COORD_EPSILON = 1e-6

/** 장소가 아직 정해지지 않았는가 — 지도·길안내를 숨기는 기준 */
export function isVenueUndecided(venue: { name: string }): boolean {
  const name = venue.name.trim()
  return name === '' || name === VENUE_PLACEHOLDER
}

/**
 * 지도 위치(좌표)를 아직 고르지 않았는가 — 자리표시 좌표 그대로이거나 좌표가 올바르지 않을 때.
 * 이 상태에서 지도·길안내를 보여 주면 하객을 엉뚱한 곳(서울시청)으로 보내게 된다.
 */
export function isVenueLocationUnset(venue: { lat: number; lng: number }): boolean {
  if (!Number.isFinite(venue.lat) || !Number.isFinite(venue.lng)) return true
  return (
    Math.abs(venue.lat - DEFAULT_COORDS.lat) < COORD_EPSILON && Math.abs(venue.lng - DEFAULT_COORDS.lng) < COORD_EPSILON
  )
}

/** 좌표 없이 이름·주소로 찾는 지도 검색 링크 (위치를 고르지 않은 청첩장용) */
export function venueSearchLinks(venue: { name: string; address: string }): { id: string; label: string; url: string }[] {
  const q = venue.address.trim() || venue.name.trim()
  if (!q) return []
  const enc = encodeURIComponent(q)
  return [
    { id: 'kakaomap', label: '카카오맵에서 찾기', url: `https://map.kakao.com/link/search/${enc}` },
    { id: 'navermap', label: '네이버지도에서 찾기', url: `https://map.naver.com/p/search/${enc}` },
  ]
}
