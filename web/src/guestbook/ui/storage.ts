/**
 * 방문자 개인 기기에만 저장하는 보조 상태.
 *  - 내가 만든 캐릭터 id 목록("내 캐릭터" 배지, 삭제 권한 UI 노출용)
 *  - 작성 중이던 임시 저장(draft) — 시트를 실수로 닫아도 복구
 * 모든 접근은 try/catch 로 감싸 시크릿 모드/차단 상황에서도 앱이 깨지지 않습니다.
 */
import type { Appearance, Side } from '../types'

const MY_IDS_KEY = 'wc.myids.v1'
const DRAFT_KEY = 'wc.draft.v1'

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

export function loadMyIds(): Set<string> {
  const raw = safeGet(MY_IDS_KEY)
  if (!raw) return new Set()
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    /* 무시 */
  }
  return new Set()
}

export function saveMyIds(ids: Set<string>): void {
  safeSet(MY_IDS_KEY, JSON.stringify(Array.from(ids)))
}

export function loadDraft(): JoinDraft | null {
  const raw = safeGet(DRAFT_KEY)
  if (!raw) return null
  try {
    const d = JSON.parse(raw)
    if (d && typeof d === 'object' && typeof d.name === 'string' && typeof d.message === 'string') {
      return d as JoinDraft
    }
  } catch {
    /* 무시 */
  }
  return null
}

export function saveDraft(draft: JoinDraft): void {
  safeSet(DRAFT_KEY, JSON.stringify(draft))
}

export function clearDraft(): void {
  safeRemove(DRAFT_KEY)
}
