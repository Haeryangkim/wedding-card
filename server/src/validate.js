/**
 * NewGuestInput 검증. web/src/guestbook/types.ts 의 LIMITS 와 Appearance 형태를 그대로 반영한다.
 *   name 1~12자, message 1~200자, password 4자 이상, side ∈ {groom,bride},
 *   appearance = 정확히 6개의 정수 필드(각 0..63) + 선택 필드 style ∈ {pixel, maple, forest, doll, lpc, cabbit, nemo, kaykit, chibi, msref}
 *     (style 은 하객이 고른 그림체. 없으면 기본 픽셀 — 예전 클라이언트·저장된 글과 호환)
 * 성공 시 정제된 값을, 실패 시 { error } 를 돌려준다.
 */

export const LIMITS = { name: 12, message: 200, passwordMin: 4, passwordMax: 128 }

const SIDES = new Set(['groom', 'bride'])

/** Appearance 필드와 각 값의 상한(옵션 인덱스 범위). 0..63 로 넉넉히 제한. */
const APPEARANCE_FIELDS = ['skin', 'hairStyle', 'hairColor', 'outfit', 'outfitColor', 'accessory']
const APPEARANCE_MAX = 63
/** 캐릭터 그림체 (web/src/guestbook/types.ts 의 CharacterStyleId) */
// web/src/guestbook/types.ts 의 CharacterStyleId 와 같아야 한다.
// msref 는 VITE_REF_STYLES=1 로 빌드한 웹에서만 보내는 시험용 그림체 — 그 밖의 웹 빌드는 읽을 때 기본 픽셀로 보정한다.
const APPEARANCE_STYLES = new Set(['pixel', 'maple', 'forest', 'doll', 'lpc', 'cabbit', 'nemo', 'kaykit', 'chibi', 'msref'])

// 제어 문자(C0 + DEL)를 제거한다. 방명록은 한 줄 텍스트이므로 개행·탭도 제거.
const CONTROL = /[\u0000-\u001F\u007F]/g
// .test() 는 g 플래그가 있으면 lastIndex 상태를 가지므로 검사용은 별도 상수를 쓴다.
const HAS_CONTROL = /[\u0000-\u001F\u007F]/

/** 코드포인트 기준 길이 (이모지 1자 계산) @param {string} s */
function len(s) {
  return [...s].length
}

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: import('./db.js').NewGuest } | { ok: false, error: string }}
 */
export function validateNewGuest(raw) {
  if (!isPlainObject(raw)) return fail('요청 본문이 올바르지 않습니다.')

  const allowed = new Set(['name', 'message', 'side', 'appearance', 'password'])
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) return fail(`알 수 없는 필드입니다: ${key}`)
  }

  if (typeof raw.name !== 'string') return fail('이름이 필요합니다.')
  const name = raw.name.replace(CONTROL, '').trim()
  if (len(name) < 1) return fail('이름을 입력해 주세요.')
  if (len(name) > LIMITS.name) return fail(`이름은 ${LIMITS.name}자 이하여야 합니다.`)

  if (typeof raw.message !== 'string') return fail('메시지가 필요합니다.')
  const message = raw.message.replace(CONTROL, '').trim()
  if (len(message) < 1) return fail('메시지를 입력해 주세요.')
  if (len(message) > LIMITS.message) return fail(`메시지는 ${LIMITS.message}자 이하여야 합니다.`)

  if (raw.side !== 'groom' && raw.side !== 'bride') return fail('하객 구분이 올바르지 않습니다.')
  const side = raw.side

  const appearance = validateAppearance(raw.appearance)
  if (!appearance) return fail('캐릭터 정보가 올바르지 않습니다.')

  if (typeof raw.password !== 'string') return fail('비밀번호가 필요합니다.')
  if (HAS_CONTROL.test(raw.password)) return fail('비밀번호에 사용할 수 없는 문자가 있습니다.')
  if (len(raw.password) < LIMITS.passwordMin)
    return fail(`비밀번호는 ${LIMITS.passwordMin}자 이상이어야 합니다.`)
  if (len(raw.password) > LIMITS.passwordMax) return fail('비밀번호가 너무 깁니다.')

  return { ok: true, value: { name, message, side, appearance, password: raw.password } }
}

/**
 * @param {unknown} raw
 * @returns {import('./db.js').Appearance | null}
 */
function validateAppearance(raw) {
  if (!isPlainObject(raw)) return null
  const hasStyle = Object.hasOwn(raw, 'style')
  const keys = Object.keys(raw)
  if (keys.length !== APPEARANCE_FIELDS.length + (hasStyle ? 1 : 0)) return null
  /** @type {any} */
  const out = {}
  for (const field of APPEARANCE_FIELDS) {
    const v = raw[field]
    if (!Number.isInteger(v)) return null
    const n = /** @type {number} */ (v)
    if (n < 0 || n > APPEARANCE_MAX) return null
    out[field] = n
  }
  if (hasStyle) {
    if (typeof raw.style !== 'string' || !APPEARANCE_STYLES.has(raw.style)) return null
    out.style = raw.style
  }
  return out
}

/** DELETE 본문의 비밀번호 검증 @param {unknown} raw */
export function extractPassword(raw) {
  if (!isPlainObject(raw)) return null
  const { password } = raw
  if (typeof password !== 'string' || len(password) < 1) return null
  return password
}

/** @param {string} error */
function fail(error) {
  return /** @type {const} */ ({ ok: false, error })
}
