import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { lockScroll } from '../../lib/scrollLock'
import './BottomSheet.css'

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** 헤더 오른쪽에 넣을 보조 영역(선택) */
  headerExtra?: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** 포커스 트랩 + Esc/배경 닫기 + 바디 스크롤 잠금 + safe-area 를 갖춘 바텀시트 */
export function BottomSheet({ open, onClose, title, children, headerExtra }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  // 부모가 매 렌더마다 새 onClose 클로저를 넘겨도 아래 effect 가 다시 돌지 않도록 ref 로 보관.
  // (effect 가 재실행되면 포커스를 트리거 버튼 → 패널로 옮겨 입력 중인 필드의 포커스/키보드를 빼앗는다)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null

    const unlock = lockScroll()

    // 첫 포커스는 다이얼로그 패널 자체 (닫기 버튼에 포커스 링이 바로 뜨지 않도록)
    const panel = panelRef.current
    const raf = requestAnimationFrame(() => panel?.focus())

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (nodes.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown, true)
      unlock()
      restoreFocusRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  // 조상에 transform/will-change 가 있으면 position: fixed 가 뷰포트가 아닌 그 조상 기준이 되므로 body 로 포털
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <span className="sheet-grab" aria-hidden="true" />
          <h2 id={titleId} className="sheet-title">
            {title}
          </h2>
          <div className="sheet-header-extra">{headerExtra}</div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
