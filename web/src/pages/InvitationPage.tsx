import { useCallback, useEffect, useState } from 'react'
import { Reveal } from '../components/Reveal'
import { Cover } from '../sections/Cover'
import { Greeting } from '../sections/Greeting'
import { Calendar } from '../sections/Calendar'
import { Gallery } from '../sections/Gallery'
import { Location } from '../sections/Location'
import { Accounts } from '../sections/Accounts'
import { Guestbook } from '../sections/Guestbook'
import { ShareFooter } from '../sections/ShareFooter'
import { DEMO_SLUG } from '../platform/contract'
import { getApi } from '../platform/api'
import { demoWedding } from '../platform/demo'
import { Link } from '../platform/router'
import { WeddingProvider, type WeddingInstance } from '../platform/WeddingContext'
import { shareText } from '../lib/share'
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

function DemoRibbon() {
  return (
    <aside className="demo-ribbon" aria-label="데모 안내">
      <Link className="demo-ribbon__home" to="/" aria-label="픽셀 청첩장 소개로 이동">
        데모 청첩장입니다
      </Link>
      <Link className="demo-ribbon__cta" to="/new">
        나도 만들기
      </Link>
    </aside>
  )
}

function Invitation({ wedding }: { wedding: WeddingInstance }) {
  useDocumentTitle(shareText(wedding.config).title, true)
  return (
    <WeddingProvider value={wedding}>
      {wedding.isDemo && <DemoRibbon />}
      <main className="page">
        <Cover />
        <Reveal>
          <Greeting />
        </Reveal>
        <div className="section-divider" />
        <Reveal>
          <Calendar />
        </Reveal>
        <Reveal>
          <Gallery />
        </Reveal>
        <Reveal>
          <Location />
        </Reveal>
        <Reveal>
          <Accounts />
        </Reveal>
        <Reveal>
          <Guestbook />
        </Reveal>
        <div className="section-divider" />
        <Reveal>
          <ShareFooter />
        </Reveal>
      </main>
    </WeddingProvider>
  )
}

function Titled({ title, children }: { title: string; children: React.ReactNode }) {
  useDocumentTitle(title)
  return <>{children}</>
}

export default function InvitationPage({ slug }: { slug: string }) {
  const [state, retry] = useWeddingLoader(slug)

  switch (state.status) {
    case 'ready':
      // key: 다른 청첩장으로 이동하면 섹션 상태(열린 시트 등)를 새로 시작
      return <Invitation key={state.wedding.slug} wedding={state.wedding} />
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
