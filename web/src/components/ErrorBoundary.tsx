import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  /** 오류가 났을 때 대신 보여 줄 화면 */
  fallback: ReactNode
  children: ReactNode
}

interface State {
  failed: boolean
}

/**
 * 화면을 그리다 난 오류(지연 로딩 청크 실패 포함)를 잡아 빈 화면 대신 안내를 보여 준다.
 * 다른 화면으로 이동하면 다시 시도하도록, 쓰는 쪽에서 경로를 key 로 넘겨 새로 만든다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('화면을 그리지 못했습니다', error, info.componentStack)
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
