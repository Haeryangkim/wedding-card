import { useEffect, useState } from 'react'
import { useWedding } from '../../platform/WeddingContext'
import { useToast } from '../../components/Toast'
import { copyText } from '../../lib/clipboard'
import { isVenueLocationUnset, isVenueUndecided, venueSearchLinks } from '../../lib/venue'
import { kakaoJsKey, loadKakao } from '../../lib/kakao'
import { NAV_APPS, onNavAppMissing, openNavigation, type Destination } from '../../lib/navigation'
import { PixelPopup, type PopupProps } from './PixelPopup'
import { PixelIcon } from './icons'
import './popups.css'

/** "오시는 길": 장소, 주소 복사, 길안내 앱, 교통편 */
export function LocationPopup({ onClose }: PopupProps) {
  const { venue } = useWedding().config
  const toast = useToast()
  const transport = (venue.transport ?? []).filter((t) => t.title || t.lines.some(Boolean))

  // 카카오내비 공식 길안내는 JS SDK 가 필요 — 탭 시점에 로드를 기다리지 않도록 미리 불러 둔다
  useEffect(() => {
    const key = kakaoJsKey()
    if (key) void loadKakao(key).catch(() => {})
  }, [])

  // iOS 에서 앱이 열리지 않은 것 같을 때: 설치 링크만 보여 준다
  const [storeUrl, setStoreUrl] = useState<string | null>(null)
  useEffect(() => onNavAppMissing(setStoreUrl), [])

  const undecided = isVenueUndecided(venue)
  const locationUnset = !undecided && isVenueLocationUnset(venue)
  const searchLinks = locationUnset ? venueSearchLinks(venue) : []
  const address = venue.address.trim()
  const tel = venue.tel?.trim()
  const dest: Destination = { name: venue.name, lat: venue.lat, lng: venue.lng }
  const mapHref = `https://map.kakao.com/link/map/${encodeURIComponent(venue.name.trim().replace(/,/g, ' '))},${venue.lat},${venue.lng}`

  const copyAddress = async () => {
    const ok = await copyText(address)
    toast.show(ok ? '주소가 복사되었습니다' : '복사에 실패했습니다. 직접 복사해 주세요')
  }

  return (
    <PixelPopup title="오시는 길" icon="pin" onClose={onClose}>
      <div className="pxl__venue">
        <p className="pxl__name">{undecided ? '예식 장소 미정' : venue.name.trim()}</p>
        {!undecided && venue.hall?.trim() && <p className="pxl__hall">{venue.hall}</p>}
      </div>

      {undecided ? (
        <p className="px-note">예식 장소가 정해지면 지도와 길안내를 이곳에서 알려 드릴게요.</p>
      ) : (
        <>
          {address && (
            <div className="pxl__addr">
              <p className="pxl__addr-text">{address}</p>
              <button type="button" className="px-btn px-btn--sm" onClick={copyAddress} aria-label="주소 복사">
                <PixelIcon name="copy" size={16} />
                복사
              </button>
            </div>
          )}

          {locationUnset ? (
            searchLinks.length > 0 && (
              <div className="pxl__navs pxl__navs--2">
                {searchLinks.map((link) => (
                  <a
                    key={link.id}
                    className={`px-btn pxl__nav pxl__nav--${link.id}`}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )
          ) : (
            <>
              <p className="px-label pxl__navs-label">길안내 앱으로 열기</p>
              <div className="pxl__navs">
                {NAV_APPS.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    className={`px-btn pxl__nav pxl__nav--${app.id}`}
                    onClick={() => {
                      setStoreUrl(null)
                      openNavigation(app.id, dest)
                    }}
                  >
                    {app.label}
                  </button>
                ))}
              </div>
              {storeUrl && (
                <p className="pxl__hint" role="status">
                  앱이 열리지 않나요?{' '}
                  <a href={storeUrl} target="_blank" rel="noreferrer">
                    App Store 에서 설치하기
                  </a>
                </p>
              )}
            </>
          )}

          {(tel || !locationUnset) && (
            <div className="pxl__links">
              {!locationUnset && (
                <a className="px-btn px-btn--sm" href={mapHref} target="_blank" rel="noreferrer">
                  <PixelIcon name="map" size={16} />
                  지도 보기
                </a>
              )}
              {tel && (
                <a className="px-btn px-btn--sm" href={`tel:${tel.replace(/[^0-9+]/g, '')}`} aria-label={`예식장 전화 ${tel}`}>
                  <PixelIcon name="phone" size={16} />
                  {tel}
                </a>
              )}
            </div>
          )}
        </>
      )}

      {transport.length > 0 && (
        <>
          <hr className="px-rule" />
          <dl className="pxl__transport">
            {transport.map((t, i) => (
              <div className="pxl__transport-row" key={`${t.title}-${i}`}>
                <dt className="px-label">{t.title || '안내'}</dt>
                <dd>
                  {t.lines.filter(Boolean).map((line, j) => (
                    <p key={j}>{line}</p>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </PixelPopup>
  )
}
