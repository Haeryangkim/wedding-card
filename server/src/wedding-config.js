/**
 * 청첩장 주소(slug)·관리 비밀번호·내용(WeddingConfig) 검증.
 * web/src/platform/contract.ts (SLUG_PATTERN, RESERVED_SLUGS, PLATFORM_LIMITS) 와
 * web/src/config/wedding.ts (WeddingConfig) 를 그대로 반영한다 — 바꾸면 양쪽을 함께 수정.
 *
 * 내용 검증은 엄격한 화이트리스트다: 모르는 키·틀린 타입은 필드 이름을 담은 400 메시지로 거절하고,
 * 문자열은 제어문자를 지운 뒤 트림한다. 돌려주는 값은 새로 조립한 객체라 입력의 여분 속성이 섞이지 않는다.
 */

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/
export const RESERVED_SLUGS = new Set([
  'demo', 'new', 'edit', 'api', 'admin', 'uploads', 'assets', 'w', 'www', 'static', 'login', 'help', 'about',
])

export const PLATFORM_LIMITS = {
  adminPasswordMin: 6,
  adminPasswordMax: 72,
  configBytes: 32 * 1024,
  photosPerWedding: 30,
  photoBytes: 2 * 1024 * 1024,
  galleryMax: 24,
  text: { name: 20, short: 60, address: 120, line: 120, greetingLines: 20, transportBlocks: 6, accountsPerSide: 4 },
}

/** 계약에 따로 없는 상한 (서버 결정) */
const TRANSPORT_LINES_MAX = 10
const URL_MAX = 300

/** 서버가 만드는 사진 파일 이름: 무작위 32 hex + 확장자 */
export const PHOTO_FILE_RE = /^[0-9a-f]{32}\.(?:jpg|png|webp)$/

const T = PLATFORM_LIMITS.text
const CONTROL = /[\u0000-\u001F\u007F]/g
const HAS_CONTROL = /[\u0000-\u001F\u007F]/

/** 코드포인트 기준 길이 @param {string} s */
function len(s) {
  return [...s].length
}

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * 주소 이름 규칙 검사.
 * @param {unknown} slug
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkSlug(slug) {
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      reason: '주소는 영문 소문자·숫자·하이픈(-) 3~30자로, 하이픈으로 시작하거나 끝날 수 없습니다.',
    }
  }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: '사용할 수 없는 주소입니다.' }
  return { ok: true }
}

/**
 * 관리 비밀번호 검사.
 * @param {unknown} password
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function checkAdminPassword(password) {
  if (typeof password !== 'string') return { ok: false, error: '관리 비밀번호가 필요합니다.' }
  if (HAS_CONTROL.test(password)) return { ok: false, error: '관리 비밀번호에 사용할 수 없는 문자가 있습니다.' }
  const n = len(password)
  if (n < PLATFORM_LIMITS.adminPasswordMin)
    return { ok: false, error: `관리 비밀번호는 ${PLATFORM_LIMITS.adminPasswordMin}자 이상이어야 합니다.` }
  if (n > PLATFORM_LIMITS.adminPasswordMax)
    return { ok: false, error: `관리 비밀번호는 ${PLATFORM_LIMITS.adminPasswordMax}자 이하여야 합니다.` }
  return { ok: true, value: password }
}

class ConfigError extends Error {}

/** @param {string} path @param {string} msg @returns {never} */
function bad(path, msg) {
  throw new ConfigError(`${path}: ${msg}`)
}

/** null/undefined 는 "없음" 으로 본다 (JSON 에는 undefined 가 없어 null 로 오는 경우가 있다) */
const absent = (/** @type {unknown} */ v) => v === undefined || v === null

/** @param {unknown} v @param {string} path @param {string[]} keys 허용 키 @returns {Record<string, unknown>} */
function obj(v, path, keys) {
  if (!isPlainObject(v)) bad(path, '객체여야 합니다.')
  for (const k of Object.keys(v)) {
    if (!keys.includes(k)) bad(path ? `${path}.${k}` : k, '알 수 없는 필드입니다.')
  }
  return v
}

/** @param {unknown} v @param {string} path @param {number} max @param {boolean} [required] @returns {string} */
function text(v, path, max, required = false) {
  if (typeof v !== 'string') bad(path, '문자열이어야 합니다.')
  const s = v.replace(CONTROL, '').trim()
  if (required && s === '') bad(path, '비워 둘 수 없습니다.')
  if (len(s) > max) bad(path, `${max}자 이하여야 합니다.`)
  return s
}

