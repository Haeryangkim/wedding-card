import type { Person } from '../../config/wedding'
import { useWedding } from '../../platform/WeddingContext'
import { formatKoreanDate } from '../../lib/date'
import { isVenueUndecided } from '../../lib/venue'
import { PixelPopup, type PopupProps } from './PixelPopup'
import { PixelIcon } from './icons'
import './popups.css'

function parentName(p?: { name: string; deceased?: boolean }): string | null {
  const name = p?.name?.trim()
  if (!name) return null
  return `${p?.deceased ? '故 ' : ''}${name}`
}

function PersonRow({ person, side }: { person: Person; side: '신랑' | '신부' }) {
  const parents = [parentName(person.father), parentName(person.mother)].filter(Boolean).join(' · ')
  const tel = person.phone?.replace(/[^0-9+]/g, '')
  return (
    <div className="pxg__person">
      <div className="pxg__person-text">
        {parents && (
          <p className="pxg__parents">
            {parents}
            <span className="pxg__of"> 의 {person.relation || (side === '신랑' ? '아들' : '딸')}</span>
          </p>
        )}
        <p className="pxg__child">
          <span className="px-label">{side}</span>
          <strong>{person.firstName || person.name}</strong>
        </p>
      </div>
      {tel && (
        <div className="pxg__contact">
          <a className="px-btn px-btn--icon" href={`tel:${tel}`} aria-label={`${side}에게 전화`}>
            <PixelIcon name="phone" size={18} />
          </a>
          <a className="px-btn px-btn--icon" href={`sms:${tel}`} aria-label={`${side}에게 문자`}>
            <PixelIcon name="sms" size={18} />
          </a>
        </div>
      )}
    </div>
  )
}

/** 신랑·신부 캐릭터를 눌렀을 때: 인사말 */
export function GreetingPopup({ onClose }: PopupProps) {
  const { greeting, groom, bride, datetime, venue } = useWedding().config
  const date = new Date(datetime)
  const dateLine = Number.isNaN(date.getTime()) ? '' : formatKoreanDate(date)
  const venueLine = isVenueUndecided(venue) ? '' : [venue.name.trim(), venue.hall?.trim()].filter(Boolean).join(' ')
  // 앞뒤의 빈 줄은 버리고, 가운데 빈 줄은 문단 간격으로 쓴다
  const lines = [...greeting.body]
  while (lines.length && lines[0].trim() === '') lines.shift()
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()

  return (
    <PixelPopup title={greeting.title.trim() || '초대합니다'} icon="heart" onClose={onClose}>
      {lines.length > 0 && (
        <div className="pxg__body">
          {lines.map((line, i) =>
            line.trim() === '' ? <span key={i} className="pxg__gap" aria-hidden="true" /> : <p key={i}>{line}</p>,
          )}
        </div>
      )}
      {lines.length > 0 && <hr className="px-rule" />}
      <div className="pxg__people">
        <PersonRow person={groom} side="신랑" />
        <PersonRow person={bride} side="신부" />
      </div>
      {(dateLine || venueLine) && (
        <div className="pxg__when">
          {dateLine && <p>{dateLine}</p>}
          {venueLine && <p>{venueLine}</p>}
        </div>
      )}
    </PixelPopup>
  )
}
