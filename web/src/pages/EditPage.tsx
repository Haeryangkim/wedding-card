/**
 * /w/:slug/edit — 관리 비밀번호로 로그인한 뒤 청첩장 내용을 고치는 화면.
 * 여기서는 로그인 상태(토큰)와 페이지 이탈 방지만 다루고, 편집 자체는 editor/Editor.tsx 가 맡는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../components/Toast'
import { DEMO_SLUG } from '../platform/contract'
import type { AuthToken, PlatformApi, WeddingRecord } from '../platform/contract'
import { Link, href, navigate } from '../platform/router'
import { Editor } from '../editor/Editor'
import { Gate } from '../editor/Gate'
import { availableApi } from '../editor/env'
import type { EditorEnv } from '../editor/env'
import { errorText, isUnauthorized } from '../editor/errors'
import { clearToken, loadToken, saveToken } from '../editor/session'
import { MessagePanel, Notice, Shell } from '../editor/ui'
import './EditPage.css'

const LEAVE_MESSAGE = '저장하지 않은 변경사항이 있어요. 이 화면을 나가면 사라져요. 나갈까요?'

type Load =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; record: WeddingRecord }
  | { kind: 'deleted' }

/** none: 로그인 전 · active: 편집 중 · expired: 편집 중 로그인이 풀림(폼은 그대로 두고 다시 묻는다) */
type Session = 'none' | 'active' | 'expired'

export default function EditPage({ slug }: { slug: string }) {
  const api = useMemo(() => availableApi(), [])
  return (
    <>
      {slug === DEMO_SLUG ? (
        <Shell>
          <MessagePanel title="데모 청첩장은 고칠 수 없어요">
            <p>데모는 누구나 둘러볼 수 있는 예시예요. 나만의 청첩장을 만들면 이 화면에서 내용을 자유롭게 바꿀 수 있어요.</p>
            <div className="ed-panel__actions">
              <Link className="btn btn--primary" to="/new">
                청첩장 만들기
              </Link>
              <Link className="btn btn--soft" to={`/w/${DEMO_SLUG}`}>
                데모 보기
              </Link>
            </div>
          </MessagePanel>
        </Shell>
      ) : api ? (
        <Manage key={slug} slug={slug} api={api} />
      ) : (
        <Shell>
          <MessagePanel title="이곳에서는 청첩장을 관리할 수 없어요">
            <p>
              지금 보고 계신 사이트는 서버 없이 운영되는 <strong>데모 전용</strong> 배포예요. 청첩장을 만들고 고치려면 서버가
              함께 설치된 사이트가 필요해요.
            </p>
            <div className="ed-panel__actions">
              <Link className="btn btn--primary" to={`/w/${DEMO_SLUG}`}>
                데모 청첩장 보기
              </Link>
              <Link className="btn btn--soft" to="/">
                처음으로
              </Link>
            </div>
          </MessagePanel>
        </Shell>
      )}
    </>
  )
}

