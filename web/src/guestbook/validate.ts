/**
 * 방명록 입력 검증 + 정제(sanitize) 공용 로직.
 * web 의 폼과 저장소(LocalStore/ApiStore) 양쪽에서 사용합니다.
 * 저장소/서버에서 돌아온 값은 절대 신뢰하지 않고 sanitizeEntry 를 거칩니다.
 */
import type { GuestEntry, NewGuestInput, Side } from './types'
import { LIMITS } from './types'
import { normalizeAppearance } from './character'

/** 코드포인트 기준 글자 수 (이모지/한글을 사람이 세는 느낌으로 계산) */
export function charLen(s: string): number {
  return Array.from(s).length
}

/** 코드포인트 기준으로 max 글자까지 자르기 */
export function truncate(s: string, max: number): string {
  const arr = Array.from(s)
  return arr.length > max ? arr.slice(0, max).join('') : s
}

/**
 * 제어문자를 공백으로 바꾸고, 연속 공백을 한 칸으로 합친 뒤 양끝을 다듬습니다.
 * (C0/C1 제어문자 + DEL 제거, 줄바꿈·탭 포함 모든 공백 정규화)
 */
export function collapseText(s: string): string {
  return s
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toSide(v: unknown): Side {
  return v === 'bride' ? 'bride' : 'groom'
}

export interface GuestFieldErrors {
  name?: string
  message?: string
  password?: string
}

export function hasFieldErrors(errors: GuestFieldErrors): boolean {
  return Boolean(errors.name || errors.message || errors.password)
}

/** 신규 입력 검증. 통과하면 빈 객체, 아니면 필드별 한국어 오류 메시지를 반환합니다. */
export function validateNewGuest(
  input: Pick<NewGuestInput, 'name' | 'message' | 'password'>,
): GuestFieldErrors {
  const errors: GuestFieldErrors = {}

  const name = collapseText(input.name ?? '')
  const nameLen = charLen(name)
  if (nameLen < 1) errors.name = '이름(또는 별명)을 입력해 주세요.'
  else if (nameLen > LIMITS.name) errors.name = `이름은 ${LIMITS.name}자까지 입력할 수 있어요.`

  const message = collapseText(input.message ?? '')
  const msgLen = charLen(message)
  if (msgLen < 1) errors.message = '축하 메시지를 입력해 주세요.'
  else if (msgLen > LIMITS.message) errors.message = `메시지는 ${LIMITS.message}자까지 입력할 수 있어요.`

  const password = input.password ?? ''
  if (password.length < LIMITS.passwordMin)
    errors.password = `삭제 비밀번호는 ${LIMITS.passwordMin}자 이상으로 정해 주세요.`

  return errors
}

/** 폼에서 받은 신규 입력을 저장 가능한 형태로 정제 (비밀번호는 원문 유지) */
export function sanitizeNewInput(input: NewGuestInput): NewGuestInput {
  return {
    name: truncate(collapseText(input.name), LIMITS.name),
    message: truncate(collapseText(input.message), LIMITS.message),
    side: toSide(input.side),
    appearance: normalizeAppearance(input.appearance),
    password: input.password,
  }
}

/**
 * 저장소/서버/다른 탭에서 온 임의의 값을 신뢰 가능한 GuestEntry 로 정제합니다.
 * 형태가 어긋나거나 이름/메시지가 비면 null 을 반환해 목록에서 제외합니다.
 */
export function sanitizeEntry(raw: unknown): GuestEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  const id = typeof r.id === 'string' ? r.id.trim() : ''
  if (!id) return null

  const name = truncate(collapseText(typeof r.name === 'string' ? r.name : ''), LIMITS.name)
  if (!name) return null

  const message = truncate(
    collapseText(typeof r.message === 'string' ? r.message : ''),
    LIMITS.message,
  )
  if (!message) return null

  const createdAt =
    typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : Date.now()

  return {
    id,
    name,
    message,
    side: toSide(r.side),
    appearance: normalizeAppearance(r.appearance),
    createdAt,
  }
}

/** sanitizeEntry 를 거친 뒤 id 중복 제거(뒤에 온 값 우선) + createdAt 오름차순 정렬 */
export function sanitizeList(raw: unknown): GuestEntry[] {
  const arr = Array.isArray(raw) ? raw : []
  const byId = new Map<string, GuestEntry>()
  for (const item of arr) {
    const entry = sanitizeEntry(item)
    if (entry) byId.set(entry.id, entry)
  }
  return Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt)
}
