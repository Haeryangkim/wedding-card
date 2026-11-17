import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { wedding } from '../config/wedding'
import { SectionHeading } from '../components/SectionHeading'
import './Gallery.css'

const asset = (p: string) => import.meta.env.BASE_URL + p.replace(/^\/+/, '')

function PlaceholderTile({ i }: { i: number }) {
  return (
    <div className={`gallery__ph gallery__ph--${i % 3}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" width="34" height="34">
        <path
          fill="currentColor"
          opacity="0.55"
          d="M24 6c3 6 7 8 12 9-5 1-9 3-12 9-3-6-7-8-12-9 5-1 9-3 12-9zm0 20c2 4 4.6 5.3 8 6-3.4.7-6 2-8 6-2-4-4.6-5.3-8-6 3.4-.7 6-2 8-6z"
        />
      </svg>
    </div>
  )
}

export function Gallery() {
  const photos = wedding.gallery
  const hasPhotos = photos.length > 0
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)

  const close = useCallback(() => setOpen(false), [])
  const go = useCallback(
    (dir: number) => {
      setIndex((prev) => (prev + dir + photos.length) % photos.length)
    },
    [photos.length],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, close, go])

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.changedTouches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 44) go(dx < 0 ? 1 : -1)
    touchX.current = null
  }

  return (
    <section className="section gallery" aria-labelledby="gallery-title">
      <SectionHeading eyebrow="GALLERY" title="우리의 순간들" />

      <div className="gallery__grid" id="gallery-title">
        {hasPhotos
          ? photos.map((src, i) => (
              <button
                key={src}
                type="button"
                className="gallery__item"
                onClick={() => {
                  setIndex(i)
                  setOpen(true)
                }}
                aria-label={`사진 ${i + 1} 크게 보기`}
              >
                <img src={asset(src)} alt={`웨딩 사진 ${i + 1}`} loading="lazy" decoding="async" />
              </button>
            ))
          : Array.from({ length: 6 }, (_, i) => <PlaceholderTile key={i} i={i} />)}
      </div>

      {!hasPhotos && <p className="gallery__note">사진은 추후 업데이트될 예정입니다</p>}

      {open &&
        hasPhotos &&
        createPortal(
          <div className="lightbox" role="dialog" aria-modal="true" aria-label="사진 보기">
            <button type="button" className="lightbox__close" onClick={close} aria-label="닫기">
              ✕
            </button>
            <div className="lightbox__stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <img src={asset(photos[index])} alt={`웨딩 사진 ${index + 1}`} />
            </div>
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox__nav lightbox__nav--prev"
                  onClick={() => go(-1)}
                  aria-label="이전 사진"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="lightbox__nav lightbox__nav--next"
                  onClick={() => go(1)}
                  aria-label="다음 사진"
                >
                  ›
                </button>
                <div className="lightbox__count">
                  {index + 1} / {photos.length}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </section>
  )
}
