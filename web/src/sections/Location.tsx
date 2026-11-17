import { useEffect, useState } from 'react'
import { useWedding } from '../platform/WeddingContext'
import { SectionHeading } from '../components/SectionHeading'
import { useToast } from '../components/Toast'
import { copyText } from '../lib/clipboard'
import { useReveal } from '../lib/useReveal'
import { isVenueLocationUnset, isVenueUndecided, venueSearchLinks } from '../lib/venue'
import { kakaoJsKey, loadKakao } from '../lib/kakao'
import { NAV_APPS, onNavAppMissing, openNavigation, type Destination } from '../lib/navigation'
import './Location.css'

const NAV_TINT: Record<string, string> = {
  kakaonavi: 'location__nav--kakao',
  kakaomap: 'location__nav--kakao',
  navermap: 'location__nav--naver',
  tmap: 'location__nav--tmap',
}

export function Location() {
  const { venue } = useWedding().config
  const transport = (venue.transport ?? []).filter((t) => t.title || t.lines.some(Boolean))
  const toast = useToast()
  const [mapRef, mapVisible] = useReveal<HTMLDivElement>({ rootMargin: '0px 0px 20% 0px' })

  // 카카오내비(공식 길안내)는 JS SDK 가 필요하므로, 키가 설정된 경우 미리 로드해 둔다.
  // (탭 시점의 Kakao.Navi.start 가 비동기 로드를 기다리지 않도록 — iOS 제스처 제약 완화)
  useEffect(() => {
    const key = kakaoJsKey()
    if (key) void loadKakao(key).catch(() => {})
  }, [])

  // iOS 에서 앱이 열리지 않은 것 같을 때: 페이지를 스토어로 보내지 않고 설치 링크만 보여준다.
  const [storeUrl, setStoreUrl] = useState<string | null>(null)
  useEffect(() => onNavAppMissing(setStoreUrl), [])

  const dest: Destination = { name: venue.name, lat: venue.lat, lng: venue.lng }
  const d = 0.0042
  const bbox = `${venue.lng - d},${venue.lat - d},${venue.lng + d},${venue.lat + d}`
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${venue.lat},${venue.lng}`
  const bigMapHref = `https://www.openstreetmap.org/?mlat=${venue.lat}&mlon=${venue.lng}#map=17/${venue.lat}/${venue.lng}`

  const undecided = isVenueUndecided(venue)
  // 이름은 있지만 지도 위치를 고르지 않은 청첩장: 자리표시 좌표로 지도·길안내를 보여 주면 하객이 엉뚱한 곳으로 간다
  const locationUnset = !undecided && isVenueLocationUnset(venue)
  const searchLinks = locationUnset ? venueSearchLinks(venue) : []
  const address = venue.address.trim()

  const copyAddress = async () => {
    const ok = await copyText(address)
    toast.show(ok ? '주소가 복사되었습니다' : '복사에 실패했습니다. 직접 복사해 주세요')
  }

  return (
    <section className="section location" aria-labelledby="location-title">
      <SectionHeading eyebrow="LOCATION" title="오시는 길" />

      <div className="location__venue" id="location-title">
        <p className="location__name">{venue.name.trim() || '예식 장소 미정'}</p>
        {venue.hall && <p className="location__hall">{venue.hall}</p>}
      </div>

      {undecided ? (
        <p className="location__pending">
          예식 장소가 정해지면 지도와 길안내를 이곳에서 알려 드릴게요.
        </p>
      ) : (
      <>
      {(address || venue.tel) && (
      <div className="location__addr">
        {address && <p className="location__addr-text">{address}</p>}
        <div className="location__addr-actions">
          {address && (
            <button type="button" className="btn btn--sm btn--soft" onClick={copyAddress}>
              주소 복사
            </button>
          )}
          {venue.tel && (
            <a className="btn btn--sm btn--soft" href={`tel:${venue.tel.replace(/[^0-9+]/g, '')}`}>
              전화 {venue.tel}
            </a>
          )}
        </div>
      </div>
      )}

      {locationUnset ? (
        searchLinks.length > 0 && (
          <div className="location__navs location__navs--search">
            {searchLinks.map((link) => (
              <a
                key={link.id}
                className={`location__nav ${NAV_TINT[link.id] ?? ''}`}
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
      <div className="location__map" ref={mapRef}>
        {mapVisible ? (
          <iframe
            className="location__map-frame"
            title={`${venue.name} 지도`}
            src={embedSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="location__map-skeleton" aria-hidden="true" />
        )}
        <a className="location__map-big" href={bigMapHref} target="_blank" rel="noreferrer">
          지도 크게 보기
        </a>
      </div>

      <div className="location__navs">
        {NAV_APPS.map((app) => (
          <button
            key={app.id}
            type="button"
            className={`location__nav ${NAV_TINT[app.id] ?? ''}`}
            onClick={() => {
              setStoreUrl(null)
              openNavigation(app.id, dest)
            }}
          >
            {app.label}
          </button>
        ))}
      </div>
      </>
      )}

      </>
      )}

      {storeUrl && (
        <p className="location__nav-hint" role="status">
          앱이 열리지 않나요?{' '}
          <a href={storeUrl} target="_blank" rel="noreferrer">
            App Store 에서 설치하기
          </a>
        </p>
      )}

      {transport.length > 0 && (
      <div className="location__transport">
        {transport.map((t, ti) => (
          <div className="location__transport-row" key={`${t.title}-${ti}`}>
            <p className="location__transport-title">{t.title}</p>
            <div className="location__transport-lines">
              {t.lines.map((line, i) => (
                <p key={i} className="location__transport-line">
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      )}
    </section>
  )
}
