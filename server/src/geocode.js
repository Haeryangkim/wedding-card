/**
 * 장소/주소 → 좌표 검색. OpenStreetMap Nominatim search 를 서버가 대신 호출한다.
 *  - 이용 정책 준수: 식별 가능한 User-Agent, 업스트림 호출 사이 최소 1초 간격(전역 직렬 큐), 결과 캐시
 *  - 하객/사용자의 IP·쿠키 등 개인정보는 업스트림에 전달하지 않는다(검색어만 전달)
 *  - 업스트림 주소는 GEOCODE_URL 로 바꿀 수 있어 테스트는 로컬 가짜 서버를 쓴다
 */

/**
 * @typedef {object} GeocodeResult
 * @property {string} name
 * @property {string} address
 * @property {number} lat
 * @property {number} lng
 */

export class GeocodeError extends Error {
  /** @param {'busy' | 'upstream'} kind @param {string} message */
  constructor(kind, message) {
    super(message)
    this.kind = kind
  }
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_WAITING = 8

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    if (typeof t.unref === 'function') t.unref()
  })
}

/**
 * Nominatim display_name("시청, 110, 세종대로, 중구, 서울특별시, 04524, 대한민국")을
 * 한국식 순서("서울특별시 중구 세종대로 110")로 바꾼다. 형태가 예상과 다르면 원문을 그대로 쓴다.
 * @param {string} displayName @param {string} name
 */
function koreanAddress(displayName, name) {
  let parts = displayName.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2 || parts[parts.length - 1] !== '대한민국') return displayName
  parts = parts.slice(0, -1).filter((p) => !/^\d{5}$/.test(p))
  if (parts.length > 1 && parts[0] === name) parts = parts.slice(1)
  return parts.reverse().join(' ') || displayName
}

/** @param {unknown} json @returns {GeocodeResult[]} */
export function mapNominatim(json) {
  if (!Array.isArray(json)) throw new Error('unexpected upstream payload')
  /** @type {GeocodeResult[]} */
  const out = []
  for (const item of json) {
    if (typeof item !== 'object' || item === null) continue
    const lat = Number(item.lat)
    const lng = Number(item.lon)
    const display = typeof item.display_name === 'string' ? item.display_name : ''
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
    const name = (typeof item.name === 'string' && item.name.trim()) || display.split(',')[0]?.trim() || ''
    if (!name && !display) continue
    out.push({ name: name.slice(0, 120), address: koreanAddress(display, name).slice(0, 200), lat, lng })
    if (out.length >= 6) break
  }
  return out
}

/**
 * @param {{ url: string, userAgent: string, minIntervalMs: number, timeoutMs: number, cacheSize: number }} opts
 */
export function createGeocoder(opts) {
  /** @type {Map<string, { at: number, results: GeocodeResult[] }>} 삽입 순서 = LRU 순서 */
  const cache = new Map()
  /** @type {Promise<unknown>} 업스트림 호출을 한 줄로 세우는 체인 */
  let chain = Promise.resolve()
  let lastCall = 0
  let waiting = 0

  /** @param {string} key */
  function cached(key) {
    const hit = cache.get(key)
    if (!hit) return null
    if (Date.now() - hit.at > CACHE_TTL_MS) {
      cache.delete(key)
      return null
    }
    cache.delete(key) // 최근 사용으로 갱신
    cache.set(key, hit)
    return hit.results
  }

  /** @param {string} key @param {GeocodeResult[]} results */
  function remember(key, results) {
    cache.delete(key)
    cache.set(key, { at: Date.now(), results })
    while (cache.size > opts.cacheSize) {
      const oldest = cache.keys().next().value
      if (oldest === undefined) break
      cache.delete(oldest)
    }
  }

  /** @param {string} q @returns {Promise<GeocodeResult[]>} */
  async function fetchUpstream(q) {
    const url = new URL(opts.url)
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('countrycodes', 'kr')
    url.searchParams.set('accept-language', 'ko')
    url.searchParams.set('limit', '6')
    let res
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': opts.userAgent, Accept: 'application/json', 'Accept-Language': 'ko' },
        signal: AbortSignal.timeout(opts.timeoutMs),
        redirect: 'error',
      })
    } catch (err) {
      throw new GeocodeError('upstream', `geocode upstream unreachable: ${String(/** @type {any} */ (err)?.message ?? err)}`)
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {})
      throw new GeocodeError('upstream', `geocode upstream status ${res.status}`)
    }
    try {
      return mapNominatim(await res.json())
    } catch (err) {
      throw new GeocodeError('upstream', `geocode upstream payload: ${String(/** @type {any} */ (err)?.message ?? err)}`)
    }
  }

  return {
    /**
     * @param {string} query 이미 트림·길이 검사를 마친 검색어
     * @returns {Promise<GeocodeResult[]>}
     */
    async search(query) {
      const key = query.toLowerCase().replace(/\s+/g, ' ')
      const hit = cached(key)
      if (hit) return hit
      if (waiting >= MAX_WAITING) throw new GeocodeError('busy', 'geocode queue full')

      waiting++
      const run = chain.then(async () => {
        try {
          // 줄 서 있는 동안 같은 검색어가 채워졌을 수 있다.
          const again = cached(key)
          if (again) return again
          const wait = lastCall + opts.minIntervalMs - Date.now()
          if (wait > 0) await sleep(wait)
          lastCall = Date.now()
          const results = await fetchUpstream(query)
          remember(key, results)
          return results
        } finally {
          waiting--
        }
      })
      chain = run.catch(() => {})
      return run
    },
    /** 테스트/진단용 */
    get cacheSize() {
      return cache.size
    },
  }
}

/** @typedef {ReturnType<typeof createGeocoder>} Geocoder */
