/**
 * HTTP 공용 헬퍼: CORS, 보안 헤더, JSON 응답, 본문 읽기, 클라이언트 IP.
 */

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
}

const ALLOW_METHODS = 'GET, POST, PUT, DELETE, OPTIONS'
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
 * JSON 이 아닌 응답(HTML, 캘린더, 이미지 등)을 보낸다.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {string | Buffer} body
 * @param {Record<string, string>} headers Content-Type 포함
 */
export function sendRaw(res, status, body, headers) {
  const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers, 'Content-Length': buf.length })
  res.end(buf)
}

/**
 * 크기 제한을 두고 요청 본문을 바이트로 읽는다(스트리밍 중 한도 검사). 한도를 넘으면 더 쌓지 않고
 * 끝까지 흘려보낸 뒤 tooLarge 로 응답한다(응답 직전 소켓을 끊어 클라이언트가 413 을 못 받는 상황 방지).
 * 단, 과도하게 큰 업로드는 하드캡에서 소켓을 끊는다.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} limit 최대 바이트
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, tooLarge: boolean }>}
 */
export function readBytes(req, limit) {
  return new Promise((resolve) => {
    let size = 0
    let over = false
    const hardCap = limit + Math.max(256 * 1024, limit)
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
    req.on('end', () => (over ? done({ ok: false, tooLarge: true }) : done({ ok: true, buffer: Buffer.concat(chunks) })))
    req.on('error', () => done({ ok: false, tooLarge: false }))
    req.on('aborted', () => done({ ok: false, tooLarge: false }))
  })
}

/**
 * 크기 제한을 두고 요청 본문을 UTF-8 텍스트로 읽는다.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} limit 최대 바이트
 * @returns {Promise<{ ok: true, text: string } | { ok: false, tooLarge: boolean }>}
 */
export async function readBody(req, limit) {
  const r = await readBytes(req, limit)
  return r.ok ? { ok: true, text: r.buffer.toString('utf8') } : r
}

/**
 * JSON 본문을 읽어 파싱한다. 실패하면 바로 응답할 수 있는 status/error 를 돌려준다.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} limit
 * @param {{ allowEmpty?: boolean }} [opts] allowEmpty: 빈 본문을 {} 로 취급
 * @returns {Promise<{ ok: true, value: any } | { ok: false, status: number, error: string }>}
 */
export async function readJson(req, limit, opts = {}) {
  const body = await readBody(req, limit)
  if (!body.ok) {
    return body.tooLarge
      ? { ok: false, status: 413, error: '요청 본문이 너무 큽니다.' }
      : { ok: false, status: 400, error: '요청을 읽지 못했습니다.' }
  }
  if (opts.allowEmpty && body.text.trim() === '') return { ok: true, value: {} }
  try {
    return { ok: true, value: JSON.parse(body.text) }
  } catch {
    return { ok: false, status: 400, error: 'JSON 형식이 올바르지 않습니다.' }
  }
}

/** Authorization: Bearer <token> 의 토큰. 없으면 null @param {import('node:http').IncomingMessage} req */
export function bearer(req) {
  const auth = req.headers.authorization
  if (typeof auth !== 'string' || !/^Bearer /i.test(auth)) return null
  const token = auth.slice(7).trim()
  return token === '' ? null : token
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

/**
 * 절대 URL 을 만들 때 쓰는 사이트 오리진. PUBLIC_ORIGIN 이 있으면 그것을, 없으면 요청 헤더에서 추정한다
 * (TRUST_PROXY 일 때만 X-Forwarded-Proto / X-Forwarded-Host 를 본다). 이상한 Host 값은 버린다.
 * @param {import('node:http').IncomingMessage} req
 * @param {{ publicOrigin: string | null, trustProxy: boolean }} config
 * @returns {string} 끝에 슬래시 없는 오리진. 알 수 없으면 ''
 */
export function requestOrigin(req, config) {
  if (config.publicOrigin) return config.publicOrigin
  let proto = 'http'
  let host = lastHeader(req.headers.host)
  if (config.trustProxy) {
    const fp = lastHeader(req.headers['x-forwarded-proto'])?.split(',').pop()?.trim().toLowerCase()
    if (fp === 'https' || fp === 'http') proto = fp
    const fh = lastHeader(req.headers['x-forwarded-host'])?.split(',').pop()?.trim()
    if (fh) host = fh
  }
  if (!host || !/^(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i.test(host)) return ''
  return `${proto}://${host}`
}
