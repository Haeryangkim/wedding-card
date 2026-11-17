/**
 * 픽셀 청첩장 공용 팝업 프레임 — 도트 게임의 대화창 모양.
 * 마운트되면 열린 상태입니다(닫을 때는 부모가 언마운트). document.body 로 포털되고,
 * 포커스 가두기 · ESC · 배경 탭 닫기 · 바디 스크롤 잠금을 맡습니다.
 */
import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { lockScroll } from '../../lib/scrollLock'
import { PixelIcon, type PixelIconName } from './icons'
import './PixelPopup.css'

export interface PopupProps {
  onClose: () => void
}

interface PixelPopupProps extends PopupProps {
  title: string
  icon: PixelIconName
  children: ReactNode
  /** 본문 아래에 고정되는 영역 (주요 버튼) */
  footer?: ReactNode
  /** 지정하면 제목줄에 "뒤로" 버튼이 생기고 ESC 가 팝업을 닫는 대신 이 동작을 한다 (팝업 안의 2단계 화면용) */
  onBack?: () => void
  /** 본문 안쪽 여백을 없앤다 (사진 뷰어처럼 가장자리까지 쓰는 내용) */
  flush?: boolean
  className?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function PixelPopup({ title, icon, children, footer, onClose, onBack, flush, className }: PixelPopupProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const downOnBackdropRef = useRef(false)
  // 리스너를 다시 달지 않도록 최신 콜백만 ref 로 들고 있는다
  const closeRef = useRef(onClose)
  const backRef = useRef(onBack)
  useEffect(() => {
    closeRef.current = onClose
    backRef.current = onBack
  })

  useEffect(() => {
    const panel = panelRef.current
    const prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel?.focus({ preventScroll: true })
    const unlock = lockScroll()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (backRef.current) backRef.current()
        else closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      )
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!panel.contains(active) || active === panel) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      unlock()
      if (prevFocus && prevFocus.isConnected) prevFocus.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div
      className="pxpop"
      // 배경(패널 바깥)에서 누르고 뗐을 때만 닫는다. pointerdown 에서 바로 닫으면 팝업이 먼저 사라져
      // 터치의 합성 click 이 아래에 있던 HUD 버튼으로 떨어지므로, click 을 배경이 직접 받은 뒤에 닫는다.
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
        ref={panelRef}
        className={`pxpop__panel${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="pxpop__bar">
          {onBack ? (
            <button type="button" className="pxpop__barbtn" onClick={onBack} aria-label="뒤로">
              <PixelIcon name="back" size={18} />
            </button>
          ) : (
            <span className="pxpop__icon" aria-hidden="true">
              <PixelIcon name={icon} size={20} />
            </span>
          )}
          <h2 className="pxpop__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="pxpop__barbtn" onClick={onClose} aria-label="닫기">
            <PixelIcon name="close" size={18} />
          </button>
        </header>
        <div className={`pxpop__body${flush ? ' pxpop__body--flush' : ''}`}>{children}</div>
        {footer && <div className="pxpop__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
