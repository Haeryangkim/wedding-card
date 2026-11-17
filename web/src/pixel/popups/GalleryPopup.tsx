import { useCallback, useEffect, useRef, useState } from 'react'
import { useWedding } from '../../platform/WeddingContext'
import { getApi } from '../../platform/api'
import { useBackLayer } from '../backLayer'
import { PixelPopup, type PopupProps } from './PixelPopup'
import { PixelIcon } from './icons'
import './popups.css'

const asset = (p: string) => getApi().assetUrl(p)

/** "갤러리": 썸네일 격자 → 팝업 안 뷰어 (이전/다음, 스와이프, 방향키) */
export function GalleryPopup({ onClose }: PopupProps) {
  const photos = useWedding().config.gallery ?? []
  const count = photos.length
  const [index, setIndex] = useState<number | null>(null)
  const viewing = index !== null && count > 0
  const touch = useRef<{ x: number; y: number } | null>(null)

  const go = useCallback(
    (dir: number) => setIndex((prev) => (prev === null || count === 0 ? prev : (prev + dir + count) % count)),
    [count],
  )
  const back = useCallback(() => setIndex(null), [])
  // 사진을 보는 중의 뒤로 가기는 격자로 돌아간다 (팝업 위에 한 칸 더)
  useBackLayer(viewing, 2, back)

  useEffect(() => {
    if (!viewing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [viewing, go])

  // 다음·이전 사진을 미리 받아 넘길 때 깜빡이지 않게 한다
  useEffect(() => {
    if (index === null || count < 2) return
    for (const d of [1, -1]) {
      const img = new Image()
      img.src = asset(photos[(index + d + count) % count])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count])

  if (viewing && index !== null) {
    return (
      <PixelPopup title={`갤러리 ${index + 1} / ${count}`} icon="photo" onClose={onClose} onBack={back} flush>
        <div
          className="pxv"
          onTouchStart={(e) => {
            const t = e.changedTouches[0]
            touch.current = { x: t.clientX, y: t.clientY }
          }}
          onTouchEnd={(e) => {
            const s = touch.current
            touch.current = null
            if (!s) return
            const t = e.changedTouches[0]
            const dx = t.clientX - s.x
            if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(t.clientY - s.y)) go(dx < 0 ? 1 : -1)
          }}
        >
          <img
            key={index}
            className="pxv__img"
            src={asset(photos[index])}
            alt={`웨딩 사진 ${index + 1}`}
            decoding="async"
            draggable={false}
          />
          {count > 1 && (
            <>
              <button type="button" className="pxv__nav pxv__nav--prev" onClick={() => go(-1)} aria-label="이전 사진">
                <PixelIcon name="prev" size={20} />
              </button>
              <button type="button" className="pxv__nav pxv__nav--next" onClick={() => go(1)} aria-label="다음 사진">
                <PixelIcon name="next" size={20} />
              </button>
            </>
          )}
        </div>
      </PixelPopup>
    )
  }

  return (
    <PixelPopup title="갤러리" icon="photo" onClose={onClose}>
      {count === 0 ? (
        <p className="px-note">사진은 추후 업데이트될 예정입니다.</p>
      ) : (
        <ul className="pxgal">
          {photos.map((src, i) => (
            <li key={`${src}-${i}`}>
              <button type="button" className="pxgal__item" onClick={() => setIndex(i)} aria-label={`사진 ${i + 1} 크게 보기`}>
                <img src={asset(src)} alt="" loading="lazy" decoding="async" draggable={false} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </PixelPopup>
  )
}
