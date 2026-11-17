import { useEffect, useRef, useState } from 'react'

export interface RevealOptions {
  threshold?: number
  rootMargin?: string
  /** 한 번 나타나면 유지 (기본 true) */
  once?: boolean
}

/**
 * IntersectionObserver 기반 "화면에 들어오면 나타남" 훅.
 * prefers-reduced-motion 이거나 관찰자 미지원이면 즉시 노출합니다.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: RevealOptions = {},
): [React.RefObject<T | null>, boolean] {
  const { threshold = 0.14, rootMargin = '0px 0px -8% 0px', once = true } = options
  const ref = useRef<T | null>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setRevealed(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true)
            if (once) io.disconnect()
          } else if (!once) {
            setRevealed(false)
          }
        }
      },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, rootMargin, once])

  return [ref, revealed]
}
