/**
 * 방명록 상태 훅 — 저장소(getStore) 구독 · 목록 · 내 캐릭터(이 기기에서 남긴 글) 관리.
 * 일반 청첩장의 방명록 섹션(PixelGuestbook)과 픽셀 청첩장(/w/<slug>/pixel)이 같은 저장소·같은 로직을 쓴다.
 * 화면 상태(열린 시트, 선택한 하객, 포커스)는 각 화면이 따로 가진다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GuestbookStore, GuestEntry, NewGuestInput } from './types'
import { getStore } from './store'
import { loadMyIds, saveMyIds, storageScope, type StorageScope } from './ui/storage'

function upsertEntry(list: GuestEntry[], entry: GuestEntry): GuestEntry[] {
  const idx = list.findIndex((e) => e.id === entry.id)
  const next = idx >= 0 ? list.map((e) => (e.id === entry.id ? entry : e)) : [...list, entry]
  return next.sort((a, b) => a.createdAt - b.createdAt)
}

export interface GuestbookState {
  /** 'local' = 이 기기에만 저장(데모), 'api' = 서버 */
  mode: 'local' | 'api'
  entries: GuestEntry[]
  loading: boolean
  error: string | null
  /** 이 기기에서 남긴 글의 id */
  myIds: Set<string>
  /** 내 캐릭터 목록·임시 저장의 청첩장별 범위 키 */
  scope: StorageScope
  reload: () => void
  /** 글을 남기고 등록된 항목을 돌려준다 */
  add: (input: NewGuestInput) => Promise<GuestEntry>
  remove: (id: string, password: string) => Promise<void>
}

export function useGuestbook(slug: string, isDemo: boolean): GuestbookState {
  const storeRef = useRef<GuestbookStore | null>(null)
  const [mode, setMode] = useState<'local' | 'api'>('local')
  const [entries, setEntries] = useState<GuestEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // list() 요청 순번: 더 최신 데이터(구독/재요청)가 반영된 뒤 도착한 늦은 응답은 버린다.
  const loadSeqRef = useRef(0)
  const mountedRef = useRef(false)
  // 내 캐릭터 목록·임시 저장은 청첩장별로 따로 둔다
  const scope = storageScope(slug, isDemo)
  const [myIds, setMyIds] = useState<Set<string>>(() => loadMyIds(scope))

  useEffect(() => {
    const store = getStore(slug, isDemo)
    storeRef.current = store
    setMode(store.mode)
    let active = true
    mountedRef.current = true
    const seq = ++loadSeqRef.current
    store
      .list()
      .then((list) => {
        if (!active || seq !== loadSeqRef.current) return
        setEntries(list)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active || seq !== loadSeqRef.current) return
        setError(err instanceof Error ? err.message : '방명록을 불러오지 못했어요.')
        setLoading(false)
      })
    const unsub = store.subscribe((list) => {
      if (!active) return
      // 구독이 데이터를 전달했다면 최초 로드 실패/로딩 상태는 더 이상 유효하지 않다.
      loadSeqRef.current++
      setEntries(list)
      setError(null)
      setLoading(false)
    })
    return () => {
      active = false
      mountedRef.current = false
      unsub()
    }
  }, [slug, isDemo])

  const reload = useCallback(() => {
    const store = storeRef.current
    if (!store) return
    setLoading(true)
    setError(null)
    const seq = ++loadSeqRef.current
    const stale = () => !mountedRef.current || seq !== loadSeqRef.current
    store
      .list()
      .then((list) => {
        if (stale()) return
        setEntries(list)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (stale()) return
        setError(err instanceof Error ? err.message : '방명록을 불러오지 못했어요.')
        setLoading(false)
      })
  }, [])

  const add = useCallback(
    async (input: NewGuestInput) => {
      const store = storeRef.current
      if (!store) throw new Error('잠시 후 다시 시도해 주세요.')
      const entry = await store.add(input)
      setEntries((prev) => upsertEntry(prev, entry))
      setMyIds((prev) => {
        const next = new Set(prev)
        next.add(entry.id)
        saveMyIds(scope, next)
        return next
      })
      return entry
    },
    [scope],
  )

  const remove = useCallback(
    async (id: string, password: string) => {
      const store = storeRef.current
      if (!store) throw new Error('잠시 후 다시 시도해 주세요.')
      await store.remove(id, password)
      setEntries((prev) => prev.filter((e) => e.id !== id))
      setMyIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        saveMyIds(scope, next)
        return next
      })
    },
    [scope],
  )

  return { mode, entries, loading, error, myIds, scope, reload, add, remove }
}
