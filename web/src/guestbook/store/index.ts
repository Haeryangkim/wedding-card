import type { GuestbookStore } from '../types'
import { LocalStore } from './LocalStore'
import { ApiStore } from './ApiStore'

export { LocalStore } from './LocalStore'
export { ApiStore } from './ApiStore'

let instance: GuestbookStore | null = null

/**
 * VITE_API_URL 에 따라 저장소를 결정하는 싱글턴.
 *  - 미설정/빈 값 → LocalStore (백엔드 없는 데모)
 *  - 그 외        → ApiStore (끝 슬래시 제거; "/" 는 같은 오리진)
 */
export function getStore(): GuestbookStore {
  if (instance) return instance
  const raw = (import.meta.env.VITE_API_URL ?? '').toString().trim()
  instance = raw ? new ApiStore(raw.replace(/\/+$/, '')) : new LocalStore()
  return instance
}

/** 테스트용: 싱글턴 초기화 */
export function resetStore(): void {
  instance = null
}
