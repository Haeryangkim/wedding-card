import { useEffect, useMemo, useState } from 'react'
import type { Appearance, NewGuestInput, Side } from '../types'
import { LIMITS } from '../types'
import { randomAppearance } from '../character'
import { charLen, hasFieldErrors, validateNewGuest } from '../validate'
import type { GuestFieldErrors } from '../validate'
import { CharacterCreator } from './CharacterCreator'
import { CharacterPreview } from './CharacterPreview'
import { sideLabel } from './format'
import { clearDraft, loadDraft, saveDraft } from './storage'
import './fields.css'
import './JoinFlow.css'

export interface JoinFlowProps {
  /** store.add 를 호출하는 쪽. 성공 시 resolve, 실패 시 reject(한국어 메시지) */
  onSubmit: (input: NewGuestInput) => Promise<void>
}

export function JoinFlow({ onSubmit }: JoinFlowProps) {
  const initial = useMemo(() => {
    const d = loadDraft()
    return {
      name: d?.name ?? '',
      side: (d?.side ?? 'groom') as Side,
      message: d?.message ?? '',
      appearance: d?.appearance ?? randomAppearance(),
    }
  }, [])

  const [step, setStep] = useState<1 | 2>(1)
  const [appearance, setAppearance] = useState<Appearance>(initial.appearance)
  const [name, setName] = useState(initial.name)
  const [side, setSide] = useState<Side>(initial.side)
  const [message, setMessage] = useState(initial.message)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<GuestFieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 작성 중 임시 저장(비밀번호 제외) — 시트를 실수로 닫아도 복구
  useEffect(() => {
    saveDraft({ name, side, message, appearance })
  }, [name, side, message, appearance])

  const msgLen = charLen(message)
  const overMax = msgLen > LIMITS.message

  const handleSubmit = async () => {
    if (submitting) return
    const nextErrors = validateNewGuest({ name, message, password })
    setErrors(nextErrors)
    setGeneralError(null)
    if (hasFieldErrors(nextErrors)) {
      setStep(2)
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({ name, message, side, appearance, password })
      clearDraft()
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : '등록에 실패했어요. 다시 시도해 주세요.')
      setSubmitting(false)
    }
  }

  return (
    <div className="join">
      <ol className="join-steps" aria-hidden="true">
        <li className={step === 1 ? 'is-active' : ''}>캐릭터</li>
        <li className={step === 2 ? 'is-active' : ''}>메시지</li>
      </ol>

      {step === 1 && (
        <div className="join-step">
          <p className="join-lead">나를 닮은 픽셀 캐릭터를 만들어 주세요.</p>
          <CharacterCreator value={appearance} onChange={setAppearance} />
          <button
            type="button"
            className="join-random"
            onClick={() => setAppearance(randomAppearance())}
          >
            🎲 랜덤으로 바꾸기
          </button>
          <button type="button" className="join-primary" onClick={() => setStep(2)}>
            다음
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="join-step">
          <div className="join-whoami">
            <CharacterPreview kind={appearance} scale={2} animate />
            <p className="join-lead">축하 메시지를 남겨 주세요.</p>
          </div>

          <label className="field">
            <span className="field-label">이름 / 별명</span>
            <input
              className={`field-input${errors.name ? ' has-error' : ''}`}
              type="text"
              value={name}
              maxLength={LIMITS.name}
              placeholder="예) 신랑 친구 민준"
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>

          <div className="field">
            <span className="field-label">어느 쪽 하객인가요?</span>
            <div className="side-toggle" role="group" aria-label="하객 구분">
              {(['groom', 'bride'] as Side[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`side-btn${side === s ? ' is-on' : ''}`}
                  aria-pressed={side === s}
                  onClick={() => setSide(s)}
                >
                  {sideLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field-label">
              축하 메시지
              <span className={`field-counter${overMax ? ' is-over' : ''}`}>
                {msgLen}/{LIMITS.message}
              </span>
            </span>
            <textarea
              className={`field-input field-textarea${errors.message ? ' has-error' : ''}`}
              value={message}
              maxLength={LIMITS.message}
              rows={3}
              placeholder="두 사람에게 전하고 싶은 축하의 말"
              onChange={(e) => setMessage(e.target.value)}
            />
            {errors.message && <span className="field-error">{errors.message}</span>}
          </label>

          <label className="field">
            <span className="field-label">
              삭제 비밀번호
              <span className="field-hint">나중에 내 글을 지울 때 사용해요</span>
            </span>
            <input
              className={`field-input${errors.password ? ' has-error' : ''}`}
              type="password"
              value={password}
              inputMode="numeric"
              autoComplete="off"
              placeholder="4자 이상"
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </label>

          {generalError && <p className="join-general-error">{generalError}</p>}

          <div className="join-actions">
            <button
              type="button"
              className="join-secondary"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              이전
            </button>
            <button
              type="button"
              className="join-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? '등록 중…' : '축하 남기기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
