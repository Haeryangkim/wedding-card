/**
 * 클라이언트 검증 — 서버(server/src/wedding-config.js)의 상한을 그대로 따른다. 순수 함수.
 * 오류는 "필드 경로 → 한국어 문구" 이고, 넣는 순서가 화면 순서와 같아 첫 번째 키가 "첫 오류" 다.
 */
import { PLATFORM_LIMITS } from '../platform/contract'
import { isRealDate, isRealTime } from './datetime'
import type { AccountForm, EditorForm, PersonForm } from './form'
import { clean, formToConfig, isBlankAccount, isBlankTransport, splitLines, textLength } from './form'
import { slugError } from './slug'

export type FormErrors = Record<string, string>

export type SectionId =
  | 'people'
  | 'datetime'
  | 'venue'
  | 'transport'
  | 'greeting'
  | 'photos'
  | 'accounts'
  | 'share'

const T = PLATFORM_LIMITS.text
/** 계약에 없는 서버 결정 상한 */
export const TRANSPORT_LINES_MAX = 10
export const URL_MAX = 300
export const DURATION_MIN = 10
export const DURATION_MAX = 600

const tooLong = (max: number) => `${max}자 이하로 입력해 주세요.`

function checkMax(errors: FormErrors, path: string, value: string, max: number): void {
  if (textLength(clean(value)) > max) errors[path] = tooLong(max)
}

function checkPerson(errors: FormErrors, key: 'groom' | 'bride', p: PersonForm): void {
  const who = key === 'groom' ? '신랑' : '신부'
  if (clean(p.name) === '') errors[`${key}.name`] = `${who} 이름을 입력해 주세요.`
  else checkMax(errors, `${key}.name`, p.name, T.name)
  checkMax(errors, `${key}.firstName`, p.firstName, T.name)
  checkMax(errors, `${key}.relation`, p.relation, T.name)
  checkMax(errors, `${key}.fatherName`, p.fatherName, T.name)
  checkMax(errors, `${key}.motherName`, p.motherName, T.name)
  checkMax(errors, `${key}.phone`, p.phone, T.short)
}

