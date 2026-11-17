/**
 * 픽셀 방명록 API. web/src/guestbook/types.ts 의 REST + SSE 계약을 구현한다.
 *
 *   GET    /api/health            -> 200 { ok: true }
 *   GET    /api/guests            -> 200 GuestEntry[]            (createdAt 오름차순)
 *   POST   /api/guests            -> 201 GuestEntry              (NewGuestInput)
 *   DELETE /api/guests/:id        -> 204 | 403 | 404            ({ password } 또는 Admin Bearer)
 *   GET    /api/events  (SSE)     -> event: added / removed, 하트비트 주석
 *
 * createApp() 은 아직 listen 하지 않은 http.Server 를 돌려주어 테스트가 임의 포트로 띄울 수 있다.
 */
import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { loadConfig } from './config.js'
import { openDb } from './db.js'
import { Broker } from './sse.js'
import { RateLimiter } from './ratelimit.js'
import { hashPassword, verifyPassword } from './password.js'
import { validateNewGuest, extractPassword } from './validate.js'
import {
  corsHeaders,
  preflightHeaders,
  send,
  readBody,
  clientIp,
  securityHeaders,
} from './http.js'

const GUEST_ID_RE = /^\/api\/guests\/([^/]+)$/

/** @param {string} a @param {string} b 상수 시간 문자열 비교 */
function safeEqualStr(a, b) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * @param {Partial<import('./config.js').Config> & { logger?: (line: string) => void }} [overrides]
 */
export function createApp(overrides = {}) {
  const { logger, ...configOverrides } = overrides
  /** @type {import('./config.js').Config} */
  const config = { ...loadConfig(), ...configOverrides }
  const log = logger ?? ((/** @type {string} */ line) => process.stdout.write(line + '\n'))

  const db = openDb(config.dbPath)
  const broker = new Broker()
  const limiter = new RateLimiter(config.rateLimit)
  const deps = { config, db, broker, limiter, log }

  const server = http.createServer((req, res) => {
    const started = Date.now()
    res.on('finish', () => {
      const ip = clientIp(req, config.trustProxy)
      log(
        JSON.stringify({
          t: new Date().toISOString(),
          method: req.method,
          path: (req.url ?? '').split('?')[0],
          status: res.statusCode,
          ms: Date.now() - started,
          ip,
        }),
      )
    })
    handle(req, res, deps).catch((err) => {
      try {
        send(res, 500, { error: '서버 오류가 발생했습니다.' }, corsHeaders(req, config))
      } catch {
        /* 이미 응답이 시작된 경우 무시 */
      }
      log(JSON.stringify({ t: new Date().toISOString(), level: 'error', msg: String(err?.stack ?? err) }))
    })
  })

  async function close() {
    broker.closeAll()
    limiter.stop()
    await new Promise((resolve) => server.close(() => resolve(undefined)))
    db.close()
  }

  return { server, config, db, broker, limiter, close }
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{ config: import('./config.js').Config, db: import('./db.js').Db, broker: Broker, limiter: RateLimiter, log: (l: string) => void }} deps
 */
async function handle(req, res, deps) {
  const { config } = deps
  const cors = corsHeaders(req, config)
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  const method = req.method ?? 'GET'

  if (method === 'OPTIONS') {
    return send(res, 204, null, { ...cors, ...preflightHeaders() })
  }

  if (path === '/api/health') {
    if (method !== 'GET') return methodNotAllowed(res, cors)
    return send(res, 200, { ok: true }, cors)
  }

  if (path === '/api/guests') {
    if (method === 'GET') return send(res, 200, deps.db.list(), cors)
    if (method === 'POST') return handlePost(req, res, deps, cors)
    return methodNotAllowed(res, cors)
  }

  const idMatch = GUEST_ID_RE.exec(path)
  if (idMatch) {
    if (method !== 'DELETE') return methodNotAllowed(res, cors)
    return handleDelete(req, res, deps, cors, decodeURIComponent(idMatch[1]))
  }

  if (path === '/api/events') {
    if (method !== 'GET') return methodNotAllowed(res, cors)
    return handleSse(req, res, deps, cors)
  }

  return send(res, 404, { error: '찾을 수 없습니다.' }, cors)
}

