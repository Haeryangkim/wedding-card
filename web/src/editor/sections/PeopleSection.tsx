import type { PersonForm } from '../form'
import { autoFirstName } from '../form'
import type { SectionProps } from '../env'
import { CheckField, TextField } from '../ui'

const RELATIONS = {
  groom: ['장남', '차남', '삼남', '막내아들', '아들'],
  bride: ['장녀', '차녀', '삼녀', '막내딸', '딸'],
} as const

function PersonFields({ who, form, update, errors }: SectionProps & { who: 'groom' | 'bride' }) {
  const label = who === 'groom' ? '신랑' : '신부'
  const p = form[who]
  const set = (patch: Partial<PersonForm>) => update((f) => ({ ...f, [who]: { ...f[who], ...patch } }))
  const err = (k: string) => errors[`${who}.${k}`]
  const listId = `relations-${who}`
  return (
    <fieldset className="ed-group">
      <legend className="ed-group__legend">{label}</legend>
      <div className="ed-grid">
        <TextField
          path={`${who}.name`}
          label="이름"
          value={p.name}
          onChange={(name) => set({ name })}
          error={err('name')}
          placeholder={who === 'groom' ? '김신랑' : '박신부'}
          maxLength={40}
        />
        <TextField
          path={`${who}.firstName`}
          label="부르는 이름"
          optional
          value={p.firstName}
          onChange={(firstName) => set({ firstName })}
          error={err('firstName')}
          placeholder={autoFirstName(p.name) || (who === 'groom' ? '신랑' : '신부')}
          hint="인사말과 디데이 문구에 쓰여요. 비워 두면 성을 뺀 이름이 들어가요."
          maxLength={40}
        />
        <TextField
          path={`${who}.relation`}
          label="관계"
          optional
          value={p.relation}
          onChange={(relation) => set({ relation })}
          error={err('relation')}
          placeholder={who === 'groom' ? '장남' : '장녀'}
          hint={`"아버지 · 어머니의 ${who === 'groom' ? '장남' : '장녀'}" 처럼 표시돼요.`}
          list={listId}
          maxLength={40}
        />
        <datalist id={listId}>
          {RELATIONS[who].map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <TextField
          path={`${who}.phone`}
          label="연락처"
          optional
          type="tel"
          inputMode="tel"
          value={p.phone}
          onChange={(phone) => set({ phone })}
          error={err('phone')}
          placeholder="010-0000-0000"
          hint="넣으면 하객이 바로 전화·문자를 보낼 수 있어요."
        />
      </div>
      <div className="ed-grid">
        <div className="ed-parent">
          <TextField
            path={`${who}.fatherName`}
            label="아버지 성함"
            optional
            value={p.fatherName}
            onChange={(fatherName) => set({ fatherName })}
            error={err('fatherName')}
            maxLength={40}
          />
          <CheckField label="故 (고인) 표시" checked={p.fatherDeceased} onChange={(fatherDeceased) => set({ fatherDeceased })} />
        </div>
        <div className="ed-parent">
          <TextField
            path={`${who}.motherName`}
            label="어머니 성함"
            optional
            value={p.motherName}
            onChange={(motherName) => set({ motherName })}
            error={err('motherName')}
            maxLength={40}
          />
          <CheckField label="故 (고인) 표시" checked={p.motherDeceased} onChange={(motherDeceased) => set({ motherDeceased })} />
        </div>
      </div>
    </fieldset>
  )
}

export function PeopleSection(props: SectionProps) {
  return (
    <>
      <PersonFields who="groom" {...props} />
      <PersonFields who="bride" {...props} />
    </>
  )
}
