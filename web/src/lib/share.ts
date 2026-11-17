/** 공유 유틸 — 웹 공유 API(navigator.share), 청첩장 주소, 공유 문구를 다룹니다. */
import type { WeddingConfig } from '../config/wedding'
import { formatKoreanDate } from './date'

export type ShareResult = 'shared' | 'cancelled' | 'unsupported' | 'error'

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * 순수 함수: 청첩장의 절대 주소. 테스트 대상.
 * @param siteUrl 빌드 시 지정한 서비스 절대 URL (VITE_SITE_URL, 없으면 빈 값)
 * @param origin  현재 오리진 (예: "https://example.com")
 * @param basePath 서빙 base 경로 (예: "/", "/wedding-card/")
 */
export function weddingUrlFor(slug: string, siteUrl: string, origin: string, basePath: string): string {
  const root = siteUrl ? siteUrl.replace(/\/*$/, '/') : `${origin}${basePath.replace(/\/*$/, '/')}`
  return `${root}w/${slug}`
}

/** 이 청첩장의 공유용 절대 주소 (VITE_SITE_URL 우선, 없으면 현재 오리진 + base 경로) */
export function weddingUrl(slug: string): string {
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined) ?? ''
  return weddingUrlFor(slug, configured, window.location.origin, import.meta.env.BASE_URL)
}

/** 같은 청첩장의 "픽셀 청첩장" 모습(/w/<slug>/pixel) 공유용 절대 주소 */
export function pixelWeddingUrl(slug: string): string {
  return `${weddingUrl(slug)}/pixel`
}

/** 픽셀 청첩장 링크의 공유 문구 — 일반 청첩장과 구분되도록 제목에 표시를 덧붙인다 (서버 pages.js 와 같은 규칙) */
export function pixelShareText(config: WeddingConfig): { title: string; description: string } {
  const { title, description } = shareText(config)
  return {
    title: `${title} · 픽셀 청첩장`,
    description: ['캐릭터가 되어 축하를 남겨 주세요', description].filter(Boolean).join(' · '),
  }
}

/**
 * 공유 제목/설명. config.share 가 비어 있으면 이름·일시·장소로 만든 문구로 대체합니다.
 * (편집 화면의 미리보기/자리표시 문구에도 그대로 쓸 수 있는 순수 함수)
 */
export function shareText(config: WeddingConfig): { title: string; description: string } {
  const title = config.share?.title?.trim() || `${config.groom.name} ♥ ${config.bride.name} 결혼합니다`
  let description = config.share?.description?.trim() ?? ''
  if (!description) {
    const date = new Date(config.datetime)
    const when = Number.isNaN(date.getTime()) ? '' : formatKoreanDate(date)
    description = [when, config.venue.name.trim()].filter(Boolean).join(' · ')
  }
  return { title, description }
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
