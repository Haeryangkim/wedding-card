/**
 * 방명록 목록 조회 (관리 화면용). PlatformApi 에 목록 메서드가 없어 공개 엔드포인트를 직접 부른다.
 * 삭제는 PlatformApi.deleteGuestAsOwner 를 쓴다.
 */
import type { GuestEntry } from '../guestbook/types'
import { apiBase } from '../platform/api'

export async function fetchGuests(slug: string): Promise<GuestEntry[]> {
  const res = await fetch(`${apiBase() ?? ''}/api/weddings/${encodeURIComponent(slug)}/guests`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    let message = '방명록을 불러오지 못했어요.'
    try {
      const body: unknown = await res.json()
      if (typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string') {
        message = (body as { error: string }).error
      }
    } catch {
      /* 기본 문구 사용 */
    }
    throw Object.assign(new Error(message), { status: res.status })
  }
  const list: unknown = await res.json()
  return Array.isArray(list) ? (list as GuestEntry[]) : []
}
