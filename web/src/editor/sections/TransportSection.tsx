import { PLATFORM_LIMITS } from '../../platform/contract'
import type { SectionProps } from '../env'
import { emptyTransport, moveItem, type TransportForm } from '../form'
import { IconButton, TextArea, TextField } from '../ui'

const PRESETS = ['지하철', '버스', '주차', '셔틀버스'] as const

export function TransportSection({ form, update, errors }: SectionProps) {
  const max = PLATFORM_LIMITS.text.transportBlocks
  const list = form.transport
  const set = (id: string, patch: Partial<TransportForm>) =>
    update((f) => ({ ...f, transport: f.transport.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))
  const add = (title: string) => update((f) => ({ ...f, transport: [...f.transport, { ...emptyTransport(), title }] }))
  const unused = PRESETS.filter((p) => !list.some((b) => b.title.trim() === p))

  return (
    <>
      <p className="ed-help">지하철·버스·주차처럼 오시는 방법을 항목별로 적어 주세요. 필요 없으면 비워 두셔도 돼요.</p>
      {errors.transport && (
        <p className="ed-field__error" role="alert">
          {errors.transport}
        </p>
      )}
      <ol className="ed-list">
        {list.map((b, i) => (
          <li className="ed-item" key={b.id}>
            <div className="ed-item__bar">
              <span className="ed-item__no">{i + 1}</span>
              <div className="ed-item__actions">
                <IconButton
                  icon="up"
                  label="위로 옮기기"
                  disabled={i === 0}
                  onClick={() => update((f) => ({ ...f, transport: moveItem(f.transport, i, -1) }))}
                />
                <IconButton
                  icon="down"
                  label="아래로 옮기기"
                  disabled={i === list.length - 1}
                  onClick={() => update((f) => ({ ...f, transport: moveItem(f.transport, i, 1) }))}
                />
                <IconButton
                  icon="remove"
                  danger
                  label={`${b.title.trim() || `${i + 1}번째`} 항목 삭제`}
                  onClick={() => update((f) => ({ ...f, transport: f.transport.filter((x) => x.id !== b.id) }))}
                />
              </div>
            </div>
            <TextField
              path={`transport.${b.id}.title`}
              label="제목"
              value={b.title}
              onChange={(title) => set(b.id, { title })}
              error={errors[`transport.${b.id}.title`]}
              placeholder="지하철"
            />
            <TextArea
              path={`transport.${b.id}.lines`}
              label="안내"
              rows={3}
              value={b.lines}
              onChange={(lines) => set(b.id, { lines })}
              error={errors[`transport.${b.id}.lines`]}
              placeholder="2호선 시청역 5번 출구 도보 3분"
              hint="한 줄에 하나씩 적어 주세요."
            />
          </li>
        ))}
      </ol>
      {list.length < max ? (
        <div className="ed-add-row">
          {unused.map((p) => (
            <button key={p} type="button" className="btn btn--soft btn--sm" onClick={() => add(p)}>
              + {p}
            </button>
          ))}
          <button type="button" className="btn btn--soft btn--sm" onClick={() => add('')}>
            + 직접 추가
          </button>
        </div>
      ) : (
        <p className="ed-help">교통 안내는 {max}개까지 넣을 수 있어요.</p>
      )}
    </>
  )
}