/** @param {unknown} v @param {string} path @param {number} max @returns {unknown[]} */
function list(v, path, max) {
  if (!Array.isArray(v)) bad(path, '배열이어야 합니다.')
  if (v.length > max) bad(path, `최대 ${max}개까지 넣을 수 있습니다.`)
  return v
}

/** @param {unknown} v @param {string} path @param {number} min @param {number} max @returns {number} */
function num(v, path, min, max) {
  if (typeof v !== 'number' || !Number.isFinite(v)) bad(path, '숫자여야 합니다.')
  if (v < min || v > max) bad(path, `${min} 이상 ${max} 이하여야 합니다.`)
  return v
}

/** @param {unknown} v @param {string} path */
function parent(v, path) {
  const o = obj(v, path, ['name', 'deceased'])
  /** @type {{ name: string, deceased?: boolean }} */
  const out = { name: text(o.name, `${path}.name`, T.name, true) }
  if (!absent(o.deceased)) {
    if (typeof o.deceased !== 'boolean') bad(`${path}.deceased`, 'true 또는 false 여야 합니다.')
    out.deceased = o.deceased
  }
  return out
}

/** @param {unknown} v @param {string} path */
function person(v, path) {
  const o = obj(v, path, ['name', 'firstName', 'relation', 'father', 'mother', 'phone'])
  /** @type {Record<string, any>} */
  const out = {
    name: text(o.name, `${path}.name`, T.name, true),
    firstName: text(o.firstName, `${path}.firstName`, T.name),
    relation: text(o.relation, `${path}.relation`, T.name),
  }
  if (!absent(o.father)) out.father = parent(o.father, `${path}.father`)
  if (!absent(o.mother)) out.mother = parent(o.mother, `${path}.mother`)
  if (!absent(o.phone)) {
    const phone = text(o.phone, `${path}.phone`, T.short)
    if (phone !== '') out.phone = phone
  }
  return out
}

const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?\+09:00$/

/** @param {unknown} v @param {string} path */
function datetime(v, path) {
  if (typeof v !== 'string') bad(path, '문자열이어야 합니다.')
  const m = DATETIME_RE.exec(v)
  const hint = '예: 2027-05-15T12:30:00+09:00 (한국 시간 +09:00 오프셋 포함)'
  if (!m) bad(path, `날짜·시각 형식이 올바르지 않습니다. ${hint}`)
  const t = Date.parse(v)
  if (Number.isNaN(t)) bad(path, `존재하지 않는 날짜·시각입니다. ${hint}`)
  // 2월 31일처럼 달력에 없는 날짜가 다음 달로 넘어가 버리는 것을 막는다.
  const k = new Date(t + 9 * 60 * 60 * 1000)
  const same =
    k.getUTCFullYear() === Number(m[1]) &&
    k.getUTCMonth() + 1 === Number(m[2]) &&
    k.getUTCDate() === Number(m[3]) &&
    k.getUTCHours() === Number(m[4]) &&
    k.getUTCMinutes() === Number(m[5])
  if (!same) bad(path, `존재하지 않는 날짜·시각입니다. ${hint}`)
  return v
}

/**
 * @param {unknown} v @param {string} path
 * @param {string} slug @param {(file: string) => boolean} photoExists
 */
function upload(v, path, slug, photoExists) {
  if (typeof v !== 'string') bad(path, '문자열이어야 합니다.')
  const prefix = `/uploads/${slug}/`
  const file = v.startsWith(prefix) ? v.slice(prefix.length) : ''
  if (!PHOTO_FILE_RE.test(file)) bad(path, `이 청첩장에 올린 사진 경로(${prefix}…)만 사용할 수 있습니다.`)
  if (!photoExists(file)) bad(path, '업로드된 사진을 찾을 수 없습니다. 사진을 다시 올려 주세요.')
  return v
}

