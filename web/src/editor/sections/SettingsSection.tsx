import { useState } from 'react'
import type { FormEvent } from 'react'
import { PLATFORM_LIMITS } from '../../platform/contract'
import type { EditorEnv } from '../env'
import { errorText } from '../errors'
import { Notice, TextField } from '../ui'
import { passwordError } from '../validate'

interface Props {
  env: EditorEnv
  /** 비밀번호를 바꾼 뒤 새 비밀번호로 다시 로그인 (실패하면 로그인 화면으로) */
  onPasswordChanged: (newPassword: string) => Promise<void>
  /** 청첩장이 삭제된 뒤 */
  onDeleted: () => void
}

export function SettingsSection({ env, onPasswordChanged, onDeleted }: Props) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwErrors, setPwErrors] = useState<{ pw?: string; pw2?: string }>({})
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const [typed, setTyped] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delError, setDelError] = useState('')

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    const errs = { pw: passwordError(pw) ?? undefined, pw2: pw2 !== pw ? '비밀번호가 서로 달라요.' : undefined }
    setPwErrors(errs)
    setPwMessage(null)
    if (errs.pw || errs.pw2) return
    setPwBusy(true)
    try {
      await env.authed((token) => env.api.changePassword(env.slug, token, pw))
      // 서버는 비밀번호가 바뀌면 지금 토큰을 무효로 만든다 → 새 비밀번호로 바로 다시 로그인
      await onPasswordChanged(pw)
      setPw('')
      setPw2('')
      setPwMessage({ tone: 'ok', text: '관리 비밀번호를 바꿨어요. 다음부터 새 비밀번호로 로그인해 주세요.' })
    } catch (err) {
      setPwMessage({ tone: 'error', text: errorText(err, '비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.') })
    } finally {
      setPwBusy(false)
    }
  }

  const deleteWedding = async (e: FormEvent) => {
    e.preventDefault()
    if (typed.trim() !== env.slug) return
    setDelBusy(true)
    setDelError('')
    try {
      await env.authed((token) => env.api.deleteWedding(env.slug, token))
      onDeleted()
    } catch (err) {
      setDelError(errorText(err, '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'))
      setDelBusy(false)
    }
  }

  return (
    <>
      <form className="ed-group" onSubmit={changePassword} noValidate>
        <h3 className="ed-group__legend">관리 비밀번호 변경</h3>
        {/* 비밀번호 관리자가 어느 청첩장의 비밀번호인지 알 수 있도록 */}
        <input type="text" name="username" autoComplete="username" value={env.slug} readOnly hidden />
        <div className="ed-grid">
          <TextField
            path="settings.password"
            label="새 비밀번호"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={setPw}
            error={pwErrors.pw}
            hint={`${PLATFORM_LIMITS.adminPasswordMin}자 이상`}
          />
          <TextField
            path="settings.password2"
            label="새 비밀번호 확인"
            type="password"
            autoComplete="new-password"
            value={pw2}
            onChange={setPw2}
            error={pwErrors.pw2}
          />
        </div>
        <p className="ed-help">비밀번호는 잊어버리면 되찾을 수 없어요. 두 분이 함께 기억할 수 있는 곳에 적어 두세요.</p>
        {pwMessage && <Notice tone={pwMessage.tone}>{pwMessage.text}</Notice>}
        <button type="submit" className="btn btn--soft" disabled={pwBusy || pw === ''}>
          {pwBusy ? '바꾸는 중…' : '비밀번호 변경'}
        </button>
      </form>

      <form className="ed-group ed-danger-zone" onSubmit={deleteWedding} noValidate>
        <h3 className="ed-group__legend">청첩장 삭제</h3>
        <p className="ed-help">
          청첩장과 사진, 방명록 글이 모두 지워지고 <strong>되돌릴 수 없어요.</strong> 이미 보낸 링크도 더 이상 열리지 않아요.
        </p>
        <TextField
          path="settings.delete"
          label={`확인을 위해 주소 이름(${env.slug})을 그대로 입력해 주세요`}
          value={typed}
          onChange={setTyped}
          autoCapitalize="none"
          spellCheck={false}
          placeholder={env.slug}
        />
        {delError && <Notice tone="error">{delError}</Notice>}
        <button type="submit" className="btn ed-btn-danger" disabled={delBusy || typed.trim() !== env.slug}>
          {delBusy ? '삭제하는 중…' : '청첩장 영구 삭제'}
        </button>
      </form>
    </>
  )
}
