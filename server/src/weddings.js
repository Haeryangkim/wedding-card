/**
 * 청첩장 인스턴스: 주소 확인, 만들기, 조회, 로그인, 내용 수정, 비밀번호 변경, 삭제.
 */
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { send, readJson, clientIp } from './http.js'
import { hashPassword, verifyPassword } from './password.js'
import { checkSlug, checkAdminPassword, validateWeddingConfig } from './wedding-config.js'
import { isOwner, unauthorized, tooMany } from './auth.js'
import { sweepOrphanPhotos } from './photos.js'

/** @typedef {import('./app.js').Deps} Deps */
/** @typedef {import('node:http').IncomingMessage} Req */
/** @typedef {import('node:http').ServerResponse} Res */
/** @typedef {Record<string, string>} Cors */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * 본문이 정확히 허용된 키만 가진 객체인지 확인한다.
 * @param {unknown} body @param {string[]} keys
 * @returns {string | null} 오류 메시지 또는 null
 */
function shapeError(body, keys) {
  if (!isPlainObject(body)) return '요청 본문이 올바르지 않습니다.'
  for (const k of Object.keys(body)) if (!keys.includes(k)) return `알 수 없는 필드입니다: ${k}`
  return null
}

/** @param {Res} res @param {Deps} deps @param {Cors} cors @param {string | null} slug */
export function handleAvailability(res, deps, cors, slug) {
  const check = checkSlug(slug)
  if (!check.ok) return send(res, 200, { available: false, reason: check.reason }, cors)
  if (deps.db.weddingExists(/** @type {string} */ (slug))) {
    return send(res, 200, { available: false, reason: '이미 사용 중인 주소입니다.' }, cors)
  }
  return send(res, 200, { available: true }, cors)
}

/** @param {Req} req @param {Res} res @param {Deps} deps @param {Cors} cors */
export async function handleCreateWedding(req, res, deps, cors) {
  const { config, db, createLimiter, tokens } = deps
  const ip = clientIp(req, config.trustProxy)
  // 이미 한도에 도달한 IP 는 본문을 읽기 전에 거절한다(차감 없음).
  if (createLimiter.isLimited(ip)) return tooMany(res, cors)

  const body = await readJson(req, config.configBodyLimit)
  if (!body.ok) return send(res, body.status, { error: body.error }, cors)
  const shape = shapeError(body.value, ['slug', 'password', 'config'])
  if (shape) return send(res, 400, { error: shape }, cors)

  const { slug } = body.value
  const slugCheck = checkSlug(slug)
  if (!slugCheck.ok) return send(res, 400, { error: slugCheck.reason }, cors)
  if (db.weddingExists(slug)) return send(res, 409, { error: '이미 사용 중인 주소입니다.' }, cors)

  const pw = checkAdminPassword(body.value.password)
  if (!pw.ok) return send(res, 400, { error: pw.error }, cors)

  const cfg = validateWeddingConfig(body.value.config, { slug, photoExists: (file) => db.hasPhoto(slug, file) })
  if (!cfg.ok) return send(res, 400, { error: cfg.error }, cors)

  if (db.weddingCount() >= config.maxWeddings) {
    return send(res, 503, { error: '지금은 새 청첩장을 만들 수 없습니다. (서비스 정원 초과)' }, cors)
  }

  // 검증을 통과해 실제로 만들어질 요청만 한도에서 차감한다.
  if (!createLimiter.take(ip)) return tooMany(res, cors)

  const secret = await hashPassword(pw.value)
  // 해시를 계산하는 사이 같은 주소가 선점됐으면 INSERT OR IGNORE 가 null 을 돌려준다.
  const wedding = db.insertWedding(slug, cfg.value, secret)
  if (!wedding) return send(res, 409, { error: '이미 사용 중인 주소입니다.' }, cors)

  return send(res, 201, { wedding, ...tokens.sign(slug, secret.salt) }, cors)
}

/** @param {Res} res @param {Deps} deps @param {Cors} cors @param {string} slug */
export function handleGetWedding(res, deps, cors, slug) {
  const wedding = deps.db.getWedding(slug)
  if (!wedding) return send(res, 404, { error: '청첩장을 찾을 수 없습니다.' }, cors)
  return send(res, 200, wedding, { ...cors, 'Cache-Control': 'no-cache' })
}

