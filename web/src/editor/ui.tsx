/** 편집 화면 공용 UI 조각: 입력 필드, 접히는 카드, 안내 상자 */
import { useId } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { SERVICE_NAME } from '../lib/useDocumentTitle'
import { Link } from '../platform/router'
import './editor.css'

/** 오류 위치로 스크롤할 때 찾는 DOM id */
export const fieldId = (path: string) => `f-${path}`

interface FieldShellProps {
  path: string
  label: string
  optional?: boolean
  hint?: ReactNode
  error?: string
  children: ReactNode
  className?: string
}

function FieldShell({ path, label, optional, hint, error, children, className }: FieldShellProps) {
  const id = fieldId(path)
  return (
    <div className={`ed-field${error ? ' has-error' : ''}${className ? ` ${className}` : ''}`}>
      <label className="ed-field__label" htmlFor={id}>
        {label}
        {optional && <span className="ed-field__optional">선택</span>}
      </label>
      {children}
      {error ? (
        <p className="ed-field__error" id={`${id}-err`} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className="ed-field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}

const describedBy = (path: string, error?: string, hint?: ReactNode) =>
  error ? `${fieldId(path)}-err` : hint ? `${fieldId(path)}-hint` : undefined

interface TextFieldProps {
  path: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: ReactNode
  optional?: boolean
  type?: 'text' | 'tel' | 'url' | 'date' | 'time' | 'password' | 'search'
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  placeholder?: string
  maxLength?: number
  className?: string
  disabled?: boolean
  /** 입력 오른쪽에 붙는 단위 등 */
  suffix?: string
  onBlur?: () => void
  autoCapitalize?: string
  spellCheck?: boolean
  /** <datalist> id (추천 값) */
  list?: string
  min?: string
  max?: string
}

export function TextField(p: TextFieldProps) {
  const input = (
    <input
      id={fieldId(p.path)}
      className="ed-input"
      type={p.type ?? 'text'}
      inputMode={p.inputMode}
      autoComplete={p.autoComplete ?? 'off'}
      autoCapitalize={p.autoCapitalize}
      spellCheck={p.spellCheck}
      placeholder={p.placeholder}
      maxLength={p.maxLength}
      list={p.list}
      min={p.min}
      max={p.max}
      value={p.value}
      disabled={p.disabled}
      aria-invalid={p.error ? true : undefined}
      aria-describedby={describedBy(p.path, p.error, p.hint)}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
    />
  )
  return (
    <FieldShell path={p.path} label={p.label} optional={p.optional} hint={p.hint} error={p.error} className={p.className}>
      {p.suffix ? (
        <div className="ed-input-wrap">
          {input}
          <span className="ed-input-wrap__suffix">{p.suffix}</span>
        </div>
      ) : (
        input
      )}
    </FieldShell>
  )
}

interface TextAreaProps {
  path: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: ReactNode
  optional?: boolean
  rows?: number
  placeholder?: string
  className?: string
}

export function TextArea(p: TextAreaProps) {
  return (
    <FieldShell path={p.path} label={p.label} optional={p.optional} hint={p.hint} error={p.error} className={p.className}>
      <textarea
        id={fieldId(p.path)}
        className="ed-input ed-input--area"
        rows={p.rows ?? 4}
        placeholder={p.placeholder}
        value={p.value}
        aria-invalid={p.error ? true : undefined}
        aria-describedby={describedBy(p.path, p.error, p.hint)}
        onChange={(e) => p.onChange(e.target.value)}
      />
    </FieldShell>
  )
}

export function CheckField(p: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId()
  return (
    <label className="ed-check" htmlFor={id}>
      <input id={id} type="checkbox" checked={p.checked} onChange={(e) => p.onChange(e.target.checked)} />
      <span>{p.label}</span>
    </label>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  return (
    <div className={`ed-notice ed-notice--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  )
}

interface SectionCardProps {
  id: string
  title: string
  /** 접혀 있을 때 보이는 한 줄 요약 */
  summary?: string
  /** "입력 필요" 같은 작은 표시 */
  badge?: { text: string; tone: 'todo' | 'error' | 'ok' }
  open: boolean
  onToggle: () => void
  children: ReactNode
}

/** 접었다 펼 수 있는 편집 카드. 접혀 있어도 내용은 DOM 에 남아 입력값이 유지된다 */
export function SectionCard({ id, title, summary, badge, open, onToggle, children }: SectionCardProps) {
  const bodyId = `sec-${id}-body`
  return (
    <section className={`ed-card${open ? ' is-open' : ''}`} id={`sec-${id}`}>
      <h2 className="ed-card__heading">
        <button type="button" className="ed-card__toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <span className="ed-card__titles">
            <span className="ed-card__title">{title}</span>
            {summary && !open && <span className="ed-card__summary">{summary}</span>}
          </span>
          {badge && <span className={`ed-badge ed-badge--${badge.tone}`}>{badge.text}</span>}
          <svg className="ed-card__chevron" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h2>
      <div className="ed-card__body" id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  )
}

/** 작은 아이콘 버튼 (위/아래/삭제). 터치 영역 44px */
export function IconButton(p: {
  label: string
  onClick: () => void
  disabled?: boolean
  icon: 'up' | 'down' | 'remove'
  danger?: boolean
}) {
  const d = p.icon === 'up' ? 'M5 12l5-5 5 5' : p.icon === 'down' ? 'M5 8l5 5 5-5' : 'M6 6l8 8M14 6l-8 8'
  return (
    <button
      type="button"
      className={`ed-icon-btn${p.danger ? ' ed-icon-btn--danger' : ''}`}
      aria-label={p.label}
      title={p.label}
      disabled={p.disabled}
      onClick={p.onClick}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/** 만들기·관리 화면 공통 틀: 얇은 상단 바 + 가운데 정렬된 본문 */
export function Shell({ children, onHomeClick }: { children: ReactNode; onHomeClick?: (e: { preventDefault: () => void }) => void }) {
  return (
    <div className="ed-page">
      <div className="ed-topbar">
        <Link className="ed-topbar__brand" to="/" onClick={onHomeClick}>
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M10 16.5s-6-3.6-6-8.1A3.4 3.4 0 0 1 10 6a3.4 3.4 0 0 1 6 2.4c0 4.5-6 8.1-6 8.1z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          {SERVICE_NAME}
        </Link>
      </div>
      <main className="ed-main">{children}</main>
    </div>
  )
}

/** 안내 한 장 (찾을 수 없음, 서버 없음 등) */
export function MessagePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ed-panel">
      <h1 className="ed-panel__title">{title}</h1>
      {children}
    </div>
  )
}
