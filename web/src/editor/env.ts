/** 편집 화면 섹션들이 공유하는 환경 */
import type { PlatformApi } from '../platform/contract'
import { getApi } from '../platform/api'
import type { EditorForm } from './form'
import type { FormErrors } from './validate'

export interface EditorEnv {
  slug: string
  api: PlatformApi
  /**
   * 관리 토큰이 필요한 호출. 토큰이 없거나 서버가 401 을 돌려주면 토큰을 버리고 로그인 화면을 띄운 뒤
   * 한국어 메시지의 Error 로 reject 한다 (폼 내용은 그대로 남는다).
   */
  authed: <T>(fn: (token: string) => Promise<T>) => Promise<T>
  toast: (message: string) => void
}

export type UpdateForm = (fn: (form: EditorForm) => EditorForm) => void

export interface SectionProps {
  form: EditorForm
  update: UpdateForm
  errors: FormErrors
}

/** 서버를 쓸 수 있는 빌드면 API 클라이언트, 아니면(데모 전용 배포) null */
export function availableApi(): PlatformApi | null {
  try {
    const api = getApi()
    return api.available ? api : null
  } catch {
    return null
  }
}
