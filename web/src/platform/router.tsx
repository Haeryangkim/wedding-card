/**
 * 의존성 없는 초소형 라우터 (History API). base path(import.meta.env.BASE_URL) 를 자동 처리합니다.
 * 라우트 정의는 platform/contract.ts 주석 참고.
 */
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'

export type Route =
  | { name: 'landing' }
  | { name: 'new' }
  | { name: 'wedding'; slug: string }
  | { name: 'edit'; slug: string }
  /** 같은 청첩장의 두 번째 모습: 한 화면짜리 "픽셀 청첩장" */
  | { name: 'pixel'; slug: string }
  | { name: 'notfound' }

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') // "" 또는 "/wedding-card"

/** 앱 내부 경로("/w/demo") → 실제 URL 경로("/wedding-card/w/demo") */
export function href(path: string): string {
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`
}

/** 순수 함수: 앱 내부 경로 → Route */
export function matchRoute(path: string): Route {
  const p = path.replace(/\/+$/, '') || '/'
  if (p === '/') return { name: 'landing' }
  if (p === '/new') return { name: 'new' }
  const m = /^\/w\/([a-z0-9-]+)(?:\/(edit|pixel))?$/.exec(p)
  if (m) {
    if (m[2] === 'edit') return { name: 'edit', slug: m[1] }
    if (m[2] === 'pixel') return { name: 'pixel', slug: m[1] }
    return { name: 'wedding', slug: m[1] }
  }
  return { name: 'notfound' }
}

/** 현재 location 의 앱 내부 경로 */
export function currentPath(): string {
  const p = window.location.pathname
  return BASE && p.startsWith(BASE) ? p.slice(BASE.length) || '/' : p
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const url = href(path)
  if (opts.replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  window.scrollTo(0, 0)
  emit()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  window.addEventListener('popstate', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('popstate', cb)
  }
}

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, currentPath)
  return matchRoute(path)
}

/** 내부 이동용 링크. 새 탭/수정키 클릭은 브라우저 기본 동작 유지 */
export function Link({ to, onClick, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (rest.target && rest.target !== '_self') return
    e.preventDefault()
    navigate(to)
  }
  return <a {...rest} href={href(to)} onClick={handle} />
}