/** @param {import('node:http').ServerResponse} res @param {Record<string,string>} cors */
function methodNotAllowed(res, cors) {
  return send(res, 405, { error: '허용되지 않은 메서드입니다.' }, { ...cors, Allow: 'GET, POST, DELETE, OPTIONS' })
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {any} deps
 * @param {Record<string,string>} cors
 */
async function handlePost(req, res, deps, cors) {
  const { config, db, broker, limiter } = deps
  const ip = clientIp(req, config.trustProxy)
  if (!limiter.take(ip)) {
    return send(res, 429, { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' }, cors)
  }

  const body = await readBody(req, config.bodyLimit)
  if (!body.ok) {
    return body.tooLarge
      ? send(res, 413, { error: '요청 본문이 너무 큽니다.' }, cors)
      : send(res, 400, { error: '요청을 읽지 못했습니다.' }, cors)
  }

  let parsed
  try {
    parsed = JSON.parse(body.text)
  } catch {
    return send(res, 400, { error: 'JSON 형식이 올바르지 않습니다.' }, cors)
  }

  const result = validateNewGuest(parsed)
  if (!result.ok) return send(res, 400, { error: result.error }, cors)

  if (db.count() >= config.maxGuests) {
    return send(res, 409, { error: '방명록이 가득 찼습니다.' }, cors)
  }

  const secret = await hashPassword(result.value.password)
  const entry = db.insert(result.value, secret)
  broker.broadcast('added', entry)
  return send(res, 201, entry, cors)
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {any} deps
 * @param {Record<string,string>} cors
 * @param {string} id
 */
async function handleDelete(req, res, deps, cors, id) {
  const { config, db, broker, limiter } = deps
  const ip = clientIp(req, config.trustProxy)
  if (!limiter.take(ip)) {
    return send(res, 429, { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' }, cors)
  }

  const secret = db.findSecret(id)
  if (!secret) return send(res, 404, { error: '방명록을 찾을 수 없습니다.' }, cors)

  // 요청 본문은 항상 읽어 스트림을 소비한다(관리자 경로에서는 사용하지 않음).
  const body = await readBody(req, config.bodyLimit)
  if (!body.ok) {
    return body.tooLarge
      ? send(res, 413, { error: '요청 본문이 너무 큽니다.' }, cors)
      : send(res, 400, { error: '요청을 읽지 못했습니다.' }, cors)
  }

  // 관리자 토큰: 비밀번호 없이 임의 항목 삭제
  const auth = req.headers.authorization
  if (config.adminToken && typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim()
    if (safeEqualStr(token, config.adminToken)) {
      db.delete(id)
      broker.broadcast('removed', { id })
      return send(res, 204, null, cors)
    }
  }

  let parsed = {}
  if (body.text.trim() !== '') {
    try {
      parsed = JSON.parse(body.text)
    } catch {
      return send(res, 400, { error: 'JSON 형식이 올바르지 않습니다.' }, cors)
    }
  }
  const password = extractPassword(parsed)
  if (!password) return send(res, 400, { error: '비밀번호가 필요합니다.' }, cors)

  const ok = await verifyPassword(password, secret.pw_hash, secret.pw_salt)
  if (!ok) return send(res, 403, { error: '비밀번호가 일치하지 않습니다.' }, cors)

  db.delete(id)
  broker.broadcast('removed', { id })
  return send(res, 204, null, cors)
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {any} deps
 * @param {Record<string,string>} cors
 */
function handleSse(req, res, deps, cors) {
  res.writeHead(200, {
    ...securityHeaders,
    ...cors,
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
  req.socket.setTimeout(0)
  if (typeof res.socket?.setNoDelay === 'function') res.socket.setNoDelay(true)
  deps.broker.add(res)
}
