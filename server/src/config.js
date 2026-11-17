/**
 * 환경변수를 읽어 정규화된 설정 객체를 만든다.
 * 테스트에서는 createApp(overrides) 로 각 값을 덮어쓸 수 있다.
 */

/**
 * @typedef {object} RateLimitConfig
 * @property {number} windowMs 측정 구간 (ms)
 * @property {number} max 구간당 허용 쓰기 횟수
 */

/**
 * @typedef {object} Config
 * @property {number} port
 * @property {string} dbPath
 * @property {string[] | '*' | null} corsOrigin 허용 오리진 목록, '*', 또는 null(동일 오리진만)
 * @property {string | null} adminToken
 * @property {number} maxGuests
 * @property {boolean} trustProxy
 * @property {number} bodyLimit 요청 본문 최대 바이트
 * @property {RateLimitConfig} rateLimit
 */

/** @param {string | undefined} v @param {number} dflt */
function int(v, dflt) {
  if (v === undefined || v === '') return dflt
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : dflt
}

/** @param {string | undefined} v */
function bool(v) {
  return v === '1' || v === 'true' || v === 'yes'
}

/**
 * CORS_ORIGIN 파싱: "*" → '*', 비어있음 → null(동일 오리진만), 그 외 쉼표 구분 목록
 * @param {string | undefined} v
 * @returns {string[] | '*' | null}
 */
function parseCors(v) {
  if (v === undefined) return null
  const trimmed = v.trim()
  if (trimmed === '') return null
  if (trimmed === '*') return '*'
  return trimmed
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Config}
 */
export function loadConfig(env = process.env) {
  return {
    port: int(env.PORT, 8787),
    dbPath: env.DB_PATH && env.DB_PATH.trim() !== '' ? env.DB_PATH : './data/guestbook.db',
    corsOrigin: parseCors(env.CORS_ORIGIN),
    adminToken: env.ADMIN_TOKEN && env.ADMIN_TOKEN.trim() !== '' ? env.ADMIN_TOKEN : null,
    maxGuests: int(env.MAX_GUESTS, 1000),
    trustProxy: bool(env.TRUST_PROXY),
    bodyLimit: int(env.BODY_LIMIT, 8 * 1024),
    rateLimit: {
      windowMs: int(env.RATE_WINDOW_MS, 10 * 60 * 1000),
      max: int(env.RATE_MAX, 10),
    },
  }
}
