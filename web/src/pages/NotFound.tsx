import { Link } from '../platform/router'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import './NotFound.css'

export interface StatusPageProps {
  title?: string
  message?: string
  /** 버튼 위에 추가로 넣을 액션 (예: 다시 시도) */
  children?: React.ReactNode
}

/** 종이 한 장짜리 안내 화면 (404 · 오류 · 서버 없음 공용) */
export function StatusPage({ title, message, children }: StatusPageProps) {
  return (
    <main className="page status-page">
      <div className="status-page__body">
        <svg className="status-page__art" viewBox="0 0 13 11" width="78" height="66" aria-hidden="true" shapeRendering="crispEdges">
          <path
            fill="var(--accent-soft)"
            d="M1 1h11v9H1z"
          />
          <path
            fill="var(--accent)"
            d="M0 0h13v1H0zM0 10h13v1H0zM0 1h1v9H0zM12 1h1v9h-1zM1 1h1v1H1zM2 2h1v1H2zM3 3h1v1H3zM4 4h1v1H4zM5 5h1v1H5zM6 6h1v1H6zM7 5h1v1H7zM8 4h1v1H8zM9 3h1v1H9zM10 2h1v1h-1zM11 1h1v1h-1z"
          />
        </svg>
        <h1 className="status-page__title">{title}</h1>
        {message && <p className="status-page__msg">{message}</p>}
        <div className="status-page__actions">
          {children}
          <Link className="btn btn--soft btn--block" to="/">
            처음으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function NotFound() {
  useDocumentTitle('페이지를 찾을 수 없습니다')
  return (
    <StatusPage
      title="페이지를 찾을 수 없습니다"
      message="주소가 바뀌었거나 잘못 입력되었을 수 있어요. 주소를 다시 한번 확인해 주세요."
    >
      <Link className="btn btn--primary btn--block" to="/w/demo">
        데모 청첩장 보기
      </Link>
    </StatusPage>
  )
}