/** @param {Req} req @param {Res} res @param {Deps} deps @param {Cors} cors @param {string} slug */
export async function handleLogin(req, res, deps, cors, slug) {
  const { config, db, loginLimiter, loginSlugLimiter, tokens } = deps
  // 비밀번호 대입 방지: "틀린 시도"만 센다. (IP, 청첩장) 단위 + IP 를 바꿔 가며 오는 공격을 묶는 청첩장 단위.
  const attemptKey = `${clientIp(req, config.trustProxy)}:${slug}`
  // 이미 잠긴 요청은 본문을 읽기 전에 거절한다.
  if (loginLimiter.isLimited(attemptKey) || loginSlugLimiter.isLimited(slug)) return tooMany(res, cors)

  const body = await readJson(req, config.bodyLimit)
  if (!body.ok) return send(res, body.status, { error: body.error }, cors)
  const password = isPlainObject(body.value) ? body.value.password : undefined
  if (typeof password !== 'string' || password === '') {
    return send(res, 400, { error: '관리 비밀번호가 필요합니다.' }, cors)
  }

  const secret = db.getWeddingSecret(slug)
  if (!secret) return send(res, 404, { error: '청첩장을 찾을 수 없습니다.' }, cors)

  // 해시(비동기) 전에 자리를 "동기적으로" 예약한다. 확인만 하고 실패를 나중에 기록하면
  // 동시에 보낸 요청이 전부 확인을 통과해 한도와 무관하게 비밀번호를 대입할 수 있다.
  if (!loginLimiter.begin(attemptKey)) return tooMany(res, cors)
  if (!loginSlugLimiter.begin(slug)) {
    loginLimiter.end(attemptKey, false)
    return tooMany(res, cors)
  }
  let ok = false
  try {
    // 지나치게 긴 입력은 해시하지 않고 틀린 것으로 처리한다.
    ok = password.length <= 1024 && (await verifyPassword(password, secret.pw_hash, secret.pw_salt))
  } finally {
    // 성공한 로그인은 차감하지 않는다(자리만 돌려준다).
    loginLimiter.end(attemptKey, !ok)
    loginSlugLimiter.end(slug, !ok)
  }
  if (!ok) return send(res, 403, { error: '관리 비밀번호가 일치하지 않습니다.' }, cors)
  return send(res, 200, tokens.sign(slug, secret.pw_salt), cors)
}

/** @param {Req} req @param {Res} res @param {Deps} deps @param {Cors} cors @param {string} slug */
export async function handleUpdateWedding(req, res, deps, cors, slug) {
  const { config, db } = deps
  if (!isOwner(req, deps, slug)) return unauthorized(res, cors)

  const body = await readJson(req, config.configBodyLimit)
  if (!body.ok) return send(res, body.status, { error: body.error }, cors)
  const shape = shapeError(body.value, ['config'])
  if (shape) return send(res, 400, { error: shape }, cors)

  const cfg = validateWeddingConfig(body.value.config, { slug, photoExists: (file) => db.hasPhoto(slug, file) })
  if (!cfg.ok) return send(res, 400, { error: cfg.error }, cors)

  const wedding = db.updateWeddingConfig(slug, cfg.value)
  if (!wedding) return send(res, 404, { error: '청첩장을 찾을 수 없습니다.' }, cors)
  // 저장된 내용이 더 이상 쓰지 않는(또는 한 번도 쓰지 않은) 오래된 업로드를 정리해 사진 수 상한을 돌려준다.
  await sweepOrphanPhotos(deps, slug, wedding.config)
  return send(res, 200, wedding, cors)
}

/** @param {Req} req @param {Res} res @param {Deps} deps @param {Cors} cors @param {string} slug */
export async function handleChangePassword(req, res, deps, cors, slug) {
  const { config, db } = deps
  if (!isOwner(req, deps, slug)) return unauthorized(res, cors)

  const body = await readJson(req, config.bodyLimit)
  if (!body.ok) return send(res, body.status, { error: body.error }, cors)
  const shape = shapeError(body.value, ['password'])
  if (shape) return send(res, 400, { error: shape }, cors)
  const pw = checkAdminPassword(body.value.password)
  if (!pw.ok) return send(res, 400, { error: pw.error }, cors)

  // 새 salt 로 바뀌므로 이전에 발급된 토큰은 모두 무효가 된다 → 클라이언트는 새 비밀번호로 다시 로그인.
  const secret = await hashPassword(pw.value)
  if (!db.updateWeddingPassword(slug, secret)) {
    return send(res, 404, { error: '청첩장을 찾을 수 없습니다.' }, cors)
  }
  return send(res, 204, null, cors)
}

/** @param {Req} req @param {Res} res @param {Deps} deps @param {Cors} cors @param {string} slug */
export async function handleDeleteWedding(req, res, deps, cors, slug) {
  const { config, db, broker, log } = deps
  if (!isOwner(req, deps, slug)) return unauthorized(res, cors)

  db.deleteWedding(slug)
  broker.closeChannel(slug)
  // slug 는 SLUG_PATTERN 을 통과한 값이라 uploadDir 밖을 가리킬 수 없다.
  try {
    await rm(join(config.uploadDir, slug), { recursive: true, force: true })
  } catch (err) {
    log(JSON.stringify({ t: new Date().toISOString(), level: 'warn', msg: `upload dir cleanup failed: ${String(err)}`, slug }))
  }
  return send(res, 204, null, cors)
}
