import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { GeocodeResult } from '../../platform/contract'
import { isVenueLocationUnset } from '../../lib/venue'
import type { EditorEnv, SectionProps } from '../env'
import { errorText } from '../errors'
import { osmEmbedUrl, osmLinkUrl, parseCoords } from '../map'
import { Notice, TextField } from '../ui'

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'results'; items: GeocodeResult[] }

const round = (n: number) => String(Math.round(n * 1e7) / 1e7)

export function VenueSection({ form, update, errors, env }: SectionProps & { env: EditorEnv }) {
  const v = form.venue
  const set = (patch: Partial<typeof v>) => update((f) => ({ ...f, venue: { ...f.venue, ...patch } }))
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' })
  const [picked, setPicked] = useState(false)
  const requestNo = useRef(0)

  // 좌표를 직접 고칠 때 글자마다 지도를 다시 불러오지 않도록 잠깐 기다린다
  const coords = parseCoords(v.lat, v.lng)
  const coordKey = coords ? `${coords.lat},${coords.lng}` : ''
  const [mapKey, setMapKey] = useState(coordKey)
  useEffect(() => {
    const t = setTimeout(() => setMapKey(coordKey), 700)
    return () => clearTimeout(t)
  }, [coordKey])
  const mapCoords = mapKey ? { lat: Number(mapKey.split(',')[0]), lng: Number(mapKey.split(',')[1]) } : null
  const embed = mapCoords ? osmEmbedUrl(mapCoords.lat, mapCoords.lng) : null
  // 좌표가 아직 자리표시 값(서울시청)이면 지도 위치를 고르지 않은 것 — 엉뚱한 지도를 미리보기로 보여 주지 않는다
  const locationUnset = coords !== null && isVenueLocationUnset(coords)
  const venueTyped = v.name.trim() !== '' || v.address.trim() !== ''

  const runSearch = async (e?: FormEvent) => {
    e?.preventDefault()
    const q = (query.trim() || [v.name, v.address].map((s) => s.trim()).filter(Boolean)[0] || '').replace(/\s+/g, ' ')
    const n = [...q].length
    if (n < 2) return setSearch({ kind: 'error', message: '검색어를 2자 이상 입력해 주세요.' })
    if (n > 80) return setSearch({ kind: 'error', message: '검색어는 80자 이하로 입력해 주세요.' })
    if (!query.trim()) setQuery(q)
    const no = ++requestNo.current
    setSearch({ kind: 'loading' })
    try {
      const items = await env.api.geocode(q)
      if (no === requestNo.current) setSearch({ kind: 'results', items })
    } catch (err) {
      if (no === requestNo.current) {
        setSearch({ kind: 'error', message: errorText(err, '장소를 검색하지 못했어요. 잠시 후 다시 시도해 주세요.') })
      }
    }
  }

  const pick = (r: GeocodeResult) => {
    update((f) => ({
      ...f,
      venue: {
        ...f.venue,
        name: f.venue.name.trim() === '' ? r.name.slice(0, 60) : f.venue.name,
        address: r.address ? r.address.slice(0, 120) : f.venue.address,
        lat: round(r.lat),
        lng: round(r.lng),
      },
    }))
    setMapKey(`${round(r.lat)},${round(r.lng)}`)
    setPicked(true)
    setSearch({ kind: 'idle' })
  }

  return (
    <>
      <div className="ed-grid">
        <TextField
          path="venue.name"
          label="장소 이름"
          value={v.name}
          onChange={(name) => set({ name })}
          error={errors['venue.name']}
          placeholder="OO웨딩홀"
          hint="아직 정하지 않았다면 비워 두세요. 청첩장에는 ‘예식 장소 미정’으로 보이고 지도는 숨겨져요."
        />
        <TextField
          path="venue.hall"
          label="홀 · 층"
          optional
          value={v.hall}
          onChange={(hall) => set({ hall })}
          error={errors['venue.hall']}
          placeholder="3층 그랜드볼룸"
        />
      </div>

      <div className="ed-search">
        <form className="ed-search__form" role="search" onSubmit={runSearch}>
          <label className="ed-field__label" htmlFor="venue-search">
            장소 검색으로 주소·지도 채우기
          </label>
          <div className="ed-search__row">
            <input
              id="venue-search"
              className="ed-input"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder={v.name.trim() || '예식장 이름이나 도로명 주소'}
              value={query}
              maxLength={80}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn--soft" disabled={search.kind === 'loading'}>
              {search.kind === 'loading' ? '찾는 중…' : '검색'}
            </button>
          </div>
        </form>
        <div aria-live="polite">
          {search.kind === 'error' && <p className="ed-field__error">{search.message}</p>}
          {search.kind === 'results' && search.items.length === 0 && (
            <p className="ed-field__hint">
              검색 결과가 없어요. 도로명 주소(예: 세종대로 110)나 건물 이름으로 다시 찾아보세요.
            </p>
          )}
          {search.kind === 'results' && search.items.length > 0 && (
            <ul className="ed-results">
              {search.items.map((r, i) => (
                <li key={`${r.lat},${r.lng},${i}`}>
                  <button type="button" className="ed-results__item" onClick={() => pick(r)}>
                    <span className="ed-results__name">{r.name}</span>
                    {r.address && <span className="ed-results__addr">{r.address}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <TextField
        path="venue.address"
        label="주소"
        value={v.address}
        onChange={(address) => set({ address })}
        error={errors['venue.address']}
        placeholder="서울특별시 중구 세종대로 110"
        autoComplete="off"
      />
      <TextField
        path="venue.tel"
        label="예식장 전화"
        optional
        type="tel"
        inputMode="tel"
        value={v.tel}
        onChange={(tel) => set({ tel })}
        error={errors['venue.tel']}
        placeholder="02-000-0000"
        className="ed-field--narrow"
      />

      <div className="ed-map">
        <p className="ed-field__label" id="venue-map-label">
          지도 위치
        </p>
        {locationUnset ? (
          <div className="ed-map__empty">아직 지도 위치를 고르지 않았어요.</div>
        ) : embed && mapCoords ? (
          <>
            <iframe
              className="ed-map__frame"
              title="예식 장소 지도 미리보기"
              aria-labelledby="venue-map-label"
              src={embed}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <a className="ed-map__link" href={osmLinkUrl(mapCoords.lat, mapCoords.lng)} target="_blank" rel="noreferrer">
              큰 지도에서 확인하기
            </a>
          </>
        ) : (
          <div className="ed-map__empty">좌표가 올바르지 않아 지도를 보여 드릴 수 없어요.</div>
        )}
        {locationUnset ? (
          <Notice tone={venueTyped ? 'warn' : 'info'}>
            {venueTyped
              ? '지도 위치가 아직 없어요. 이대로 저장하면 청첩장에 지도와 길안내 버튼이 나오지 않아요. 위의 장소 검색에서 결과를 고르거나, 아래에서 좌표를 직접 넣어 주세요.'
              : '장소가 정해지면 위의 장소 검색에서 결과를 골라 주세요. 지도와 길안내 버튼이 청첩장에 나타나요.'}
          </Notice>
        ) : (
          <Notice tone={picked ? 'warn' : 'info'}>
            지도의 핀이 실제 예식장 위치와 맞는지 꼭 확인해 주세요. 하객의 길안내(카카오내비·네이버지도·티맵)가 이 위치로
            연결돼요. 다르면 다른 검색 결과를 고르거나 아래에서 좌표를 직접 고칠 수 있어요.
          </Notice>
        )}
      </div>

      <details className="ed-details" open={!!(errors['venue.lat'] || errors['venue.lng'])}>
        <summary>좌표 직접 입력 (고급)</summary>
        <div className="ed-grid">
          <TextField
            path="venue.lat"
            label="위도"
            inputMode="decimal"
            value={v.lat}
            onChange={(lat) => set({ lat: lat.replace(/[^\d.-]/g, '') })}
            error={errors['venue.lat']}
            placeholder="37.5662952"
          />
          <TextField
            path="venue.lng"
            label="경도"
            inputMode="decimal"
            value={v.lng}
            onChange={(lng) => set({ lng: lng.replace(/[^\d.-]/g, '') })}
            error={errors['venue.lng']}
            placeholder="126.9779451"
          />
        </div>
        <p className="ed-field__hint">
          지도 앱에서 예식장을 길게 눌러 나오는 좌표(위도, 경도)를 넣어 주세요. 한국은 위도 33~39, 경도 124~132 사이예요.
        </p>
      </details>
    </>
  )
}
