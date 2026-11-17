/**
 * 관리 토큰 보관 (탭을 닫으면 사라지는 sessionStorage, 청첩장 주소별 키).
 * 사생활 보호 모드 등으로 저장소를 쓸 수 없으면 메모리에만 둔다.
 */
import type { AuthToken } from '../platform/contract'

const key = (slug: string) => `wedding-admin-token:${slug}`
const memory = new Map<string, AuthToken>()

export function saveToken(slug: string, auth: AuthToken): void {
  const value: AuthToken = { token: auth.token, expiresAt: auth.expiresAt }
  memory.set(slug, value)
  try {
    sessionStorage.setItem(key(slug), JSON.stringify(value))
  } catch {
    /* 메모리 보관으로 충분 */
  }
}

export function loadToken(slug: string, now: number = Date.now()): string | null {
  let auth = memory.get(slug) ?? null
  if (!auth) {
    try {
      const raw = sessionStorage.getItem(key(slug))
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as AuthToken).token === 'string' &&
        typeof (parsed as AuthToken).expiresAt === 'number'
      ) {
        auth = parsed as AuthToken
      }
    } catch {
      auth = null
    }
  }
  if (!auth || auth.expiresAt <= now) {
    clearToken(slug)
    return null
  }
  return auth.token
}

export function clearToken(slug: string): void {
  memory.delete(slug)
  try {
    sessionStorage.removeItem(key(slug))
  } catch {
    /* 무시 */
  }
}
