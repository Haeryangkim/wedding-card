import type { Person } from '../config/wedding'
import { useWedding } from '../platform/WeddingContext'
import { SectionHeading } from '../components/SectionHeading'
import './Greeting.css'

function parentName(p?: { name: string; deceased?: boolean }): string | null {
  if (!p) return null
  return `${p.deceased ? '故 ' : ''}${p.name}`
}

function ParentsLine({ person, sideLabel }: { person: Person; sideLabel: string }) {
  const father = parentName(person.father)
  const mother = parentName(person.mother)
  const parents = [father, mother].filter(Boolean).join(' · ')
  const telDigits = person.phone?.replace(/[^0-9+]/g, '')

  return (
    <div className="greeting__person">
      {parents && (
        <p className="greeting__parents">
          <span className="greeting__parents-names">{parents}</span>
          <span className="greeting__of"> 의 {person.relation || (sideLabel === '신랑' ? '아들' : '딸')}</span>
        </p>
      )}
      <p className="greeting__child">
        <span className="greeting__side">{sideLabel}</span>
        <span className="greeting__child-name">{person.firstName || person.name}</span>
      </p>
      {telDigits && (
        <div className="greeting__contact">
          <a className="greeting__contact-btn" href={`tel:${telDigits}`} aria-label={`${sideLabel}에게 전화`}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M6.6 10.8a15.6 15.6 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1z"
              />
            </svg>
            전화
          </a>
          <a className="greeting__contact-btn" href={`sms:${telDigits}`} aria-label={`${sideLabel}에게 문자`}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-4 3V5a1 1 0 0 1 1-1z"
              />
            </svg>
            문자
          </a>
        </div>
      )}
    </div>
  )
}

export function Greeting() {
  const { greeting, groom, bride } = useWedding().config

  return (
    <section className="section greeting" aria-labelledby="greeting-title">
      <SectionHeading eyebrow="INVITATION" title={greeting.title} />

      <div className="greeting__body" id="greeting-title">
        {greeting.body.map((line, i) =>
          line === '' ? (
            <span key={i} className="greeting__gap" aria-hidden="true" />
          ) : (
            <p key={i} className="greeting__line">
              {line}
            </p>
          ),
        )}
      </div>

      <div className="greeting__people">
        <ParentsLine person={groom} sideLabel="신랑" />
        <span className="greeting__people-div" aria-hidden="true" />
        <ParentsLine person={bride} sideLabel="신부" />
      </div>
    </section>
  )
}
