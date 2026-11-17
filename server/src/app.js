/**
 * 모바일 청첩장 플랫폼 API. web/src/platform/contract.ts 의 계약을 구현한다.
 *
 *   GET    /api/health                              -> 200 { ok: true }
 *   GET    /api/geocode?q=                          -> 200 GeocodeResult[]
 *   GET    /api/weddings/:slug/availability         -> 200 { available, reason? }
 *   POST   /api/weddings                            -> 201 { wedding, token, expiresAt }
 *   GET    /api/weddings/:slug                      -> 200 WeddingRecord | 404
 *   PUT    /api/weddings/:slug            (auth)    -> 200 WeddingRecord
 *   DELETE /api/weddings/:slug            (auth)    -> 204
 *   POST   /api/weddings/:slug/login                -> 200 { token, expiresAt } | 403
 *   PUT    /api/weddings/:slug/password   (auth)    -> 204
 *   POST   /api/weddings/:slug/photos     (auth)    -> 201 { url } | 409(장수 상한) | 507(서비스 저장 공간 상한)
 *   DELETE /api/weddings/:slug/photos/:file (auth)  -> 204
 *   GET    /api/weddings/:slug/guests               -> 200 GuestEntry[]
 *   POST   /api/weddings/:slug/guests               -> 201 GuestEntry
 *   DELETE /api/weddings/:slug/guests/:id           -> 204 | 403 | 404   ({ password } 또는 관리 토큰)
 *   GET    /api/weddings/:slug/events  (SSE)        -> event: added / removed, 하트비트 주석
 *   GET    /uploads/:slug/:file                     -> 이미지
 *   GET    /w/:slug , /w/:slug/edit , /w/:slug/pixel -> OG 태그가 주입된 index.html
 *   GET    /w/:slug/wedding.ics                     -> text/calendar
 *
 * createApp() 은 아직 listen 하지 않은 http.Server 를 돌려주어 테스트가 임의 포트로 띄울 수 있다.
 */
import http from 'node:http'
import { loadConfig } from './config.js'
import { openDb } from './db.js'
import { Broker } from './sse.js'
import { RateLimiter } from './ratelimit.js'
import { hashPassword, verifyPassword } from './password.js'
import { validateNewGuest, extractPassword } from './validate.js'
import { SLUG_PATTERN } from './wedding-config.js'
import { createTokens, resolveTokenSecret } from './token.js'
import { createGeocoder } from './geocode.js'
import { createTemplateSource } from './pages.js'
import { corsHeaders, preflightHeaders, send, readJson, clientIp, securityHeaders } from './http.js'
import { isOwner, tooMany } from './auth.js'
import {
  handleAvailability,
  handleCreateWedding,
  handleGetWedding,
  handleUpdateWedding,
  handleDeleteWedding,
  handleLogin,
  handleChangePassword,
} from './weddings.js'
import { handleUploadPhoto, handleDeletePhoto, handleServeUpload } from './photos.js'
import { handleGeocode, handlePage } from './public.js'

/**
 * @typedef {object} Deps
 * @property {import('./config.js').Config} config
 * @property {import('./db.js').Db} db
 * @property {Broker} broker
 * @property {import('./token.js').Tokens} tokens
 * @property {import('./geocode.js').Geocoder} geocoder
 * @property {ReturnType<typeof createTemplateSource>} templates
 * @property {RateLimiter} limiter IP별 방명록 등록
 * @property {RateLimiter} deleteLimiter (IP, 방명록 글)별 삭제 비밀번호 실패
 * @property {RateLimiter} createLimiter IP별 청첩장 생성
 * @property {RateLimiter} loginLimiter (IP, 청첩장)별 로그인 실패
 * @property {RateLimiter} loginSlugLimiter 청첩장별 로그인 실패 (IP 를 바꿔 가며 오는 대입 공격 상한)
 * @property {RateLimiter} photoLimiter IP별 사진 업로드
 * @property {RateLimiter} geocodeLimiter IP별 장소 검색
 * @property {Map<string, number>} sseByIp IP별 열린 SSE 연결 수
 * @property {(line: string) => void} log
 */

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
  const createLimiter = new RateLimiter(config.createRateLimit)
  const loginLimiter = new RateLimiter(config.loginRateLimit)
  const loginSlugLimiter = new RateLimiter(config.loginSlugRateLimit)
  const photoLimiter = new RateLimiter(config.photoRateLimit)
  const geocodeLimiter = new RateLimiter(config.geocodeRateLimit)
  const limiters = [limiter, deleteLimiter, createLimiter, loginLimiter, loginSlugLimiter, photoLimiter, geocodeLimiter]
  const tokens = createTokens(resolveTokenSecret(config.tokenSecret, db), config.tokenTtlMs)
  const geocoder = createGeocoder({
    url: config.geocodeUrl,
    userAgent: config.geocodeUserAgent,
    minIntervalMs: config.geocodeMinIntervalMs,
    timeoutMs: config.geocodeTimeoutMs,
    cacheSize: config.geocodeCacheSize,
  })
  const templates = createTemplateSource(config, log)
  /** @type {Deps} */
  const deps = {
    config,
    db,
    broker,
    tokens,
    geocoder,
    templates,
    limiter,
    deleteLimiter,
    createLimiter,
    loginLimiter,
    loginSlugLimiter,
    photoLimiter,
    geocodeLimiter,
    sseByIp: new Map(),
    log,
  }

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
        if (res.headersSent) res.destroy()
        else send(res, 500, { error: '서버 오류가 발생했습니다.' }, corsHeaders(req, config))
      } catch {
        /* 이미 응답이 시작된 경우 무시 */
      }
      log(JSON.stringify({ t: new Date().toISOString(), level: 'error', msg: String(err?.stack ?? err) }))
    })
  })

  // 본문을 아주 천천히 보내며 요청을 오래 붙잡지 못하게 한다(프록시 없이 직접 닿는 경우).
  // 응답 스트림(SSE)에는 적용되지 않는다.
  server.requestTimeout = config.requestTimeoutMs

  async function close() {
    broker.closeAll()
    for (const l of limiters) l.stop()
    await new Promise((resolve) => server.close(() => resolve(undefined)))
    db.close()
  }

  return { server, config, db, broker, limiter, deleteLimiter, loginLimiter, loginSlugLimiter, tokens, geocoder, close }
}

