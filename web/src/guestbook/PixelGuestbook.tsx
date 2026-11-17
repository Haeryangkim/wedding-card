import { useEffect, useRef, useState } from 'react'
import type { GuestbookStore, GuestEntry, NewGuestInput } from './types'
import { getStore } from './store'
import { useWedding } from '../platform/WeddingContext'
import { WorldCanvas } from './ui/WorldCanvas'
import { BottomSheet } from './ui/BottomSheet'
import { JoinFlow } from './ui/JoinFlow'
import { GuestList } from './ui/GuestList'
import { GuestCard } from './ui/GuestCard'
import { loadMyIds, saveMyIds, storageScope } from './ui/storage'
import './PixelGuestbook.css'

type SheetKind = 'none' | 'join' | 'list'

function upsertEntry(list: GuestEntry[], entry: GuestEntry): GuestEntry[] {
  const idx = list.findIndex((e) => e.id === entry.id)
  const next = idx >= 0 ? list.map((e) => (e.id === entry.id ? entry : e)) : [...list, entry]
  return next.sort((a, b) => a.createdAt - b.createdAt)
}

export function PixelGuestbook() {
  const { slug, isDemo, config } = useWedding()
  const storeRef = useRef<GuestbookStore | null>(null)
  const [mode, setMode] = useState<'local' | 'api'>('local')
  const [entries, setEntries] = useState<GuestEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  // 같은 하객을 다시 "위치 보기" 해도 동작하도록, 포커스는 (id, 요청 번호) 쌍으로 전달한다.
  const [focusSeq, setFocusSeq] = useState(0)
  // list() 요청 순번: 더 최신 데이터(구독/재요청)가 반영된 뒤 도착한 늦은 응답은 버린다.
  const loadSeqRef = useRef(0)
  const mountedRef = useRef(false)
  const [selected, setSelected] = useState<GuestEntry | null>(null)
  const [sheet, setSheet] = useState<SheetKind>('none')
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

  // 선택한 캐릭터가 (다른 탭 등에서) 사라지면 카드 닫기
  useEffect(() => {
    if (selected && !entries.some((e) => e.id === selected.id)) setSelected(null)
  }, [entries, selected])

  const reload = () => {
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
  }

  const handleAdd = async (input: NewGuestInput) => {
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
    setSheet('none')
    setSelected(null)
    setFocusId(entry.id)
    setFocusSeq((n) => n + 1)
  }

  const handleDelete = async (id: string, password: string) => {
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
    if (selected?.id === id) setSelected(null)
    if (focusId === id) setFocusId(null)
  }

  const locate = (id: string) => {
    setSheet('none')
    setSelected(null)
    setFocusId(id)
    setFocusSeq((n) => n + 1)
  }

  const guestCount = entries.length

  return (
    <section className="pg" aria-label="픽셀 방명록">
      <header className="pg-head">
        <p className="pg-count">
          {loading ? '하객들을 불러오는 중…' : `하객 ${guestCount}명이 축하하고 있어요`}
        </p>
        {mode === 'local' && (
          <p className="pg-local-note">
            데모 모드예요. 남긴 메시지는 이 기기에만 저장돼요.
          </p>
        )}
      </header>

      <div className="pg-stage">
        <WorldCanvas
          entries={entries}
          focusId={focusId}
          focusSeq={focusSeq}
          loaded={!loading}
          groomName={config.groom.name}
          brideName={config.bride.name}
          onSelect={(entry) => setSelected(entry)}
          className="pg-world"
        />
      </div>

      <div className="pg-actions">
        <button type="button" className="pg-primary" onClick={() => setSheet('join')}>
          캐릭터 만들고 축하 남기기
        </button>
        <button type="button" className="pg-secondary" onClick={() => setSheet('list')}>
          방명록 전체 보기
        </button>
      </div>

      <BottomSheet open={sheet === 'join'} onClose={() => setSheet('none')} title="축하 남기기">
        <JoinFlow onSubmit={handleAdd} scope={scope} />
      </BottomSheet>

      <BottomSheet
        open={sheet === 'list'}
        onClose={() => setSheet('none')}
        title="방명록"
        headerExtra={!loading && !error ? `${guestCount}명` : undefined}
      >
        <GuestList
          entries={entries}
          myIds={myIds}
          loading={loading}
          error={error}
          onRetry={reload}
          onLocate={locate}
          onDelete={handleDelete}
        />
      </BottomSheet>

      {selected && (
        <GuestCard
          entry={selected}
          mine={myIds.has(selected.id)}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onLocate={locate}
        />
      )}
    </section>
  )
}
