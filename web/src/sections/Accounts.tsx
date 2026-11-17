import { useState } from 'react'
import type { Account } from '../config/wedding'
import { useWedding } from '../platform/WeddingContext'
import { SectionHeading } from '../components/SectionHeading'
import { useToast } from '../components/Toast'
import { copyText } from '../lib/clipboard'
import './Accounts.css'

function AccountRow({ acc }: { acc: Account }) {
  const toast = useToast()
  const copy = async () => {
    const ok = await copyText(acc.number.replace(/\s/g, ''))
    toast.show(ok ? '계좌번호가 복사되었습니다' : '복사에 실패했습니다. 직접 복사해 주세요')
  }
  return (
    <div className="accounts__row">
      <div className="accounts__row-info">
        <p className="accounts__row-top">
          <span className="accounts__role">{acc.role}</span>
          <span className="accounts__holder">{acc.holder}</span>
        </p>
        <p className="accounts__num">
          {acc.bank} {acc.number}
        </p>
      </div>
      <div className="accounts__row-actions">
        <button type="button" className="btn btn--sm btn--soft" onClick={copy}>
          복사
        </button>
        {acc.kakaoPayUrl && (
          <a className="accounts__kakaopay" href={acc.kakaoPayUrl} target="_blank" rel="noreferrer">
            카카오페이
          </a>
        )}
      </div>
    </div>
  )
}

function SideAccordion({
  label,
  accounts,
  open,
  onToggle,
}: {
  label: string
  accounts: Account[]
  open: boolean
  onToggle: () => void
}) {
  if (accounts.length === 0) return null
  return (
    <div className={`accounts__acc${open ? ' is-open' : ''}`}>
      <button type="button" className="accounts__acc-head" onClick={onToggle} aria-expanded={open}>
        <span>{label}</span>
        <svg className="accounts__chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="accounts__acc-body">
        <div className="accounts__acc-inner">
          {accounts.map((acc, i) => (
            <AccountRow key={`${acc.bank}-${acc.number}-${i}`} acc={acc} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function Accounts() {
  const { config } = useWedding()
  const groomSide = config.accounts?.groomSide ?? []
  const brideSide = config.accounts?.brideSide ?? []
  const [openSide, setOpenSide] = useState<'groom' | 'bride' | null>(groomSide.length > 0 ? 'groom' : 'bride')

  // 계좌를 하나도 적지 않은 청첩장에서는 섹션 전체를 숨긴다
  if (groomSide.length === 0 && brideSide.length === 0) return null

  return (
    <section className="section accounts" aria-labelledby="accounts-title">
      <SectionHeading eyebrow="GIFT" title="마음 전하실 곳" />

      <p className="accounts__intro" id="accounts-title">
        참석이 어려우신 분들을 위해 계좌번호를 기재하였습니다.
        <br />
        너그러운 마음으로 양해 부탁드립니다.
      </p>

      <div className="accounts__list">
        <SideAccordion
          label="신랑측 마음 전하실 곳"
          accounts={groomSide}
          open={openSide === 'groom'}
          onToggle={() => setOpenSide((s) => (s === 'groom' ? null : 'groom'))}
        />
        <SideAccordion
          label="신부측 마음 전하실 곳"
          accounts={brideSide}
          open={openSide === 'bride'}
          onToggle={() => setOpenSide((s) => (s === 'bride' ? null : 'bride'))}
        />
      </div>
    </section>
  )
}
