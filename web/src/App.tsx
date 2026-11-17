import { lazy, Suspense } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { lazyRetry } from './platform/lazyRetry'
import { useRoute } from './platform/router'
import type { Route } from './platform/router'
import Landing from './pages/Landing'
import InvitationPage from './pages/InvitationPage'
import NotFound, { StatusPage } from './pages/NotFound'

// 만들기/관리 화면은 필요할 때만 불러온다 (청첩장을 보는 하객에게는 불필요한 코드).
// 새 버전 배포로 예전 청크가 사라졌을 때를 대비해 재시도 → 새로고침 순으로 복구한다.
const CreatePage = lazy(lazyRetry(() => import('./pages/CreatePage')))
const EditPage = lazy(lazyRetry(() => import('./pages/EditPage')))

/** 화면을 그리다 오류가 났을 때 빈 화면 대신 보여 주는 안내 */
function CrashScreen() {
  return (
    <StatusPage
      title="화면을 불러오지 못했어요"
      message="일시적인 문제이거나 사이트가 새 버전으로 바뀌었을 수 있어요. 새로고침하면 대부분 해결돼요."
    >
      <button type="button" className="btn btn--primary btn--block" onClick={() => window.location.reload()}>
        새로고침
      </button>
    </StatusPage>
  )
}

function RouteFallback() {
  return (
    <main className="page route-fallback" aria-busy="true">
      <p>불러오는 중…</p>
    </main>
  )
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'landing':
      return <Landing />
    case 'new':
      return <CreatePage />
    case 'edit':
      return <EditPage key={route.slug} slug={route.slug} />
    case 'wedding':
      return <InvitationPage slug={route.slug} />
    case 'notfound':
      return <NotFound />
  }
}

export default function App() {
  const route = useRoute()
  // 다른 화면으로 이동하면 오류 상태를 버리고 다시 그린다
  const routeKey = 'slug' in route ? `${route.name}:${route.slug}` : route.name
  return (
    <ToastProvider>
      <ErrorBoundary key={routeKey} fallback={<CrashScreen />}>
        <Suspense fallback={<RouteFallback />}>
          <Screen route={route} />
        </Suspense>
      </ErrorBoundary>
    </ToastProvider>
  )
}
