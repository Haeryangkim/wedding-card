import { PLATFORM_LIMITS } from '../../platform/contract'
import type { SectionProps } from '../env'
import { DEFAULT_GREETING, splitLines } from '../form'
import { TextArea, TextField } from '../ui'

export function GreetingSection({ form, update, errors }: SectionProps) {
  const lines = splitLines(form.greetingBody, { keepBlank: true }).length
  const max = PLATFORM_LIMITS.text.greetingLines
  return (
    <>
      <TextField
        path="greetingTitle"
        label="제목"
        value={form.greetingTitle}
        onChange={(greetingTitle) => update((f) => ({ ...f, greetingTitle }))}
        error={errors.greetingTitle}
        placeholder={DEFAULT_GREETING.title}
      />
      <TextArea
        path="greetingBody"
        label="인사말"
        rows={9}
        value={form.greetingBody}
        onChange={(greetingBody) => update((f) => ({ ...f, greetingBody }))}
        error={errors.greetingBody}
        hint={`줄을 바꾼 그대로 보여요. 빈 줄은 문단 사이 여백이 됩니다. (${lines}/${max}줄)`}
      />
      {form.greetingBody.trim() === '' && (
        <button
          type="button"
          className="btn btn--soft btn--sm"
          onClick={() =>
            update((f) => ({
              ...f,
              greetingTitle: f.greetingTitle || DEFAULT_GREETING.title,
              greetingBody: DEFAULT_GREETING.body.join('\n'),
            }))
          }
        >
          기본 인사말 넣기
        </button>
      )}
    </>
  )
}
