import { useMemo, useState } from 'react'
import type { GuestEntry } from '../types'
import { CharacterPreview } from './CharacterPreview'
import { relativeTime, sideLabel } from './format'
import './GuestList.css'

export interface GuestListProps {
  entries: GuestEntry[]
  myIds: Set<string>
  loading: boolean
  error: string | null
  onRetry: () => void
  /** 맵에서 찾기 — 시트를 닫고 해당 캐릭터로 카메라 이동 */
  onLocate: (id: string) => void
  onDelete: (id: string, password: string) => Promise<void>
}

export function GuestList({
  entries,
  myIds,
  loading,
  error,
  onRetry,
  onLocate,
  onDelete,
}: GuestListProps) {
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [rowError, setRowError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt)
    if (!q) return sorted
    return sorted.filter(
      (e) => e.name.toLowerCase().includes(q) || e.message.toLowerCase().includes(q),
    )
  }, [entries, query])

  const startDelete = (id: string) => {
    setDeletingId(id)
    setPassword('')
    setRowError(null)
  }

  const confirmDelete = async (id: string) => {
    if (busy) return
    setBusy(true)
    setRowError(null)
    try {
      await onDelete(id, password)
      setDeletingId(null)
      setPassword('')
    } catch (err) {
      setRowError(err instanceof Error ? err.message : '삭제하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glist">
      <div className="glist-search">
        <input
          className="glist-search-input"
          type="search"
          value={query}
          placeholder="이름 또는 메시지 검색"
          onChange={(e) => setQuery(e.target.value)}
          aria-label="방명록 검색"
        />
      </div>

      {loading ? (
        <ul className="glist-items" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="glist-item is-skeleton">
              <span className="glist-thumb skeleton-box" />
              <span className="glist-lines">
                <span className="skeleton-box skeleton-line short" />
                <span className="skeleton-box skeleton-line" />
              </span>
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="glist-empty">
          <p>{error}</p>
          <button type="button" className="glist-retry" onClick={onRetry}>
            다시 시도
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glist-empty">
          <p>{query.trim() ? '검색 결과가 없어요.' : '아직 축하 메시지가 없어요.\n첫 번째 하객이 되어 주세요!'}</p>
        </div>
      ) : (
        <ul className="glist-items">
          {filtered.map((entry) => {
            const mine = myIds.has(entry.id)
            return (
              <li key={entry.id} className="glist-item">
                <div className="glist-main">
                  <span className="glist-thumb">
                    <CharacterPreview kind={entry.appearance} scale={2} rows={24} dir="down" />
                  </span>
                  <div className="glist-lines">
                    <div className="glist-top">
                      <span className="glist-name">{entry.name}</span>
                      <span className={`side-chip side-${entry.side}`}>{sideLabel(entry.side)}</span>
                      {mine && <span className="mine-badge">내 캐릭터</span>}
                      <span className="glist-date">{relativeTime(entry.createdAt)}</span>
                    </div>
                    <p className="glist-message">{entry.message}</p>
                  </div>
                  <button
                    type="button"
                    className="glist-find"
                    onClick={() => onLocate(entry.id)}
                  >
                    찾기
                  </button>
                </div>

                {mine && deletingId !== entry.id && (
                  <button
                    type="button"
                    className="glist-delete-trigger"
                    onClick={() => startDelete(entry.id)}
                  >
                    내 글 삭제
                  </button>
                )}

                {mine && deletingId === entry.id && (
                  <div className="glist-delete">
                    <input
                      className={`field-input${rowError ? ' has-error' : ''}`}
                      type="password"
                      value={password}
                      autoComplete="off"
                      placeholder="삭제 비밀번호"
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {rowError && <span className="field-error">{rowError}</span>}
                    <div className="glist-delete-actions">
                      <button
                        type="button"
                        className="glist-ghost"
                        onClick={() => setDeletingId(null)}
                        disabled={busy}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        className="glist-ghost danger"
                        onClick={() => confirmDelete(entry.id)}
                        disabled={busy}
                      >
                        {busy ? '삭제 중…' : '삭제'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