/** 서버와 같은 규칙: https:// 로 시작하고 공백·따옴표·꺾쇠가 없는 주소 */
export function isHttpsUrl(url: string): boolean {
  if (!/^https:\/\/[^\s"'<>]+$/i.test(url)) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function checkAccounts(errors: FormErrors, key: 'groomAccounts' | 'brideAccounts', list: AccountForm[]): void {
  const filled = list.filter((a) => !isBlankAccount(a))
  if (filled.length > T.accountsPerSide) errors[key] = `계좌는 한쪽에 ${T.accountsPerSide}개까지 넣을 수 있어요.`
  for (const a of filled) {
    const p = `${key}.${a.id}`
    checkMax(errors, `${p}.role`, a.role, T.short)
    if (clean(a.bank) === '') errors[`${p}.bank`] = '은행 이름을 입력해 주세요.'
    else checkMax(errors, `${p}.bank`, a.bank, T.short)
    if (clean(a.number) === '') errors[`${p}.number`] = '계좌번호를 입력해 주세요.'
    else checkMax(errors, `${p}.number`, a.number, T.short)
    if (clean(a.holder) === '') errors[`${p}.holder`] = '예금주를 입력해 주세요.'
    else checkMax(errors, `${p}.holder`, a.holder, T.short)
    const url = clean(a.kakaoPayUrl)
    if (url !== '') {
      if (textLength(url) > URL_MAX) errors[`${p}.kakaoPayUrl`] = tooLong(URL_MAX)
      else if (!isHttpsUrl(url)) errors[`${p}.kakaoPayUrl`] = 'https:// 로 시작하는 주소를 넣어 주세요.'
    }
  }
}

function checkCoord(errors: FormErrors, path: string, raw: string, limit: number, label: string): void {
  const v = raw.trim()
  const n = Number(v)
  if (v === '' || !Number.isFinite(n)) errors[path] = `${label}를 숫자로 입력해 주세요. 장소 검색을 쓰면 자동으로 채워져요.`
  else if (n < -limit || n > limit) errors[path] = `${label}는 -${limit} ~ ${limit} 사이여야 해요.`
}

export function validateForm(form: EditorForm): FormErrors {
  const errors: FormErrors = {}

  checkPerson(errors, 'groom', form.groom)
  checkPerson(errors, 'bride', form.bride)

  if (!isRealDate(form.date)) errors.date = '예식 날짜를 선택해 주세요.'
  if (!isRealTime(form.time)) errors.time = '예식 시간을 선택해 주세요.'
  const duration = Number(form.durationMinutes)
  if (form.durationMinutes.trim() === '' || !Number.isInteger(duration)) {
    errors.durationMinutes = '예식 시간(분)을 숫자로 입력해 주세요.'
  } else if (duration < DURATION_MIN || duration > DURATION_MAX) {
    errors.durationMinutes = `${DURATION_MIN}분 ~ ${DURATION_MAX}분 사이로 입력해 주세요.`
  }

  // 장소 이름은 비워 둘 수 있다: 저장할 때 "예식 장소 미정" 으로 들어가고 청첩장은 지도·길안내를 숨긴다
  checkMax(errors, 'venue.name', form.venue.name, T.short)
  checkMax(errors, 'venue.hall', form.venue.hall, T.short)
  checkMax(errors, 'venue.address', form.venue.address, T.address)
  checkMax(errors, 'venue.tel', form.venue.tel, T.short)
  checkCoord(errors, 'venue.lat', form.venue.lat, 90, '위도')
  checkCoord(errors, 'venue.lng', form.venue.lng, 180, '경도')

  const blocks = form.transport.filter((b) => !isBlankTransport(b))
  if (blocks.length > T.transportBlocks) errors.transport = `교통 안내는 ${T.transportBlocks}개까지 넣을 수 있어요.`
  for (const b of blocks) {
    checkMax(errors, `transport.${b.id}.title`, b.title, T.short)
    const lines = splitLines(b.lines, { keepBlank: false })
    if (lines.length > TRANSPORT_LINES_MAX) {
      errors[`transport.${b.id}.lines`] = `한 항목에 ${TRANSPORT_LINES_MAX}줄까지 넣을 수 있어요.`
    } else if (lines.some((l) => textLength(l) > T.line)) {
      errors[`transport.${b.id}.lines`] = `한 줄은 ${T.line}자 이하로 입력해 주세요.`
    }
  }

  checkMax(errors, 'greetingTitle', form.greetingTitle, T.short)
  const body = splitLines(form.greetingBody, { keepBlank: true })
  if (body.length > T.greetingLines) {
    errors.greetingBody = `인사말은 ${T.greetingLines}줄까지 넣을 수 있어요. (지금 ${body.length}줄)`
  } else if (body.some((l) => textLength(l) > T.line)) {
    errors.greetingBody = `한 줄은 ${T.line}자 이하로 입력해 주세요. 긴 문장은 줄을 나눠 주세요.`
  }

  if (form.gallery.length > PLATFORM_LIMITS.galleryMax) {
    errors.gallery = `갤러리 사진은 ${PLATFORM_LIMITS.galleryMax}장까지 넣을 수 있어요.`
  }

  checkAccounts(errors, 'groomAccounts', form.groomAccounts)
  checkAccounts(errors, 'brideAccounts', form.brideAccounts)

  checkMax(errors, 'shareTitle', form.shareTitle, T.short)
  checkMax(errors, 'shareDescription', form.shareDescription, T.line)

  if (Object.keys(errors).length === 0) {
    const bytes = new TextEncoder().encode(JSON.stringify(formToConfig(form))).length
    if (bytes > PLATFORM_LIMITS.configBytes) {
      errors.greetingBody = '청첩장 내용이 너무 깁니다. 인사말이나 교통 안내를 조금 줄여 주세요.'
    }
  }
  return errors
}

/** 오류 경로가 속한 편집 섹션 */
export function sectionOfError(path: string): SectionId {
  const root = path.split('.')[0]
  if (root === 'groom' || root === 'bride') return 'people'
  if (root === 'date' || root === 'time' || root === 'durationMinutes') return 'datetime'
  if (root === 'venue') return 'venue'
  if (root === 'transport') return 'transport'
  if (root === 'greetingTitle' || root === 'greetingBody') return 'greeting'
  if (root === 'gallery' || root === 'coverImage') return 'photos'
  if (root === 'groomAccounts' || root === 'brideAccounts') return 'accounts'
  return 'share'
}

/**
 * 서버 검증 오류("청첩장 내용이 올바르지 않습니다 — venue.name: 비워 둘 수 없습니다.")가
 * 가리키는 섹션. 필드 이름을 찾지 못하면 null
 */
export function sectionOfServerError(message: string): SectionId | null {
  const m = /—\s*([A-Za-z]+)((?:\.[A-Za-z]+|\[\d+\])*)\s*:/.exec(message)
  if (!m) return null
  const root = m[1]
  const rest = m[2]
  if (root === 'groom' || root === 'bride') return 'people'
  if (root === 'datetime' || root === 'durationMinutes') return 'datetime'
  if (root === 'venue') return rest.startsWith('.transport') ? 'transport' : 'venue'
  if (root === 'greeting') return 'greeting'
  if (root === 'coverImage' || root === 'gallery') return 'photos'
  if (root === 'accounts') return 'accounts'
  if (root === 'share') return 'share'
  return null
}

// ── 관리 비밀번호 / 새 청첩장 ────────────────────────────────

export function passwordError(password: string): string | null {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(password)) return '비밀번호에 사용할 수 없는 문자가 있어요.'
  const n = textLength(password)
  if (n < PLATFORM_LIMITS.adminPasswordMin) return `${PLATFORM_LIMITS.adminPasswordMin}자 이상으로 정해 주세요.`
  if (n > PLATFORM_LIMITS.adminPasswordMax) return `${PLATFORM_LIMITS.adminPasswordMax}자 이하로 정해 주세요.`
  return null
}

export interface CreateForm {
  groomName: string
  brideName: string
  date: string
  time: string
  slug: string
  password: string
  passwordConfirm: string
}

export function validateCreate(f: CreateForm): FormErrors {
  const errors: FormErrors = {}
  for (const [key, who] of [['groomName', '신랑'], ['brideName', '신부']] as const) {
    if (clean(f[key]) === '') errors[key] = `${who} 이름을 입력해 주세요.`
    else if (textLength(clean(f[key])) > T.name) errors[key] = tooLong(T.name)
  }
  if (!isRealDate(f.date)) errors.date = '예식 날짜를 선택해 주세요.'
  if (!isRealTime(f.time)) errors.time = '예식 시간을 선택해 주세요.'
  const slug = slugError(f.slug)
  if (slug) errors.slug = slug
  const pw = passwordError(f.password)
  if (pw) errors.password = pw
  if (f.passwordConfirm !== f.password) errors.passwordConfirm = '비밀번호가 서로 달라요. 다시 확인해 주세요.'
  return errors
}
