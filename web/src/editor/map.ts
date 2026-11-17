/** OpenStreetMap 미리보기 주소. 순수 함수 */

/** 좌표 주변(약 ±span 도)을 보여 주는 임베드 지도 주소. 좌표가 올바르지 않으면 null */
export function osmEmbedUrl(lat: number, lng: number, span = 0.004): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  const f = (n: number) => n.toFixed(6)
  const bbox = [f(lng - span * 1.4), f(lat - span), f(lng + span * 1.4), f(lat + span)].join('%2C')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${f(lat)}%2C${f(lng)}`
}

export function osmLinkUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
}

/** 폼의 문자열 좌표 → 숫자. 비었거나 범위를 벗어나면 null */
export function parseCoords(lat: string, lng: string): { lat: number; lng: number } | null {
  if (lat.trim() === '' || lng.trim() === '') return null
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null
  return { lat: a, lng: b }
}
