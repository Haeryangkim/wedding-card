import { PLATFORM_LIMITS } from '../../platform/contract'
import type { SectionProps } from '../env'
import { emptyAccount, type AccountForm } from '../form'
import { IconButton, TextField } from '../ui'

type SideKey = 'groomAccounts' | 'brideAccounts'

function Side({ side, form, update, errors }: SectionProps & { side: SideKey }) {
  const max = PLATFORM_LIMITS.text.accountsPerSide
  const who = side === 'groomAccounts' ? '신랑' : '신부'
  const list = form[side]
  const set = (id: string, patch: Partial<AccountForm>) =>
    update((f) => ({ ...f, [side]: f[side].map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
  const err = (id: string, k: string) => errors[`${side}.${id}.${k}`]
  const roleListId = `roles-${side}`
  return (
    <fieldset className="ed-group">
      <legend className="ed-group__legend">{who}측</legend>
      {errors[side] && (
        <p className="ed-field__error" role="alert">
          {errors[side]}
        </p>
      )}
      <datalist id={roleListId}>
        {[who, `${who} 아버지`, `${who} 어머니`].map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      {list.length === 0 && <p className="ed-empty">아직 등록한 계좌가 없어요.</p>}
      <ol className="ed-list">
        {list.map((a, i) => (
          <li className="ed-item" key={a.id}>
            <div className="ed-item__bar">
              <span className="ed-item__no">{i + 1}</span>
              <div className="ed-item__actions">
                <IconButton
                  icon="remove"
                  danger
                  label={`${who}측 ${i + 1}번째 계좌 삭제`}
                  onClick={() => update((f) => ({ ...f, [side]: f[side].filter((x) => x.id !== a.id) }))}
                />
              </div>
            </div>
            <div className="ed-grid">
              <TextField
                path={`${side}.${a.id}.role`}
                label="받는 분"
                value={a.role}
                onChange={(role) => set(a.id, { role })}
                error={err(a.id, 'role')}
                placeholder={who}
                list={roleListId}
              />
              <TextField
                path={`${side}.${a.id}.holder`}
                label="예금주"
                value={a.holder}
                onChange={(holder) => set(a.id, { holder })}
                error={err(a.id, 'holder')}
              />
              <TextField
                path={`${side}.${a.id}.bank`}
                label="은행"
                value={a.bank}
                onChange={(bank) => set(a.id, { bank })}
                error={err(a.id, 'bank')}
                placeholder="OO은행"
              />
              <TextField
                path={`${side}.${a.id}.number`}
                label="계좌번호"
                inputMode="text"
                value={a.number}
                onChange={(number) => set(a.id, { number })}
                error={err(a.id, 'number')}
                placeholder="000-0000-0000"
              />
            </div>
            <TextField
              path={`${side}.${a.id}.kakaoPayUrl`}
              label="카카오페이 송금 링크"
              optional
              type="url"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              value={a.kakaoPayUrl}
              onChange={(kakaoPayUrl) => set(a.id, { kakaoPayUrl })}
              error={err(a.id, 'kakaoPayUrl')}
              placeholder="https://qr.kakaopay.com/…"
              hint="카카오페이 앱의 송금 코드 링크를 붙여 넣으면 송금 버튼이 함께 보여요."
            />
          </li>
        ))}
      </ol>
      {list.length < max && (
        <button
          type="button"
          className="btn btn--soft btn--sm"
          onClick={() =>
            update((f) => ({ ...f, [side]: [...f[side], emptyAccount(f[side].length === 0 ? who : '')] }))
          }
        >
          + {who}측 계좌 추가
        </button>
      )}
    </fieldset>
  )
}

export function AccountsSection(props: SectionProps) {
  return (
    <>
      <p className="ed-help">
        마음 전하실 곳에 보일 계좌예요. 넣지 않으셔도 괜찮아요. 계좌번호는 청첩장을 보는 누구에게나 보이니 한 번 더
        확인해 주세요.
      </p>
      <Side side="groomAccounts" {...props} />
      <Side side="brideAccounts" {...props} />
    </>
  )
}
