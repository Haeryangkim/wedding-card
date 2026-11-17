import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthToken, PlatformApi } from '../platform/contract'
import { errorStatus, errorText } from './errors'
import { Notice, TextField } from './ui'

interface GateProps {
  slug: string
  api: PlatformApi
  onLogin: (auth: AuthToken) => void
  /** 편집 중 로그인이 풀려 다시 묻는 경우 */
  expired?: boolean
}

/** 관리 비밀번호 입력 */
export function Gate({ slug, api, onLogin, expired }: GateProps) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (password === '') return setError('관리 비밀번호를 입력해 주세요.')
    setBusy(true)
    setError('')
    try {
      onLogin(await api.login(slug, password))
    } catch (err) {
      const status = errorStatus(err)
      if (status === 403) setError('비밀번호가 맞지 않아요. 다시 확인해 주세요.')
      else if (status === 429) setError('여러 번 틀려서 잠시 로그인이 막혔어요. 조금 뒤에 다시 시도해 주세요.')
      else if (status === 404) setError('청첩장을 찾을 수 없어요. 삭제되었을 수 있어요.')
      else setError(errorText(err, '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="ed-gate" onSubmit={submit} noValidate>
      <h1 className="ed-gate__title" id="gate-title">
        {expired ? '다시 로그인해 주세요' : '청첩장 관리'}
      </h1>
      <p className="ed-gate__lead">
        {expired ? (
          <>로그인 시간이 지났어요. 작성하던 내용은 그대로 남아 있으니 비밀번호만 다시 입력해 주세요.</>
        ) : (
          <>
            <strong className="ed-gate__slug">{slug}</strong> 청첩장을 만들 때 정한 관리 비밀번호를 입력해 주세요.
          </>
        )}
      </p>
      <input type="text" name="username" autoComplete="username" value={slug} readOnly hidden />
      <TextField
        path="gate.password"
        label="관리 비밀번호"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(v) => {
          setPassword(v)
          setError('')
        }}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
        {busy ? '확인하는 중…' : '로그인'}
      </button>
      <p className="ed-gate__foot">비밀번호는 서버에도 원문이 남지 않아 잊어버리면 되찾을 수 없어요.</p>
    </form>
  )
}
