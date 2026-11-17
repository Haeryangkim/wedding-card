/**
 * 관리 권한 확인과 공용 오류 응답.
 */
import { timingSafeEqual } from 'node:crypto'
import { send, bearer } from './http.js'

/** @param {string} a @param {string} b 상수 시간 문자열 비교 */
function safeEqualStr(a, b) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * 관리 권한 확인: 그 청첩장의 로그인 토큰이거나 운영자 토큰(ADMIN_TOKEN)이면 true.
 * 토큰은 slug 와 그 청첩장의 현재 비밀번호 salt 에 묶여 있어 다른 청첩장에는 통하지 않는다.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('./app.js').Deps} deps
 * @param {string} slug
 */
export function isOwner(req, deps, slug) {
  const token = bearer(req)
  if (!token) return false
  if (deps.config.adminToken && safeEqualStr(token, deps.config.adminToken)) return true
  const secret = deps.db.getWeddingSecret(slug)
  if (!secret) return false
  return deps.tokens.verify(token, slug, secret.pw_salt)
}

/** @param {import('node:http').ServerResponse} res @param {Record<string,string>} cors */
export function unauthorized(res, cors) {
  return send(
    res,
    401,
    { error: '관리 권한이 없습니다. 관리 비밀번호로 다시 로그인해 주세요.' },
    { ...cors, 'WWW-Authenticate': 'Bearer' },
  )
}

/** @param {import('node:http').ServerResponse} res @param {Record<string,string>} cors */
export function tooMany(res, cors) {
  return send(res, 429, { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' }, cors)
}
