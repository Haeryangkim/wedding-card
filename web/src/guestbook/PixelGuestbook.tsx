import { useEffect, useState } from 'react'
import type { GuestEntry, NewGuestInput } from './types'
import { useGuestbook } from './useGuestbook'
import { useWedding } from '../platform/WeddingContext'
import { WorldCanvas } from './ui/WorldCanvas'
import { BottomSheet } from './ui/BottomSheet'
import { JoinFlow } from './ui/JoinFlow'
import { GuestList } from './ui/GuestList'
import { GuestCard } from './ui/GuestCard'
import './PixelGuestbook.css'

type SheetKind = 'none' | 'join' | 'list'

export function PixelGuestbook() {
  const { slug, isDemo, config } = useWedding()
  const { mode, entries, loading, error, myIds, scope, reload, add, remove } = useGuestbook(slug, isDemo)
  const [focusId, setFocusId] = useState<string | null>(null)
  // 같은 하객을 다시 "위치 보기" 해도 동작하도록, 포커스는 (id, 요청 번호) 쌍으로 전달한다.
  const [focusSeq, setFocusSeq] = useState(0)
  const [selected, setSelected] = useState<GuestEntry | null>(null)
  const [sheet, setSheet] = useState<SheetKind>('none')

  // 선택한 캐릭터가 (다른 탭 등에서) 사라지면 카드 닫기
  useEffect(() => {
    if (selected && !entries.some((e) => e.id === selected.id)) setSelected(null)
  }, [entries, selected])

  const handleAdd = async (input: NewGuestInput) => {
    const entry = await add(input)
    setSheet('none')
    setSelected(null)
    setFocusId(entry.id)
    setFocusSeq((n) => n + 1)
  }

  const handleDelete = async (id: string, password: string) => {
    await remove(id, password)
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