/** 경로 조각 디코딩. 깨진 퍼센트 인코딩이면 null @param {string | undefined} s */
function decode(s) {
  if (s === undefined) return null
  try {
    return decodeURIComponent(s)
  } catch {
    return null
  }
}

/** @param {import('node:http').ServerResponse} res @param {Record<string,string>} cors */
function methodNotAllowed(res, cors) {
  return send(res, 405, { error: '허용되지 않은 메서드입니다.' }, { ...cors, Allow: 'GET, POST, PUT, DELETE, OPTIONS' })
}

/** @param {import('node:http').ServerResponse} res @param {Record<string,string>} cors */
function notFound(res, cors) {
  return send(res, 404, { error: '찾을 수 없습니다.' }, cors)
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {Deps} deps
 */
async function handle(req, res, deps) {
  const { config } = deps
  const cors = corsHeaders(req, config)
  // 경로는 정규화하지 않고 글자 그대로 조각내어 엄격히 대조한다(.. 등은 어떤 규칙에도 맞지 않아 404).
  const rawUrl = req.url ?? '/'
  const q = rawUrl.indexOf('?')
  const path = q < 0 ? rawUrl : rawUrl.slice(0, q)
  const query = new URLSearchParams(q < 0 ? '' : rawUrl.slice(q + 1))
  const method = req.method ?? 'GET'
  const segs = path.split('/').slice(1)

  if (method === 'OPTIONS') {
    return send(res, 204, null, { ...cors, ...preflightHeaders() })
  }

  if (segs[0] === 'uploads') {
    if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed(res, cors)
    if (segs.length !== 3) return notFound(res, cors)
    return handleServeUpload(req, res, deps, cors, decode(segs[1]), decode(segs[2]))
  }

  if (segs[0] === 'w') {
    if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed(res, cors)
    const rest = segs.slice(2)
    if (rest.length > 0 && rest[rest.length - 1] === '') rest.pop() // 끝 슬래시 허용
    return handlePage(req, res, deps, cors, decode(segs[1]), rest)
  }

  if (segs[0] !== 'api') return notFound(res, cors)

  if (path === '/api/health') {
    if (method !== 'GET') return methodNotAllowed(res, cors)
    return send(res, 200, { ok: true }, cors)
  }

  if (path === '/api/geocode') {
    if (method !== 'GET') return methodNotAllowed(res, cors)
    return handleGeocode(req, res, deps, cors, query)
  }

  if (segs[1] !== 'weddings') return notFound(res, cors)

  if (segs.length === 2) {
    if (method !== 'POST') return methodNotAllowed(res, cors)
    return handleCreateWedding(req, res, deps, cors)
  }

  const slug = decode(segs[2])
  const rest = segs.slice(3)
  const at = rest.join('/')

  if (at === 'availability') {
    if (method !== 'GET') return methodNotAllowed(res, cors)
    return handleAvailability(res, deps, cors, slug)
  }

  // 이 아래는 모두 "존재하는 청첩장" 에 대한 요청이다.
  if (slug === null || !SLUG_PATTERN.test(slug) || !deps.db.weddingExists(slug)) {
    return send(res, 404, { error: '청첩장을 찾을 수 없습니다.' }, cors)
  }

  if (rest.length === 0) {
    if (method === 'GET') return handleGetWedding(res, deps, cors, slug)
    if (method === 'PUT') return handleUpdateWedding(req, res, deps, cors, slug)
    if (method === 'DELETE') return handleDeleteWedding(req, res, deps, cors, slug)
    return methodNotAllowed(res, cors)
  }
  if (at === 'login') {
    if (method !== 'POST') return methodNotAllowed(res, cors)
    return handleLogin(req, res, deps, cors, slug)
  }
  if (at === 'password') {
    if (method !== 'PUT') return methodNotAllowed(res, cors)
    return handleChangePassword(req, res, deps, cors, slug)
  }
  if (at === 'photos') {
    if (method !== 'POST') return methodNotAllowed(res, cors)
    return handleUploadPhoto(req, res, deps, cors, slug)
  }
  if (rest[0] === 'photos' && rest.length === 2) {
    if (method !== 'DELETE') return methodNotAllowed(res, cors)
    return handleDeletePhoto(req, res, deps, cors, slug, decode(rest[1]))
  }
  if (at === 'guests') {
    if (method === 'GET') return send(res, 200, deps.db.list(slug), cors)
    if (method === 'POST') return handlePostGuest(req, res, deps, cors, slug)
    return methodNotAllowed(res, cors)
  }
  if (rest[0] === 'guests' && rest.length === 2) {
    if (method !== 'DELETE') return methodNotAllowed(res, cors)
    return handleDeleteGuest(req, res, deps, cors, slug, decode(rest[1]))
  }
  if (at === 'events') {
    if (method !== 'GET') return methodNotAllowed(res, cors)
    return handleSse(req, res, deps, cors, slug)
  }

  return notFound(res, cors)
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {Deps} deps
 * @param {Record<string,string>} cors
 * @param {string} slug
 */
async function handlePostGuest(req, res, deps, cors, slug) {
  const { config, db, broker, limiter } = deps
  const ip = clientIp(req, config.trustProxy)
  // 이미 한도에 도달한 IP 는 본문을 읽기 전에 거절한다(차감 없음).
  if (limiter.isLimited(ip)) return tooMany(res, cors)

  const body = await readJson(req, config.bodyLimit)
  if (!body.ok) return send(res, body.status, { error: body.error }, cors)

  const result = validateNewGuest(body.value)
  if (!result.ok) return send(res, 400, { error: result.error }, cors)

  if (db.count(slug) >= config.maxGuests) {
    return send(res, 409, { error: '방명록이 가득 찼습니다.' }, cors)
  }

  // 검증을 통과해 실제로 등록될 요청만 한도에서 차감한다(400/409/413 은 무료).
  if (!limiter.take(ip)) return tooMany(res, cors)

  const secret = await hashPassword(result.value.password)
  // 해시를 계산하는 사이 청첩장이 지워졌으면 주인 없는 글을 남기지 않는다.
  if (!db.weddingExists(slug)) return send(res, 404, { error: '청첩장을 찾을 수 없습니다.' }, cors)
  const entry = db.insert(slug, result.value, secret)
  broker.broadcast(slug, 'added', entry)
  return send(res, 201, entry, cors)
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {Deps} deps
 * @param {Record<string,string>} cors
 * @param {string} slug
 * @param {string | null} id
 */
async function handleDeleteGuest(req, res, deps, cors, slug, id) {
  const { config, db, broker, deleteLimiter } = deps

  // 다른 청첩장의 글 id 는 여기서 보이지 않는다(404).
  const secret = id === null ? undefined : db.findSecret(slug, id)
  if (!secret || id === null) return send(res, 404, { error: '방명록을 찾을 수 없습니다.' }, cors)

  // 요청 본문은 항상 읽어 스트림을 소비한다(관리자 경로에서는 사용하지 않음).
  const body = await readJson(req, config.bodyLimit, { allowEmpty: true })

  // 청첩장 주인(로그인 토큰) 또는 운영자 토큰: 비밀번호 없이 삭제
  if (isOwner(req, deps, slug)) {
    db.delete(slug, id)
    broker.broadcast(slug, 'removed', { id })
    return send(res, 204, null, cors)
  }

  if (!body.ok) return send(res, body.status, { error: body.error }, cors)
  const password = extractPassword(body.value)
  if (!password) return send(res, 400, { error: '비밀번호가 필요합니다.' }, cors)

  // 비밀번호 대입 방지: (IP, 항목) 단위로 "틀린 시도"만 센다. 등록 한도와는 별개이고
  // 관리자 삭제·성공한 삭제는 차감하지 않는다.
  const attemptKey = `${clientIp(req, config.trustProxy)}:${id}`
  // 해시(비동기) 전에 자리를 동기적으로 예약한다 → 동시에 보낸 요청으로 한도를 우회할 수 없다.
  if (!deleteLimiter.begin(attemptKey)) return tooMany(res, cors)
  let ok = false
  try {
    ok = await verifyPassword(password, secret.pw_hash, secret.pw_salt)
  } finally {
    deleteLimiter.end(attemptKey, !ok)
  }
  if (!ok) return send(res, 403, { error: '비밀번호가 일치하지 않습니다.' }, cors)

  db.delete(slug, id)
  broker.broadcast(slug, 'removed', { id })
  return send(res, 204, null, cors)
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {Deps} deps
 * @param {Record<string,string>} cors
 * @param {string} slug
 */
function handleSse(req, res, deps, cors, slug) {
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
  broker.add(slug, res)
}
