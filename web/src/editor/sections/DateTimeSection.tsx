import { useState } from 'react'
import { formatKoreanDate } from '../../lib/date'
import { toKstIso } from '../datetime'
import type { SectionProps } from '../env'
import { TextField } from '../ui'

export function DateTimeSection({ form, update, errors }: SectionProps) {
  const [now] = useState(() => Date.now())
  const iso = toKstIso(form.date, form.time)
  const past = iso !== null && Date.parse(iso) < now
  return (
    <>
      <div className="ed-grid">
        <TextField
          path="date"
          label="예식 날짜"
          type="date"
          value={form.date}
          onChange={(date) => update((f) => ({ ...f, date }))}
          error={errors.date}
          min="2000-01-01"
          max="2199-12-31"
        />
        <TextField
          path="time"
          label="예식 시간"
          type="time"
          value={form.time}
          onChange={(time) => update((f) => ({ ...f, time }))}
          error={errors.time}
        />
      </div>
      {iso && (
        <p className="ed-preview-line" aria-live="polite">
          {formatKoreanDate(new Date(iso))}
          {past && <span className="ed-preview-line__warn"> · 이미 지난 날짜예요</span>}
        </p>
      )}
      <TextField
        path="durationMinutes"
        label="예식 소요 시간"
        inputMode="numeric"
        value={form.durationMinutes}
        onChange={(v) => update((f) => ({ ...f, durationMinutes: v.replace(/[^\d]/g, '').slice(0, 3) }))}
        error={errors.durationMinutes}
        suffix="분"
        hint="하객이 캘린더에 일정을 담을 때 끝나는 시각을 계산하는 데 써요. 보통 60~90분이에요."
        className="ed-field--narrow"
      />
    </>
  )
}
