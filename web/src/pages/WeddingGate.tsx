/**
 * 청첩장 불러오기 공용 관문 — 일반 청첩장(/w/<slug>)과 픽셀 청첩장(/w/<slug>/pixel)이 함께 쓴다.
 * 데모는 번들된 설정을 즉시, 그 외에는 API 로 불러오고 로딩 · 없음 · 서버 없음 · 오류 화면을 대신 그린다.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { DEMO_SLUG } from '../platform/contract'
import { getApi } from '../platform/api'
import { demoWedding } from '../platform/demo'
import { Link } from '../platform/router'
import type { WeddingInstance } from '../platform/WeddingContext'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { StatusPage } from './NotFound'
import './InvitationPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; wedding: WeddingInstance }
  | { status: 'missing' }
  | { status: 'noserver' }
  | { status: 'error'; message: string }

function initialState(slug: string): LoadState {
  if (slug === DEMO_SLUG) return { status: 'ready', wedding: demoWedding }
  if (!getApi().available) return { status: 'noserver' }
  return { status: 'loading' }
}

/** slug 로 청첩장을 불러온다. 데모는 번들된 설정을 즉시 사용 */
function useWeddingLoader(slug: string): [LoadState, () => void] {
  const [state, setState] = useState<LoadState>(() => initialState(slug))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const init = initialState(slug)
    setState(init)
    if (init.status !== 'loading') return
    let active = true
    getApi()
      .getWedding(slug)
      .then((record) => {
        if (!active) return
        setState(
          record
            ? { status: 'ready', wedding: { slug: record.slug, config: record.config, isDemo: false } }
            : { status: 'missing' },
        )
      })
      .catch((err: unknown) => {
        if (!active) return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : '청첩장을 불러오지 못했어요.',
        })
      })
    return () => {
      active = false
    }
  }, [slug, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return [state, retry]
}

function Skeleton() {
  return (
    <main className="page inv-skel" aria-busy="true" aria-label="청첩장을 불러오는 중">
      <div className="inv-skel__arch" />
      <div className="inv-skel__line inv-skel__line--sm" />
      <div className="inv-skel__line inv-skel__line--lg" />
      <div className="inv-skel__line inv-skel__line--md" />
      <div className="inv-skel__line inv-skel__line--sm" />
      <p className="inv-skel__text">청첩장을 불러오는 중…</p>
    </main>
  )
}

function Titled({ title, children }: { title: string; children: ReactNode }) {
  useDocumentTitle(title)
  return <>{children}</>
}

export interface WeddingGateProps {
  slug: string
  /** 불러온 청첩장으로 화면을 그린다. (다른 청첩장으로 이동하면 상태를 새로 시작하도록 key 는 호출부에서) */
  children: (wedding: WeddingInstance) => ReactNode
}

export function WeddingGate({ slug, children }: WeddingGateProps) {
  const [state, retry] = useWeddingLoader(slug)

  switch (state.status) {
    case 'ready':
      return <>{children(state.wedding)}</>
    case 'loading':
      return (
        <Titled title="청첩장">
          <Skeleton />
        </Titled>
      )
    case 'missing':
      return (
        <Titled title="청첩장을 찾을 수 없습니다">
          <StatusPage
            title="청첩장을 찾을 수 없습니다"
            message="주소가 정확한지 확인해 주세요. 청첩장이 삭제되었거나 주소가 바뀌었을 수 있어요."
          />
        </Titled>
      )
    case 'noserver':
      return (
        <Titled title="데모 배포 안내">
          <StatusPage
            title="이곳에서는 데모 청첩장만 볼 수 있어요"
            message="이 배포는 서버 없이 동작하는 데모라서, 직접 만든 청첩장은 열 수 없습니다. 받은 링크의 주소를 다시 확인해 주세요."
          >
            <Link className="btn btn--primary btn--block" to="/w/demo">
              데모 청첩장 보기
            </Link>
          </StatusPage>
        </Titled>
      )
    case 'error':
      return (
        <Titled title="청첩장을 불러오지 못했습니다">
          <StatusPage title="청첩장을 불러오지 못했습니다" message={state.message}>
            <button type="button" className="btn btn--primary btn--block" onClick={retry}>
              다시 시도
            </button>
          </StatusPage>
        </Titled>
      )
  }
}
