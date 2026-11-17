/**
 * 픽셀 청첩장 팝업 개발용 하네스 (dev 전용, 빌드/배포에 포함되지 않음).
 * ?p=greeting|schedule|location|accounts|gallery|viewer  &v=demo|rich|min|past
 */
import { StrictMode, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastProvider } from '../src/components/Toast'
import { WeddingProvider, type WeddingInstance } from '../src/platform/WeddingContext'
import { wedding, type WeddingConfig } from '../src/config/wedding'
import { DEFAULT_COORDS, VENUE_PLACEHOLDER } from '../src/lib/venue'
import {
  AccountsPopup,
  GalleryPopup,
  GreetingPopup,
  LocationPopup,
  SchedulePopup,
  type PopupProps,
} from '../src/pixel/popups'
import '../src/styles/tokens.css'
import '../src/styles/fonts.css'
import '../src/styles/base.css'

function photo(i: number): string {
  const hues = [18, 96, 200, 330, 48, 260, 150, 0]
  const w = i % 3 === 1 ? 600 : 400
  const h = i % 3 === 1 ? 400 : 600
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="hsl(${hues[i % hues.length]},45%,72%)"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="hsl(${hues[i % hues.length]},45%,52%)"/><text x="50%" y="52%" font-size="72" text-anchor="middle" fill="#fff" font-family="sans-serif">${i + 1}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const rich: WeddingConfig = {
  ...wedding,
  groom: { ...wedding.groom, name: '김도현', firstName: '도현', relation: '차남', father: { name: '김영수', deceased: true }, mother: { name: '이정희' } },
  bride: { ...wedding.bride, name: '박서연', firstName: '서연', father: { name: '박성민' }, mother: { name: '최은영' }, phone: '010-1234-5678' },
  venue: {
    ...wedding.venue,
    name: '더채플앳청담 웨딩컨벤션',
    hall: '커티지홀 3층',
    address: '서울특별시 강남구 선릉로 757 (청담동) 더채플앳청담 본관',
    tel: '02-1234-5678',
    lat: 37.5235,
    lng: 127.0396,
    transport: [
      { title: '지하철', lines: ['7호선 강남구청역 3-1번 출구에서 도보 10분', '수인분당선 압구정로데오역 4번 출구 셔틀버스 운행'] },
      { title: '버스', lines: ['간선 301, 342, 472 · 지선 3011, 4412 영동고교앞 하차'] },
      { title: '주차', lines: ['본관 지하주차장 2시간 무료', '만차 시 인근 공영주차장 이용'] },
      { title: '셔틀버스', lines: ['강남구청역 3번 출구 앞 10분 간격 운행'] },
    ],
  },
  greeting: {
    title: '소중한 분들을 초대합니다',
    body: [
      '',
      '오랜 시간 서로의 곁을 지켜 온 두 사람이',
      '이제 부부라는 이름으로 첫걸음을 내딛습니다.',
      '',
      '바쁘시더라도 귀한 걸음 하시어',
      '저희의 시작을 따뜻하게 축복해 주시면',
      '더없는 기쁨으로 간직하겠습니다.',
      '',
    ],
  },
  gallery: Array.from({ length: 11 }, (_, i) => photo(i)),
  accounts: {
    groomSide: [
      { role: '신랑', bank: '카카오뱅크', number: '3333-01-1234567', holder: '김도현', kakaoPayUrl: 'https://qr.kakaopay.com/abc' },
      { role: '신랑 어머니', bank: '국민은행', number: '123456-01-123456', holder: '이정희' },
      { role: '신랑 형', bank: '새마을금고', number: '9002-1234-5678-9', holder: '김도윤', kakaoPayUrl: 'javascript:alert(1)' },
    ],
    brideSide: [
      { role: '신부', bank: '토스뱅크', number: '1000-1234-5678', holder: '박서연' },
      { role: '신부 아버지', bank: '농협은행', number: '302-1234-5678-91', holder: '박성민' },
    ],
  },
}

const min: WeddingConfig = {
  ...wedding,
  groom: { name: '김신랑', firstName: '신랑', relation: '' },
  bride: { name: '박신부', firstName: '신부', relation: '', mother: { name: '최어머니', deceased: true } },
  venue: { name: VENUE_PLACEHOLDER, hall: '', address: '', lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng, transport: [] },
  greeting: { title: '', body: [] },
  gallery: [],
  accounts: { groomSide: [], brideSide: [{ role: '', bank: '예시은행', number: '000-0000-0000', holder: '박신부' }] },
}

/** 이름은 있지만 지도 위치를 고르지 않음 + 예식이 지난 상태 */
const past: WeddingConfig = {
  ...wedding,
  datetime: '2024-05-15T12:30:00+09:00',
  venue: { ...wedding.venue, tel: undefined, lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng, transport: [] },
  accounts: { groomSide: [], brideSide: [] },
}

const VARIANTS: Record<string, WeddingConfig> = { demo: wedding, rich, min, past }
const POPUPS: Record<string, ComponentType<PopupProps>> = {
  greeting: GreetingPopup,
  schedule: SchedulePopup,
  location: LocationPopup,
  accounts: AccountsPopup,
  gallery: GalleryPopup,
  viewer: GalleryPopup,
}

function Harness() {
  const q = new URLSearchParams(location.search)
  const [open, setOpen] = useState<string | null>(q.get('p'))
  const [variant, setVariant] = useState(q.get('v') ?? 'demo')
  const instance: WeddingInstance = { slug: 'demo', config: VARIANTS[variant] ?? wedding, isDemo: true }
  const Popup = open ? POPUPS[open] : null

  // ?p=viewer: 첫 사진을 눌러 뷰어 상태로 (스크린샷용)
  useEffect(() => {
    if (open !== 'viewer') return
    const id = setTimeout(() => document.querySelector<HTMLButtonElement>('.pxgal__item')?.click(), 50)
    return () => clearTimeout(id)
  }, [open])

  return (
    <ToastProvider>
      <WeddingProvider value={instance}>
        <div
          style={{
            height: '100dvh',
            maxWidth: 430,
            margin: '0 auto',
            padding: 12,
            background: 'linear-gradient(#8fc5e8 0 45%, #7fae6a 45%)',
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'flex-end',
            gap: 6,
          }}
        >
          {Object.keys(VARIANTS).map((v) => (
            <button key={v} type="button" onClick={() => setVariant(v)} style={{ minHeight: 44, fontWeight: v === variant ? 700 : 400 }}>
              {v}
            </button>
          ))}
          <span style={{ flexBasis: '100%' }} />
          {Object.keys(POPUPS).map((p) => (
            <button key={p} type="button" onClick={() => setOpen(p)} style={{ minHeight: 44 }}>
              {p}
            </button>
          ))}
        </div>
        {Popup && <Popup onClose={() => setOpen(null)} />}
      </WeddingProvider>
    </ToastProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
