/**
 * HTTP 공용 헬퍼: CORS, 보안 헤더, JSON 응답, 본문 읽기, 클라이언트 IP.
 */

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
}

const ALLOW_METHODS = 'GET, POST, DELETE, OPTIONS'
const ALLOW_HEADERS = 'Content-Type, Authorization'

/** @param {string} origin */
function normalizeOrigin(origin) {
  return origin.replace(/\/+$/, '')
}

/**
 * 요청 오리진에 대한 CORS 헤더를 계산한다.
 * - corsOrigin '*'      → 모두 허용
 * - corsOrigin 목록     → 목록에 있는 오리진만 echo
 * - corsOrigin null     → CORS 헤더 없음(동일 오리진만 동작)
 * @param {import('node:http').IncomingMessage} req
 * @param {import('./config.js').Config} config
 * @returns {Record<string, string>}
 */
export function corsHeaders(req, config) {
  const allow = config.corsOrigin
  const origin = req.headers.origin
  if (allow === '*') {
    return { 'Access-Control-Allow-Origin': '*' }
  }
  if (Array.isArray(allow) && typeof origin === 'string' && allow.includes(normalizeOrigin(origin))) {
    return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
  }
  if (Array.isArray(allow)) {
    // 허용 목록은 있으나 매칭 안 됨: 캐시 분리를 위해 Vary 만 남긴다.
    return { Vary: 'Origin' }
  }
  return {}
}

/** 프리플라이트 응답 헤더 (CORS 헤더 위에 얹는다). */
export function preflightHeaders() {
  return {
    'Access-Control-Allow-Methods': ALLOW_METHODS,
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Max-Age': '600',
  }
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body null 이면 본문 없음
 * @param {Record<string, string>} [headers]
 */
export function send(res, status, body, headers = {}) {
  const base = { ...SECURITY_HEADERS, ...headers }
  if (body === null || body === undefined) {
    res.writeHead(status, base)
    res.end()
    return
  }
  const json = JSON.stringify(body)
  res.writeHead(status, {
    ...base,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  })
  res.end(json)
}

/** 보안 헤더만 노출용 */
export const securityHeaders = SECURITY_HEADERS

/**
 * 크기 제한을 두고 요청 본문을 읽는다. 한도를 넘으면 더 쌓지 않고 끝까지 흘려보낸 뒤
 * tooLarge 로 응답한다(응답 직전 소켓을 끊어 클라이언트가 413 을 못 받는 상황 방지).
 * 단, 과도하게 큰 업로드는 하드캡에서 소켓을 끊는다.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} limit 최대 바이트
 * @returns {Promise<{ ok: true, text: string } | { ok: false, tooLarge: boolean }>}
 */
export function readBody(req, limit) {
  return new Promise((resolve) => {
    let size = 0
    let over = false
    const hardCap = limit + 256 * 1024
    /** @type {Buffer[]} */
    let chunks = []
    let settled = false
    const done = (/** @type {any} */ v) => {
      if (settled) return
      settled = true
      resolve(v)
    }
    req.on('data', (chunk) => {
      size += chunk.length
      if (!over && size > limit) {
        over = true
        chunks = [] // 버퍼 비우고 이후는 버린다
      }
      if (over) {
        if (size > hardCap) {
          done({ ok: false, tooLarge: true })
          req.destroy()
        }
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () =>
      over
        ? done({ ok: false, tooLarge: true })
        : done({ ok: true, text: Buffer.concat(chunks).toString('utf8') }),
    )
    req.on('error', () => done({ ok: false, tooLarge: false }))
    req.on('aborted', () => done({ ok: false, tooLarge: false }))
  })
}

/** @param {string | string[] | undefined} v 헤더가 여러 번 오면 마지막(프록시가 쓴) 값 */
function lastHeader(v) {
  return Array.isArray(v) ? v[v.length - 1] : v
}

/**
 * 요청자의 IP. TRUST_PROXY 일 때만 프록시 헤더를 신뢰한다.
 * 클라이언트가 보낸 값이 섞일 수 있는 X-Forwarded-For 의 "첫" 주소는 절대 쓰지 않는다.
 * - X-Real-IP: 바로 앞 프록시(nginx)가 덮어쓴 피어 주소 → 우선 사용
 * - X-Forwarded-For: 바로 앞 프록시가 덧붙인 "마지막" 주소만 사용
 * @param {import('node:http').IncomingMessage} req
 * @param {boolean} trustProxy
 * @returns {string}
 */
export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const real = lastHeader(req.headers['x-real-ip'])?.trim()
    if (real) return real
    const raw = lastHeader(req.headers['x-forwarded-for'])
    if (raw) {
      const last = raw.split(',').pop()?.trim()
      if (last) return last
    }
  }
  return req.socket.remoteAddress ?? 'unknown'
}
