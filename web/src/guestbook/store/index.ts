import type { GuestbookStore } from '../types'
import { apiBase } from '../../platform/api'
import { LocalStore } from './LocalStore'
import { ApiStore } from './ApiStore'

export { LocalStore } from './LocalStore'
export { ApiStore } from './ApiStore'

const instances = new Map<string, GuestbookStore>()

/**
 * 청첩장별 방명록 저장소 (slug 당 하나를 재사용).
 *  - 데모  → LocalStore (샘플 하객 + 이 기기의 localStorage)
 *  - 실제  → ApiStore  ({api}/api/weddings/<slug>/guests · /events)
 */
export function getStore(slug: string, isDemo: boolean): GuestbookStore {
  const key = `${isDemo ? 'demo' : 'api'}:${slug}`
  let store = instances.get(key)
  if (!store) {
    store = isDemo ? new LocalStore() : new ApiStore(apiBase() ?? '', slug)
    instances.set(key, store)
  }
  return store
}

/** 테스트용: 캐시 초기화 */
export function resetStore(): void {
  instances.clear()
}
