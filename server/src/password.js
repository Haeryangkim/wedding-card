/**
 * scrypt 기반 비밀번호 해시. 평문/해시는 응답에 절대 포함하지 않는다.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const KEYLEN = 64

/** @param {string} password @param {Buffer} salt @returns {Promise<Buffer>} */
function derive(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

/**
 * 비밀번호를 해시한다.
 * @param {string} password
 * @returns {Promise<{ hash: string, salt: string }>} hex 인코딩
 */
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return { hash: key.toString('hex'), salt: salt.toString('hex') }
}

/**
 * 저장된 해시와 입력 비밀번호를 상수 시간 비교한다.
 * @param {string} password
 * @param {string} hashHex
 * @param {string} saltHex
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hashHex, saltHex) {
  let salt
  let stored
  try {
    salt = Buffer.from(saltHex, 'hex')
    stored = Buffer.from(hashHex, 'hex')
  } catch {
    return false
  }
  if (stored.length !== KEYLEN) return false
  const key = await derive(password, salt)
  return key.length === stored.length && timingSafeEqual(key, stored)
}