function Manage({ slug, api }: { slug: string; api: PlatformApi }) {
  const toast = useToast()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [initialToken] = useState(() => loadToken(slug))
  const [session, setSession] = useState<Session>(initialToken ? 'active' : 'none')
  const tokenRef = useRef<string | null>(initialToken)
  const dirtyRef = useRef(false)

  const fetchRecord = useCallback(async () => {
    setLoad({ kind: 'loading' })
    try {
      const record = await api.getWedding(slug)
      setLoad(record ? { kind: 'ready', record } : { kind: 'notfound' })
    } catch (err) {
      setLoad({ kind: 'error', message: errorText(err, '청첩장을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') })
    }
  }, [api, slug])

  useEffect(() => {
    void fetchRecord()
  }, [fetchRecord])

  const dropToken = useCallback(() => {
    tokenRef.current = null
    clearToken(slug)
    setSession((s) => (s === 'active' ? 'expired' : s))
  }, [slug])

  const onLogin = useCallback(
    (auth: AuthToken) => {
      saveToken(slug, auth)
      tokenRef.current = auth.token
      setSession('active')
    },
    [slug],
  )

  const env: EditorEnv = useMemo(
    () => ({
      slug,
      api,
      toast: toast.show,
      authed: async (fn) => {
        const token = tokenRef.current
        const lost = () =>
          Object.assign(new Error('로그인이 풀렸어요. 관리 비밀번호로 다시 로그인한 뒤 한 번 더 시도해 주세요.'), {
            status: 401,
          })
        if (!token) {
          dropToken()
          throw lost()
        }
        try {
          return await fn(token)
        } catch (err) {
          if (!isUnauthorized(err)) throw err
          // 그사이 새로 로그인했다면(비밀번호 변경 등) 새 토큰은 건드리지 않는다
          if (tokenRef.current === token) dropToken()
          throw lost()
        }
      },
    }),
    [api, dropToken, slug, toast.show],
  )

  const onPasswordChanged = useCallback(
    async (newPassword: string) => {
      // 서버는 비밀번호가 바뀌면 이전 토큰을 모두 무효로 만든다
      tokenRef.current = null
      clearToken(slug)
      try {
        onLogin(await api.login(slug, newPassword))
      } catch {
        setSession('expired') // 자동 로그인 실패 → 새 비밀번호로 직접 로그인
      }
    },
    [api, onLogin, slug],
  )

  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  const confirmLeave = useCallback(() => !dirtyRef.current || window.confirm(LEAVE_MESSAGE), [])

  // 저장하지 않은 변경이 있으면: 새로고침·탭 닫기(beforeunload)와 뒤로 가기(popstate)를 한 번 막는다
  useEffect(() => {
    const here = href(`/w/${slug}/edit`)
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    const onPopState = (e: PopStateEvent) => {
      if (!dirtyRef.current || window.location.pathname.replace(/\/+$/, '') === here) return
      if (window.confirm(LEAVE_MESSAGE)) {
        dirtyRef.current = false
        return
      }
      // 라우터가 화면을 바꾸기 전에 원래 주소로 되돌린다
      e.stopImmediatePropagation()
      window.history.pushState(null, '', here)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('popstate', onPopState, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('popstate', onPopState, true)
    }
  }, [slug])

  const guardLink = (e: { preventDefault: () => void }) => {
    if (!confirmLeave()) e.preventDefault()
    else dirtyRef.current = false
  }

  const logout = () => {
    if (!confirmLeave()) return
    dirtyRef.current = false
    tokenRef.current = null
    clearToken(slug)
    setSession('none')
    toast.show('로그아웃했어요')
    void fetchRecord() // 다시 로그인하면 방금 저장한 내용부터 시작하도록
  }

  const onDeleted = useCallback(() => {
    dirtyRef.current = false
    tokenRef.current = null
    clearToken(slug)
    setSession('none')
    setLoad({ kind: 'deleted' })
    window.scrollTo(0, 0)
  }, [slug])

  let body
  if (load.kind === 'loading') {
    body = (
      <p className="ed-loading" role="status">
        청첩장을 불러오는 중이에요…
      </p>
    )
  } else if (load.kind === 'notfound') {
    body = (
      <MessagePanel title="청첩장을 찾을 수 없어요">
        <p>
          <strong>{slug}</strong> 주소로 만든 청첩장이 없어요. 주소를 다시 확인하시거나 새로 만들어 보세요.
        </p>
        <div className="ed-panel__actions">
          <Link className="btn btn--primary" to="/new">
            청첩장 만들기
          </Link>
          <Link className="btn btn--soft" to="/">
            처음으로
          </Link>
        </div>
      </MessagePanel>
    )
  } else if (load.kind === 'deleted') {
    body = (
      <MessagePanel title="청첩장을 삭제했어요">
        <p>청첩장과 사진, 방명록이 모두 지워졌어요. 그동안 이용해 주셔서 감사합니다.</p>
        <div className="ed-panel__actions">
          <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
            처음으로
          </button>
        </div>
      </MessagePanel>
    )
  } else if (load.kind === 'error') {
    body = (
      <MessagePanel title="잠시 문제가 생겼어요">
        <Notice tone="error">{load.message}</Notice>
        <div className="ed-panel__actions">
          <button type="button" className="btn btn--primary" onClick={() => void fetchRecord()}>
            다시 시도
          </button>
        </div>
      </MessagePanel>
    )
  } else if (session === 'none') {
    body = (
      <div className="ed-gate-wrap">
        <Gate slug={slug} api={api} onLogin={onLogin} />
        <p className="ed-gate-wrap__link">
          <Link to={`/w/${slug}`}>청첩장 보러 가기</Link>
        </p>
      </div>
    )
  } else {
    body = (
      <>
        <div inert={session === 'expired'}>
          <Editor
            env={env}
            initialConfig={load.record.config}
            onPasswordChanged={onPasswordChanged}
            onDeleted={onDeleted}
            onLogout={logout}
            onDirtyChange={onDirtyChange}
          />
        </div>
        {session === 'expired' && (
          <div className="ed-overlay" role="dialog" aria-modal="true" aria-labelledby="gate-title">
            <div className="ed-overlay__panel">
              <Gate slug={slug} api={api} onLogin={onLogin} expired />
            </div>
          </div>
        )}
      </>
    )
  }

  return <Shell onHomeClick={guardLink}>{body}</Shell>
}
