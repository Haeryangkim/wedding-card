/**
 * 방문자 개인 기기에만 저장하는 보조 상태.
 *  - 내가 만든 캐릭터 id 목록("내 캐릭터" 배지, 삭제 권한 UI 노출용)
 *  - 작성 중이던 임시 저장(draft) — 시트를 실수로 닫아도 복구
 * 두 값 모두 "청첩장별" 로 나눠 저장합니다(scope). 한 청첩장에서 쓰다 만 글이 다른 청첩장의 작성 화면에
 * 채워지면 안 되기 때문입니다.
 * 모든 접근은 try/catch 로 감싸 시크릿 모드/차단 상황에서도 앱이 깨지지 않습니다.
 */
import type { Appearance, Side } from '../types'
import { normalizeAnyAppearance } from '../styles/registry'

const MY_IDS_KEY = 'wc.myids.v1'
const DRAFT_KEY = 'wc.draft.v1'

/** 저장 범위: 어느 청첩장의 방명록인가. storageScope() 로 만든다 */
export type StorageScope = string

const DEMO_PREFIX = 'demo:'

/** 청첩장 하나를 가리키는 저장 범위 ("demo:<slug>" | "api:<slug>") */
export function storageScope(slug: string, isDemo: boolean): StorageScope {
  return `${isDemo ? DEMO_PREFIX : 'api:'}${slug}`
}

const myIdsKey = (scope: StorageScope) => `${MY_IDS_KEY}:${scope}`
const draftKey = (scope: StorageScope) => `${DRAFT_KEY}:${scope}`

export interface JoinDraft {
  name: string
  side: Side
  message: string
  appearance: Appearance
}

function safeGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value)
  } catch {
    /* 무시 */
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(key)
  } catch {
    /* 무시 */
  }
}

export function loadMyIds(scope: StorageScope): Set<string> {
  // 청첩장별로 나누기 전의 키는 데모(이 기기에만 저장되는 방명록)에서만 한 번 이어받는다
  const raw = safeGet(myIdsKey(scope)) ?? (scope.startsWith(DEMO_PREFIX) ? safeGet(MY_IDS_KEY) : null)
  if (!raw) return new Set()
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    /* 무시 */
  }
  return new Set()
}

export function saveMyIds(scope: StorageScope, ids: Set<string>): void {
  safeSet(myIdsKey(scope), JSON.stringify(Array.from(ids)))
}

export function loadDraft(scope: StorageScope): JoinDraft | null {
  const raw = safeGet(draftKey(scope))
  if (!raw) return null
  try {
    const d = JSON.parse(raw)
    if (d && typeof d === 'object' && typeof d.name === 'string' && typeof d.message === 'string') {
      // 저장된 외형은 믿지 않는다: 그림체(style)에 맞는 범위로 보정 (예전 임시 저장은 style 이 없어 기본 픽셀)
      return {
        name: d.name,
        side: d.side === 'bride' ? 'bride' : 'groom',
        message: d.message,
        appearance: normalizeAnyAppearance(d.appearance),
      }
    }
  } catch {
    /* 무시 */
  }
  return null
}

export function saveDraft(scope: StorageScope, draft: JoinDraft): void {
  safeSet(draftKey(scope), JSON.stringify(draft))
}

export function clearDraft(scope: StorageScope): void {
  safeRemove(draftKey(scope))
  // 청첩장별로 나누기 전에 남은 임시 저장은 어느 청첩장의 것인지 알 수 없으므로 함께 버린다
  safeRemove(DRAFT_KEY)
}
