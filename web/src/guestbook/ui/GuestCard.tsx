import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GuestEntry } from '../types'
import { CharacterPreview } from './CharacterPreview'
import { fullDate, sideLabel } from './format'
import { lockScroll } from '../../lib/scrollLock'
import './GuestCard.css'

export interface GuestCardProps {
  entry: GuestEntry
  mine: boolean
  onClose: () => void
  onDelete: (id: string, password: string) => Promise<void>
  /** 맵에서 이 캐릭터로 카메라 이동 */
  onLocate?: (id: string) => void
}

export function GuestCard({ entry, mine, onClose, onDelete, onLocate }: GuestCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  // onClose 는 부모 렌더마다 새 클로저일 수 있다 → ref 로 보관해 포커스 effect 는 마운트 시 1회만.
  const onCloseRef = useRef(onClose)
  const downOnBackdropRef = useRef(false)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const unlock = lockScroll()
    const raf = requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: true }))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey, true)
      unlock()
      prev?.focus?.({ preventScroll: true })
    }
  }, [])

  const confirmDelete = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await onDelete(entry.id, password)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제하지 못했어요.')
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="card-backdrop"
      onPointerDown={(e) => {
        downOnBackdropRef.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        const ok = downOnBackdropRef.current && e.target === e.currentTarget
        downOnBackdropRef.current = false
        if (ok) onClose()
      }}
    >
      <div
        ref={cardRef}
        className="guest-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${entry.name}님의 축하 메시지`}
        tabIndex={-1}
      >
        <button type="button" className="card-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>

        <div className="card-avatar">
          <CharacterPreview kind={entry.appearance} scale={3} dir="down" animate />
        </div>

        <div className="card-headline">
          <span className="card-name">{entry.name}</span>
          <span className={`side-chip side-${entry.side}`}>{sideLabel(entry.side)}</span>
          {mine && <span className="mine-badge">내 캐릭터</span>}
        </div>

        <p className="card-message">{entry.message}</p>
        <p className="card-date">{fullDate(entry.createdAt)}</p>

        <div className="card-actions">
          {onLocate && (
            <button type="button" className="card-ghost" onClick={() => onLocate(entry.id)}>
              맵에서 보기
            </button>
          )}
          {mine && !deleting && (
            <button type="button" className="card-ghost danger" onClick={() => setDeleting(true)}>
              삭제
            </button>
          )}
        </div>

        {mine && deleting && (
          <div className="card-delete">
            <label className="field">
              <span className="field-label">삭제 비밀번호</span>
              <input
                className={`field-input${error ? ' has-error' : ''}`}
                type="password"
                value={password}
                autoComplete="off"
                placeholder="등록할 때 정한 비밀번호"
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <span className="field-error">{error}</span>}
            </label>
            <div className="card-delete-actions">
              <button
                type="button"
                className="card-ghost"
                onClick={() => {
                  setDeleting(false)
                  setPassword('')
                  setError(null)
                }}
                disabled={busy}
              >
                취소
              </button>
              <button
                type="button"
                className="card-delete-confirm"
                onClick={confirmDelete}
                disabled={busy}
              >
                {busy ? '삭제 중…' : '삭제하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
