import { useEffect } from 'react'

export const SERVICE_NAME = '픽셀 청첩장'

/** 화면별 document.title. page 를 생략하면 서비스 이름만 표시 */
export function useDocumentTitle(page?: string, raw = false): void {
  useEffect(() => {
    document.title = page ? (raw ? page : `${page} · ${SERVICE_NAME}`) : SERVICE_NAME
  }, [page, raw])
}
