import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './BottomSheet.css'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/** 하단에서 올라오는 모달 시트. 배경 탭/ESC 로 닫힙니다. */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  return createPortal(
    <div className={`sheet${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <button
        type="button"
        className="sheet__scrim"
        aria-label="닫기"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-label={title ?? '옵션'}>
        <span className="sheet__grip" aria-hidden="true" />
        {title && <h3 className="sheet__title">{title}</h3>}
        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
