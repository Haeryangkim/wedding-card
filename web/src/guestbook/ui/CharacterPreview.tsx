import { useEffect, useMemo, useRef } from 'react'
import {
  appearanceKey,
  blitScale,
  ensureStyles,
  getSpriteAt,
  isStyleLoaded,
  styleStatus,
  spriteScale,
  styleOf,
  STYLE_META,
  type Dir,
  type SpriteKind,
} from '../styles/registry'
import { useStylesVersion } from '../styles/useStyle'
import './CharacterPreview.css'

export interface CharacterPreviewProps {
  /** 하객 외형(그림체 포함) 또는 신랑/신부 */
  kind: SpriteKind
  /**
   * 확대 배율 — 장면의 논리 px(= 기본 픽셀 캐릭터의 도트) 하나를 CSS px 몇 개로 그릴지 (기본 4).
   * 어떤 그림체든 같은 배율이면 키가 비슷하게 나온다.
   */
  scale?: number
  dir?: Dir
  /** true 면 제자리 걷기 애니메이션 */
  animate?: boolean
  /**
   * 상반신 썸네일: 상자 크기를 (20 x rows) x scale 로 고정하고 그 안에 머리부터 채운다.
   * 그림체마다 머리가 상자에 맞게 들어오도록 확대·위치를 정한다. 생략하면 전신.
   */
  rows?: number
  className?: string
}

/** 걷기 프레임 순서: 정지 → 왼발 → 정지 → 오른발 (자연스러운 보행) */
const WALK: (0 | 1 | 2)[] = [0, 1, 0, 2]
const STEP_MS = 180
/** 상반신 상자의 가로 (논리 px) — 기본 픽셀 스프라이트 너비 */
const BUST_W = 20

/**
 * 캐릭터 한 명을 그리는 작은 캔버스. 비트맵은 기기 해상도로 잡고,
 * 도트 그림체는 정수배 최근접 확대, 벡터 그림체는 그 해상도(dpr 2 까지)로 구운 캔버스를 옮긴다.
 * 그림체 모듈이 아직 없으면 자리만 잡아 두었다가(is-loading) 준비되면 그린다.
 * 불러오기에 실패하면 깜빡임을 멈춘다 (빈 자리로 남고, 다시 시도되면 이어진다).
 */
export function CharacterPreview({
  kind,
  scale = 4,
  dir = 'down',
  animate = false,
  rows,
  className,
}: CharacterPreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  // 외형 객체가 매 렌더 새로 만들어져도 내용이 같으면 다시 그리지 않도록 키로 비교
  const kindKey = appearanceKey(kind)
  const styleId = styleOf(kind)
  const version = useStylesVersion()
  const ready = isStyleLoaded(styleId)
  const loading = !ready && styleStatus(styleId) !== 'failed'

  // version: 실패 뒤 재시도 시점이 되면 다시 시도한다 (간격 제한은 registry 가 지킨다)
  useEffect(() => {
    if (!ready) ensureStyles([{ style: styleId }])
  }, [ready, styleId, version])

  const draw = useMemo(() => {
    return (frame: 0 | 1 | 2) => {
      const cv = ref.current
      if (!cv) return
      const ctx = cv.getContext('2d')
      if (!ctx) return
      const meta = STYLE_META[styleId]
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      // 논리 px 하나의 기기 픽셀 수 — 정수로 맞춰 도트가 고르게 보이게 한다 (소수 배율 화면·소수 scale 대비)
      const ppu = Math.max(1, Math.round(scale * dpr))
      /** 명목 1단위당 기기 픽셀 */
      let k: number
      let bw: number
      let bh: number
      let offY = 0
      if (rows != null) {
        bw = BUST_W * ppu
        bh = Math.round(Math.max(1, rows) * ppu)
        k = bw / meta.bust.w
        if (meta.snap) k = Math.max(1, Math.floor(k + 1e-6))
        offY = -Math.round(meta.bust.top * k)
      } else {
        k = spriteScale(styleId, ppu)
        bw = Math.ceil(meta.nominalW * k)
        bh = Math.ceil(meta.nominalH * k)
      }
      if (cv.width !== bw || cv.height !== bh) {
        cv.width = bw
        cv.height = bh
      }
      cv.style.width = `${bw / dpr}px`
      cv.style.height = `${bh / dpr}px`
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, bw, bh)
      const sprite = getSpriteAt(kind, dir, frame, k)
      if (!sprite) return
      const b = blitScale(styleId, k)
      const w = sprite.width * b
      const h = sprite.height * b
      ctx.imageSmoothingEnabled = !meta.pixelated
      ctx.drawImage(sprite, Math.round((bw - w) / 2), offY, w, h)
    }
    // kindKey 로 내용 동일성 비교 (kind 참조 변경 무시)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindKey, styleId, ready, dir, scale, rows])

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

  const cls = [
    'character-preview',
    STYLE_META[styleId].pixelated ? '' : 'character-preview--smooth',
    loading ? 'is-loading' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <canvas ref={ref} className={cls} role="img" aria-label="캐릭터 미리보기" aria-busy={loading || undefined} />
}
