import { useEffect, useState } from 'react'
import { wedding } from '../config/wedding'
import { SectionHeading } from '../components/SectionHeading'
import { useToast } from '../components/Toast'
import { copyText } from '../lib/clipboard'
import { useReveal } from '../lib/useReveal'
import { loadKakao } from '../lib/kakao'
import { NAV_APPS, onNavAppMissing, openNavigation, type Destination } from '../lib/navigation'
import './Location.css'

const NAV_TINT: Record<string, string> = {
  kakaonavi: 'location__nav--kakao',
  navermap: 'location__nav--naver',
  tmap: 'location__nav--tmap',
}

export function Location() {
  const { venue } = wedding
  const toast = useToast()
  const [mapRef, mapVisible] = useReveal<HTMLDivElement>({ rootMargin: '0px 0px 20% 0px' })

  // 카카오내비(공식 길안내)는 JS SDK 가 필요하므로, 키가 설정된 경우 미리 로드해 둔다.
  // (탭 시점의 Kakao.Navi.start 가 비동기 로드를 기다리지 않도록 — iOS 제스처 제약 완화)
  useEffect(() => {
    const key = wedding.kakaoJsKey
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

  const copyAddress = async () => {
    const ok = await copyText(venue.address)
    toast.show(ok ? '주소가 복사되었습니다' : '복사에 실패했습니다. 직접 복사해 주세요')
  }

  return (
    <section className="section location" aria-labelledby="location-title">
      <SectionHeading eyebrow="LOCATION" title="오시는 길" />

      <div className="location__venue" id="location-title">
        <p className="location__name">{venue.name}</p>
        <p className="location__hall">{venue.hall}</p>
      </div>

      <div className="location__addr">
        <p className="location__addr-text">{venue.address}</p>
        <div className="location__addr-actions">
          <button type="button" className="btn btn--sm btn--soft" onClick={copyAddress}>
            주소 복사
          </button>
          {venue.tel && (
            <a className="btn btn--sm btn--soft" href={`tel:${venue.tel.replace(/[^0-9+]/g, '')}`}>
              전화 {venue.tel}
            </a>
          )}
        </div>
      </div>

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

      {storeUrl && (
        <p className="location__nav-hint" role="status">
          앱이 열리지 않나요?{' '}
          <a href={storeUrl} target="_blank" rel="noreferrer">
            App Store 에서 설치하기
          </a>
        </p>
      )}

      <div className="location__transport">
        {venue.transport.map((t) => (
          <div className="location__transport-row" key={t.title}>
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
    </section>
  )
}
