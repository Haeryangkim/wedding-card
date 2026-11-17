import { useEffect, useMemo, useRef } from 'react'
import type { Dir, SpriteKind } from '../character'
import { getSprite, SPRITE_H, SPRITE_W } from '../character'
import './CharacterPreview.css'

export interface CharacterPreviewProps {
  kind: SpriteKind
  /** 정수 확대 배율 (기본 4) */
  scale?: number
  dir?: Dir
  /** true 면 제자리 걷기 애니메이션 */
  animate?: boolean
  className?: string
}

/** 걷기 프레임 순서: 정지 → 왼발 → 정지 → 오른발 (자연스러운 보행) */
const WALK: (0 | 1 | 2)[] = [0, 1, 0, 2]
const STEP_MS = 180

/** 캐릭터 한 명을 그리는 작은 캔버스. 정수 확대 · devicePixelRatio 대응 · smoothing off. */
export function CharacterPreview({
  kind,
  scale = 4,
  dir = 'down',
  animate = false,
  className,
}: CharacterPreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  // 외형 객체가 매 렌더 새로 만들어져도 내용이 같으면 다시 그리지 않도록 키로 비교
  const kindKey = typeof kind === 'string' ? kind : JSON.stringify(kind)

  const draw = useMemo(() => {
    return (frame: 0 | 1 | 2) => {
      const cv = ref.current
      if (!cv) return
      const ctx = cv.getContext('2d')
      if (!ctx) return
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const cssW = SPRITE_W * scale
      const cssH = SPRITE_H * scale
      const bw = Math.round(cssW * dpr)
      const bh = Math.round(cssH * dpr)
      if (cv.width !== bw || cv.height !== bh) {
        cv.width = bw
        cv.height = bh
      }
      cv.style.width = `${cssW}px`
      cv.style.height = `${cssH}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, cssW, cssH)
      ctx.drawImage(getSprite(kind, dir, frame), 0, 0, cssW, cssH)
    }
    // kindKey 로 내용 동일성 비교 (kind 참조 변경 무시)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindKey, dir, scale])

  // 정지 상태 그리기
  useEffect(() => {
    draw(0)
  }, [draw])

  // 걷기 애니메이션 (화면 밖/모션 축소 시 정지)
  useEffect(() => {
    if (!animate) return
    const reduce =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    let visible = true
    const el = ref.current
    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(
            (entries) => {
              for (const e of entries) visible = e.isIntersecting
            },
            { threshold: 0 },
          )
        : null
    if (io && el) io.observe(el)

    let raf = 0
    let last = 0
    let i = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (!visible) return
      if (t - last >= STEP_MS) {
        last = t
        i = (i + 1) % WALK.length
        draw(WALK[i])
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      if (io) io.disconnect()
      draw(0)
    }
  }, [animate, draw])

  return (
    <canvas
      ref={ref}
      className={`character-preview${className ? ` ${className}` : ''}`}
      role="img"
      aria-label="캐릭터 미리보기"
    />
  )
}
