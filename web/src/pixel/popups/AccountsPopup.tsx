import { useState } from 'react'
import type { Account } from '../../config/wedding'
import { useWedding } from '../../platform/WeddingContext'
import { useToast } from '../../components/Toast'
import { copyText } from '../../lib/clipboard'
import { PixelPopup, type PopupProps } from './PixelPopup'
import { PixelIcon } from './icons'
import './popups.css'

type Side = 'groom' | 'bride'

/** 카카오페이 링크는 https 만 허용 (javascript: 등 차단) */
function safeHttps(url?: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

function AccountRow({ acc }: { acc: Account }) {
  const toast = useToast()
  const pay = safeHttps(acc.kakaoPayUrl)
  const copy = async () => {
    const ok = await copyText(acc.number.replace(/\s/g, ''))
    toast.show(ok ? '계좌번호가 복사되었습니다' : '복사에 실패했습니다. 직접 복사해 주세요')
  }
  return (
    <li className="pxa__row">
      <div className="pxa__info">
        <p className="pxa__who">
          {acc.role && <span className="px-label">{acc.role}</span>}
          <span>{acc.holder}</span>
        </p>
        <p className="pxa__bank">{acc.bank}</p>
        <p className="pxa__num">{acc.number}</p>
      </div>
      <div className="pxa__actions">
        <button
          type="button"
          className="px-btn px-btn--sm px-btn--primary"
          onClick={copy}
          aria-label={`${acc.holder} 계좌번호 복사`}
        >
          <PixelIcon name="copy" size={16} />
          복사
        </button>
        {pay && (
          <a className="px-btn px-btn--sm pxa__pay" href={pay} target="_blank" rel="noreferrer">
            카카오페이
          </a>
        )}
      </div>
    </li>
  )
}

/** "마음 전하실 곳": 신랑측/신부측 계좌 */
export function AccountsPopup({ onClose }: PopupProps) {
  const { accounts } = useWedding().config
  const groom = accounts?.groomSide ?? []
  const bride = accounts?.brideSide ?? []
  const both = groom.length > 0 && bride.length > 0
  const [side, setSide] = useState<Side>(groom.length > 0 ? 'groom' : 'bride')
  const list = side === 'groom' ? groom : bride
  const empty = groom.length === 0 && bride.length === 0

  return (
    <PixelPopup title="마음 전하실 곳" icon="gift" onClose={onClose}>
      {empty ? (
        <p className="px-note">등록된 계좌가 없습니다.</p>
      ) : (
        <>
          <p className="pxa__intro">참석이 어려우신 분들을 위해 계좌번호를 적어 두었습니다.</p>
          {both ? (
            <div className="pxa__tabs" role="tablist" aria-label="신랑측 · 신부측">
              {(['groom', 'bride'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  id={`pxa-tab-${s}`}
                  aria-selected={side === s}
                  aria-controls="pxa-panel"
                  className={`pxa__tab${side === s ? ' is-on' : ''}`}
                  onClick={() => setSide(s)}
                >
                  {s === 'groom' ? '신랑측' : '신부측'}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-label pxa__only">{side === 'groom' ? '신랑측' : '신부측'}</p>
          )}
          <ul
            className="pxa__list"
            id="pxa-panel"
            role={both ? 'tabpanel' : undefined}
            aria-labelledby={both ? `pxa-tab-${side}` : undefined}
          >
            {list.map((acc, i) => (
              <AccountRow key={`${side}-${acc.bank}-${acc.number}-${i}`} acc={acc} />
            ))}
          </ul>
        </>
      )}
    </PixelPopup>
  )
}
