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
  const deleteLimiter = new RateLimiter(config.deleteRateLimit)
  /** @type {Map<string, number>} IP별 열린 SSE 연결 수 */
  const sseByIp = new Map()
  const deps = { config, db, broker, limiter, deleteLimiter, sseByIp, log }

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
    deleteLimiter.stop()
    await new Promise((resolve) => server.close(() => resolve(undefined)))
    db.close()
  }

  return { server, config, db, broker, limiter, deleteLimiter, close }
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{ config: import('./config.js').Config, db: import('./db.js').Db, broker: Broker, limiter: RateLimiter, deleteLimiter: RateLimiter, sseByIp: Map<string, number>, log: (l: string) => void }} deps
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

/** @param {import('node:http').ServerResponse} res @param {Record<string,string>} cors */
function tooMany(res, cors) {
  return send(res, 429, { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' }, cors)
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
  // 이미 한도에 도달한 IP 는 본문을 읽기 전에 거절한다(차감 없음).
  if (limiter.isLimited(ip)) return tooMany(res, cors)

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

  // 검증을 통과해 실제로 등록될 요청만 한도에서 차감한다(400/409/413 은 무료).
  if (!limiter.take(ip)) return tooMany(res, cors)

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
  const { config, db, broker, deleteLimiter } = deps

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

  // 비밀번호 대입 방지: (IP, 항목) 단위로 "틀린 시도"만 센다. 등록 한도와는 별개이고
  // 관리자 토큰 삭제·성공한 삭제는 차감하지 않는다.
  const attemptKey = `${clientIp(req, config.trustProxy)}:${id}`
  if (deleteLimiter.isLimited(attemptKey)) return tooMany(res, cors)

  const ok = await verifyPassword(password, secret.pw_hash, secret.pw_salt)
  if (!ok) {
    deleteLimiter.take(attemptKey)
    return send(res, 403, { error: '비밀번호가 일치하지 않습니다.' }, cors)
  }

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
  const { config, broker, sseByIp } = deps
  // 연결 수 상한: 전체 + IP별. 초과하면 503 → 웹 클라이언트는 폴링으로 내려간다.
  const ip = clientIp(req, config.trustProxy)
  const mine = sseByIp.get(ip) ?? 0
  if (broker.size >= config.sseMaxClients || mine >= config.sseMaxPerIp) {
    return send(res, 503, { error: '실시간 연결이 많습니다. 잠시 후 다시 시도해 주세요.' }, { ...cors, 'Retry-After': '30' })
  }
  sseByIp.set(ip, mine + 1)
  let released = false
  const release = () => {
    if (released) return
    released = true
    const n = (sseByIp.get(ip) ?? 1) - 1
    if (n <= 0) sseByIp.delete(ip)
    else sseByIp.set(ip, n)
  }
  res.on('close', release)
  res.on('error', release)

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
  broker.add(res)
}
