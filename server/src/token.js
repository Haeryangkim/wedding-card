/**
 * 관리 로그인 토큰 (상태 없음, HMAC-SHA256 서명).
 *
 *   token = "<slug>.<만료 epoch ms>.<base64url 서명>"
 *   서명  = HMAC(secret, slug \n 만료 \n 비밀번호 salt)
 *
 * salt 는 비밀번호를 바꿀 때마다 새로 만들어지므로, 비밀번호를 바꾸면(또는 청첩장을 지우고
 * 같은 주소로 다시 만들면) 이전에 발급된 토큰은 전부 무효가 된다. 검증은 상수 시간 비교.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * @param {string} secret
 * @param {number} ttlMs
 */
export function createTokens(secret, ttlMs) {
  /** @param {string} slug @param {string} exp @param {string} salt */
  const mac = (slug, exp, salt) => createHmac('sha256', secret).update(`${slug}\n${exp}\n${salt}`).digest()

  return {
    /**
     * @param {string} slug @param {string} salt 그 청첩장의 현재 pw_salt
     * @returns {{ token: string, expiresAt: number }}
     */
    sign(slug, salt) {
      const expiresAt = Date.now() + ttlMs
      return { token: `${slug}.${expiresAt}.${mac(slug, String(expiresAt), salt).toString('base64url')}`, expiresAt }
    },

    /**
     * @param {string} token @param {string} slug 요청 경로의 청첩장 @param {string} salt 그 청첩장의 현재 pw_salt
     * @returns {boolean}
     */
    verify(token, slug, salt) {
      const parts = token.split('.')
      if (parts.length !== 3) return false
      const [tSlug, exp, sig] = parts
      if (tSlug !== slug || !/^\d{1,15}$/.test(exp) || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return false
      const expected = mac(slug, exp, salt)
      const given = Buffer.from(sig, 'base64url')
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false
      return Number(exp) > Date.now()
    },
  }
}

/**
 * 서명 키: 환경변수(TOKEN_SECRET)가 있으면 그것을, 없으면 DB 에 한 번 만들어 계속 쓴다.
 * @param {string | null} fromEnv
 * @param {import('./db.js').Db} db
 */
export function resolveTokenSecret(fromEnv, db) {
  if (fromEnv) return fromEnv
  const saved = db.getMeta('token_secret')
  if (saved) return saved
  const fresh = randomBytes(32).toString('hex')
  db.setMeta('token_secret', fresh)
  return fresh
}

/** @typedef {ReturnType<typeof createTokens>} Tokens */