/** @param {unknown} v @param {string} path */
function account(v, path) {
  const o = obj(v, path, ['role', 'bank', 'number', 'holder', 'kakaoPayUrl'])
  /** @type {Record<string, any>} */
  const out = {
    role: text(o.role, `${path}.role`, T.short),
    bank: text(o.bank, `${path}.bank`, T.short),
    number: text(o.number, `${path}.number`, T.short),
    holder: text(o.holder, `${path}.holder`, T.short),
  }
  if (!absent(o.kakaoPayUrl)) {
    const url = text(o.kakaoPayUrl, `${path}.kakaoPayUrl`, URL_MAX)
    if (url !== '') {
      // javascript: 같은 스킴이 링크로 렌더링되지 않도록 https 만 허용한다.
      if (!/^https:\/\/[^\s"'<>]+$/i.test(url) || !URL.canParse(url)) {
        bad(`${path}.kakaoPayUrl`, 'https:// 로 시작하는 주소여야 합니다.')
      }
      out.kakaoPayUrl = url
    }
  }
  return out
}

/**
 * WeddingConfig 검증 + 정제.
 * @param {unknown} raw
 * @param {{ slug: string, photoExists: (file: string) => boolean }} ctx 사진 경로 확인용
 * @returns {{ ok: true, value: any } | { ok: false, error: string }}
 */
export function validateWeddingConfig(raw, ctx) {
  try {
    const value = build(raw, ctx)
    const bytes = Buffer.byteLength(JSON.stringify(value))
    if (bytes > PLATFORM_LIMITS.configBytes) {
      return { ok: false, error: `청첩장 내용이 너무 깁니다. (${bytes}바이트, 최대 ${PLATFORM_LIMITS.configBytes}바이트)` }
    }
    return { ok: true, value }
  } catch (err) {
    if (err instanceof ConfigError) return { ok: false, error: `청첩장 내용이 올바르지 않습니다 — ${err.message}` }
    throw err
  }
}

/** @param {unknown} raw @param {{ slug: string, photoExists: (file: string) => boolean }} ctx */
function build(raw, ctx) {
  if (!isPlainObject(raw)) bad('config', '객체여야 합니다.')
  const c = obj(raw, '', [
    'groom', 'bride', 'datetime', 'durationMinutes', 'venue', 'greeting',
    'coverImage', 'gallery', 'accounts', 'share', 'kakaoJsKey',
  ])

  const v = obj(c.venue, 'venue', ['name', 'hall', 'address', 'tel', 'lat', 'lng', 'transport'])
  /** @type {Record<string, any>} */
  const venue = {
    name: text(v.name, 'venue.name', T.short, true),
    hall: text(v.hall, 'venue.hall', T.short),
    address: text(v.address, 'venue.address', T.address),
  }
  if (!absent(v.tel)) {
    const tel = text(v.tel, 'venue.tel', T.short)
    if (tel !== '') venue.tel = tel
  }
  venue.lat = num(v.lat, 'venue.lat', -90, 90)
  venue.lng = num(v.lng, 'venue.lng', -180, 180)
  venue.transport = list(v.transport, 'venue.transport', T.transportBlocks).map((b, i) => {
    const p = `venue.transport[${i}]`
    const o = obj(b, p, ['title', 'lines'])
    return {
      title: text(o.title, `${p}.title`, T.short),
      lines: list(o.lines, `${p}.lines`, TRANSPORT_LINES_MAX).map((l, j) => text(l, `${p}.lines[${j}]`, T.line)),
    }
  })

  const g = obj(c.greeting, 'greeting', ['title', 'body'])
  const greeting = {
    title: text(g.title, 'greeting.title', T.short),
    body: list(g.body, 'greeting.body', T.greetingLines).map((l, i) => text(l, `greeting.body[${i}]`, T.line)),
  }

  const a = obj(c.accounts, 'accounts', ['groomSide', 'brideSide'])
  const side = (/** @type {'groomSide' | 'brideSide'} */ k) =>
    list(a[k], `accounts.${k}`, T.accountsPerSide).map((x, i) => account(x, `accounts.${k}[${i}]`))
  const accounts = { groomSide: side('groomSide'), brideSide: side('brideSide') }

  const s = obj(c.share, 'share', ['title', 'description'])
  const share = {
    title: text(s.title, 'share.title', T.short),
    description: text(s.description, 'share.description', T.line),
  }

  if (typeof c.durationMinutes !== 'number' || !Number.isInteger(c.durationMinutes)) {
    bad('durationMinutes', '정수(분)여야 합니다.')
  }

  /** @type {Record<string, any>} WeddingConfig 와 같은 키 순서 */
  const out = {
    groom: person(c.groom, 'groom'),
    bride: person(c.bride, 'bride'),
    datetime: datetime(c.datetime, 'datetime'),
    durationMinutes: num(c.durationMinutes, 'durationMinutes', 10, 600),
    venue,
    greeting,
  }
  if (!absent(c.coverImage) && c.coverImage !== '') {
    out.coverImage = upload(c.coverImage, 'coverImage', ctx.slug, ctx.photoExists)
  }
  out.gallery = absent(c.gallery)
    ? []
    : list(c.gallery, 'gallery', PLATFORM_LIMITS.galleryMax).map((x, i) =>
        upload(x, `gallery[${i}]`, ctx.slug, ctx.photoExists),
      )
  out.accounts = accounts
  out.share = share
  // kakaoJsKey 는 받아도 저장하지 않는다(플랫폼에서는 운영자 설정).
  return out
}
