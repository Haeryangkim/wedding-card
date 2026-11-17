import { useCallback, useEffect, useState } from 'react'
import type { GuestEntry } from '../../guestbook/types'
import type { EditorEnv } from '../env'
import { errorStatus, errorText } from '../errors'
import { fetchGuests } from '../guests'
import { Notice } from '../ui'

const dateFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; entries: GuestEntry[] }

/** active: 카드가 펼쳐졌을 때만 불러온다 */
export function GuestsSection({ env, active }: { env: EditorEnv; active: boolean }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoad({ kind: 'loading' })
    try {
      const entries = await fetchGuests(env.slug)
      // 최신 글이 위로
      setLoad({ kind: 'ready', entries: [...entries].sort((a, b) => b.createdAt - a.createdAt) })
    } catch (err) {
      setLoad({ kind: 'error', message: errorText(err, '방명록을 불러오지 못했어요.') })
    }
  }, [env.slug])

  useEffect(() => {
    if (active) void refresh()
  }, [active, refresh])

  const remove = async (id: string) => {
    setBusyId(id)
    setError('')
    try {
      await env.authed((token) => env.api.deleteGuestAsOwner(env.slug, token, id))
    } catch (err) {
      // 이미 지워진 글(404)은 성공으로 본다
      if (errorStatus(err) !== 404) {
        setError(errorText(err, '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'))
        setBusyId(null)
        return
      }
    }
    setLoad((cur) => (cur.kind === 'ready' ? { kind: 'ready', entries: cur.entries.filter((g) => g.id !== id) } : cur))
    setBusyId(null)
    setConfirmId(null)
    env.toast('방명록 글을 삭제했어요')
  }

  if (load.kind === 'loading') return <p className="ed-empty">방명록을 불러오는 중이에요…</p>
  if (load.kind === 'error') {
    return (
      <>
        <Notice tone="error">{load.message}</Notice>
        <button type="button" className="btn btn--soft btn--sm" onClick={() => void refresh()}>
          다시 불러오기
        </button>
      </>
    )
  }

  const { entries } = load
  return (
    <>
      <div className="ed-guests__head">
        <p className="ed-help">
          하객이 남긴 글 {entries.length}개 · 부적절한 글은 여기서 지울 수 있어요. 지운 글은 되돌릴 수 없어요.
        </p>
        <button type="button" className="btn btn--soft btn--sm" onClick={() => void refresh()}>
          새로고침
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {entries.length === 0 ? (
        <p className="ed-empty">아직 방명록 글이 없어요. 청첩장을 공유하면 여기에 쌓여요.</p>
      ) : (
        <ul className="ed-guests">
          {entries.map((g) => (
            <li className="ed-guest" key={g.id}>
              <div className="ed-guest__text">
                <p className="ed-guest__meta">
                  <strong>{g.name}</strong>
                  <span className={`ed-guest__side ed-guest__side--${g.side}`}>{g.side === 'groom' ? '신랑측' : '신부측'}</span>
                  <time dateTime={new Date(g.createdAt).toISOString()}>{dateFmt.format(g.createdAt)}</time>
                </p>
                <p className="ed-guest__message">{g.message}</p>
              </div>
              {confirmId === g.id ? (
                <div className="ed-guest__confirm">
                  <button
                    type="button"
                    className="btn btn--sm ed-btn-danger"
                    disabled={busyId === g.id}
                    onClick={() => void remove(g.id)}
                  >
                    {busyId === g.id ? '삭제 중…' : '삭제하기'}
                  </button>
                  <button type="button" className="btn btn--soft btn--sm" disabled={busyId === g.id} onClick={() => setConfirmId(null)}>
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn--soft btn--sm ed-guest__delete"
                  aria-label={`${g.name} 님의 글 삭제`}
                  onClick={() => {
                    setError('')
                    setConfirmId(g.id)
                  }}
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
