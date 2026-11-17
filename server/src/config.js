/**
 * 환경변수를 읽어 정규화된 설정 객체를 만든다.
 * 테스트에서는 createApp(overrides) 로 각 값을 덮어쓸 수 있다.
 */
import { dirname, join } from 'node:path'

/**
 * @typedef {object} RateLimitConfig
 * @property {number} windowMs 측정 구간 (ms)
 * @property {number} max 구간당 허용 횟수
 */

/**
 * @typedef {object} Config
 * @property {number} port
 * @property {string} dbPath
 * @property {string} uploadDir 사진 저장 폴더 (<uploadDir>/<slug>/<file>)
 * @property {string[] | '*' | null} corsOrigin 허용 오리진 목록, '*', 또는 null(동일 오리진만)
 * @property {string | null} adminToken 운영자 토큰(모든 청첩장에 관리자 권한)
 * @property {string | null} tokenSecret 로그인 토큰 서명 키. null 이면 DB 에 한 번 생성해 보관
 * @property {number} tokenTtlMs 로그인 토큰 유효 시간
 * @property {number} maxWeddings 서비스 전체 청첩장 수 상한
 * @property {number} maxGuests 청첩장당 방명록 수 상한
 * @property {number} maxPhotosPerWedding 청첩장당 사진 수 상한 (계약 PLATFORM_LIMITS.photosPerWedding)
 * @property {number} maxUploadBytes 서비스 전체 업로드 사진 바이트 합계 상한 (초과 시 업로드 507)
 * @property {number} photoOrphanGraceMs 저장된 내용이 참조하지 않는 사진을 정리하기 전 유예 시간
 * @property {number} requestTimeoutMs 요청(헤더+본문) 수신 제한 시간
 * @property {boolean} trustProxy
 * @property {number} bodyLimit 방명록 등 작은 JSON 본문 최대 바이트
 * @property {number} configBodyLimit 청첩장 생성/수정 JSON 본문 최대 바이트
 * @property {RateLimitConfig} rateLimit IP별 방명록 등록 제한 (검증을 통과한 POST 만 차감)
 * @property {RateLimitConfig} deleteRateLimit IP+항목별 삭제 비밀번호 실패 제한
 * @property {RateLimitConfig} createRateLimit IP별 청첩장 생성 제한
 * @property {RateLimitConfig} loginRateLimit IP+청첩장별 로그인 실패 제한
 * @property {RateLimitConfig} loginSlugRateLimit 청첩장별(IP 무관) 로그인 실패 제한
 * @property {RateLimitConfig} photoRateLimit IP별 사진 업로드 제한
 * @property {RateLimitConfig} geocodeRateLimit IP별 장소 검색 제한
 * @property {number} sseMaxClients 동시 SSE 연결 전체 상한
 * @property {number} sseMaxPerIp IP별 동시 SSE 연결 상한
 * @property {string} geocodeUrl Nominatim search 엔드포인트
 * @property {string} geocodeUserAgent 업스트림에 보내는 User-Agent (개인정보 없음)
 * @property {number} geocodeMinIntervalMs 업스트림 호출 사이 최소 간격
 * @property {number} geocodeTimeoutMs
 * @property {number} geocodeCacheSize
 * @property {string | null} publicOrigin 절대 URL 의 기준 오리진 (예: https://our.wedding). null 이면 요청 헤더에서 추정
 * @property {string | null} indexHtmlPath 프론트 index.html 파일 경로 (있으면 URL 보다 우선)
 * @property {string} indexHtmlUrl 프론트 index.html 을 가져올 주소
 * @property {number} indexHtmlTtlMs 템플릿 캐시 시간
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

/** @param {string | undefined} v @returns {string | null} 비어 있으면 null */
function str(v) {
  return v !== undefined && v.trim() !== '' ? v.trim() : null
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
  const dbPath = str(env.DB_PATH) ?? './data/guestbook.db'
  return {
    port: int(env.PORT, 8787),
    dbPath,
    // 기본은 DB 와 같은 폴더 아래 uploads/ → 볼륨 하나만 백업하면 된다.
    uploadDir: str(env.UPLOAD_DIR) ?? (dbPath === ':memory:' ? './data/uploads' : join(dirname(dbPath), 'uploads')),
    corsOrigin: parseCors(env.CORS_ORIGIN),
    adminToken: str(env.ADMIN_TOKEN),
    tokenSecret: str(env.TOKEN_SECRET),
    tokenTtlMs: int(env.TOKEN_TTL_HOURS, 12) * 60 * 60 * 1000,
    maxWeddings: int(env.MAX_WEDDINGS, 2000),
    maxGuests: int(env.MAX_GUESTS, 1000),
    maxPhotosPerWedding: 30,
    // DB 와 같은 볼륨을 쓰므로 디스크가 차면 모든 청첩장의 쓰기가 실패한다 → 사진 전체 용량에 상한을 둔다.
    maxUploadBytes: int(env.MAX_UPLOAD_BYTES, 5 * 1024 * 1024 * 1024),
    // 편집 중(아직 저장 전)인 업로드를 지우지 않도록 유예를 둔다.
    photoOrphanGraceMs: int(env.PHOTO_ORPHAN_GRACE_MS, 60 * 60 * 1000),
    requestTimeoutMs: int(env.REQUEST_TIMEOUT_MS, 60 * 1000),
    trustProxy: bool(env.TRUST_PROXY),
    bodyLimit: int(env.BODY_LIMIT, 8 * 1024),
    configBodyLimit: int(env.CONFIG_BODY_LIMIT, 64 * 1024),
    rateLimit: {
      windowMs: int(env.RATE_WINDOW_MS, 10 * 60 * 1000),
      // 예식장 Wi-Fi·통신사 CGNAT 처럼 하객 여러 명이 한 IP 를 쓰므로 넉넉하게 둔다.
      max: int(env.RATE_MAX, 40),
    },
    deleteRateLimit: {
      windowMs: int(env.DELETE_RATE_WINDOW_MS, 10 * 60 * 1000),
      max: int(env.DELETE_RATE_MAX, 5),
    },
    createRateLimit: {
      windowMs: int(env.CREATE_RATE_WINDOW_MS, 60 * 60 * 1000),
      max: int(env.CREATE_RATE_MAX, 5),
    },
    loginRateLimit: {
      windowMs: int(env.LOGIN_RATE_WINDOW_MS, 10 * 60 * 1000),
      max: int(env.LOGIN_RATE_MAX, 10),
    },
    loginSlugRateLimit: {
      windowMs: int(env.LOGIN_SLUG_RATE_WINDOW_MS, 10 * 60 * 1000),
      max: int(env.LOGIN_SLUG_RATE_MAX, 50),
    },
    photoRateLimit: {
      windowMs: int(env.PHOTO_RATE_WINDOW_MS, 10 * 60 * 1000),
      max: int(env.PHOTO_RATE_MAX, 120),
    },
    geocodeRateLimit: {
      windowMs: int(env.GEOCODE_RATE_WINDOW_MS, 60 * 1000),
      max: int(env.GEOCODE_RATE_MAX, 20),
    },
    sseMaxClients: int(env.SSE_MAX_CLIENTS, 500),
    sseMaxPerIp: int(env.SSE_MAX_PER_IP, 30),
    geocodeUrl: str(env.GEOCODE_URL) ?? 'https://nominatim.openstreetmap.org/search',
    geocodeUserAgent: str(env.GEOCODE_USER_AGENT) ?? 'mobile-wedding-invitation/1.0 (self-hosted venue search)',
    geocodeMinIntervalMs: int(env.GEOCODE_MIN_INTERVAL_MS, 1100),
    geocodeTimeoutMs: int(env.GEOCODE_TIMEOUT_MS, 8000),
    geocodeCacheSize: int(env.GEOCODE_CACHE_SIZE, 500),
    publicOrigin: str(env.PUBLIC_ORIGIN)?.replace(/\/+$/, '') ?? null,
    indexHtmlPath: str(env.INDEX_HTML_PATH),
    indexHtmlUrl: str(env.INDEX_HTML_URL) ?? 'http://web/index.html',
    indexHtmlTtlMs: int(env.INDEX_HTML_TTL_MS, 60 * 1000),
  }
}
