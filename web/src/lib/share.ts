/** 공유 유틸 — 웹 공유 API(navigator.share)와 현재 주소 접근을 감쌉니다. */

export type ShareResult = 'shared' | 'cancelled' | 'unsupported' | 'error'

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** 현재 청첩장 주소 (VITE_SITE_URL 우선, 없으면 브라우저 주소) */
export function siteUrl(): string {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined
  if (configured) return configured
  return window.location.href
}

export interface SharePayload {
  title: string
  text: string
  url: string
}

export async function nativeShare(payload: SharePayload): Promise<ShareResult> {
  if (!canNativeShare()) return 'unsupported'
  try {
    await navigator.share(payload)
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    return 'error'
  }
}
