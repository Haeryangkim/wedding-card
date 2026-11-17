import { useEffect, useMemo, useState } from 'react'
import { useWedding } from '../../platform/WeddingContext'
import { countdown, formatKoreanTime, kstParts, monthGrid, type Countdown } from '../../lib/date'
import { openDeviceCalendar, openGoogleCalendar, preferredCalendarTarget, weddingEvent } from '../../lib/calendar'
import { weddingUrl } from '../../lib/share'
import { PixelPopup, type PopupProps } from './PixelPopup'
import './popups.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n: number) => String(n).padStart(2, '0')

/** "예식 일시": 날짜·시간, D-day, 미니 달력, 일정 등록 */
export function SchedulePopup({ onClose }: PopupProps) {
  const { slug, isDemo, config } = useWedding()
  const date = useMemo(() => new Date(config.datetime), [config.datetime])
  const valid = !Number.isNaN(date.getTime())
  const parts = useMemo(() => (valid ? kstParts(date) : null), [date, valid])
  const grid = useMemo(() => (parts ? monthGrid(parts.year, parts.month) : null), [parts])

  const [cd, setCd] = useState<Countdown | null>(() => (valid ? countdown(date) : null))
  useEffect(() => {
    if (!valid) return
    const tick = () => setCd(countdown(date))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [date, valid])

  if (!parts || !grid || !cd) {
    return (
      <PixelPopup title="예식 일시" icon="calendar" onClose={onClose}>
        <p className="px-note">예식 일시가 정해지면 이곳에서 알려 드릴게요.</p>
      </PixelPopup>
    )
  }

  const recommended = preferredCalendarTarget()
  const deviceBtn = (
    <button
      key="device"
      type="button"
      className={`px-btn px-btn--block${recommended === 'device' ? ' px-btn--primary' : ''}`}
      onClick={() => openDeviceCalendar(slug, isDemo)}
    >
      기본 캘린더에 추가
    </button>
  )
  const googleBtn = (
    <button
      key="google"
      type="button"
      className={`px-btn px-btn--block${recommended === 'google' ? ' px-btn--primary' : ''}`}
      onClick={() => openGoogleCalendar(weddingEvent(config, weddingUrl(slug)))}
    >
      Google 캘린더에 추가
    </button>
  )

  return (
    <PixelPopup
      title="예식 일시"
      icon="calendar"
      onClose={onClose}
      footer={
        cd.done ? undefined : (
          <div className="pxs__actions">{recommended === 'google' ? [googleBtn, deviceBtn] : [deviceBtn, googleBtn]}</div>
        )
      }
    >
      <div className="pxs__head">
        <div className="pxs__date">
          <p className="pxs__ymd">
            {parts.year}. {pad(parts.month)}. {pad(parts.day)}
          </p>
          <p className="pxs__time">
            {WEEKDAYS[parts.weekday]}요일 {formatKoreanTime(date)}
          </p>
        </div>
        <div className={`pxs__dday${cd.done ? ' is-done' : ''}`} aria-live="off">
          {cd.done ? '♥' : cd.totalDays === 0 ? 'D-DAY' : `D-${cd.totalDays}`}
        </div>
      </div>

      {cd.done ? (
        <p className="pxs__left">
          <strong>
            {config.groom.firstName || config.groom.name} · {config.bride.firstName || config.bride.name}, 결혼했습니다
          </strong>
          <br />
          함께해 주신 모든 분들께 감사드립니다
        </p>
      ) : (
        <p className="pxs__left" role="timer" aria-label="예식까지 남은 시간">
          {cd.totalDays === 0 ? '오늘입니다! ' : ''}
          <strong>
            {cd.days > 0 ? `${cd.days}일 ` : ''}
            {pad(cd.hours)}:{pad(cd.minutes)}:{pad(cd.seconds)}
          </strong>{' '}
          남았어요
        </p>
      )}

      <div className="pxs__cal" role="grid" aria-label={`${parts.year}년 ${parts.month}월`}>
        <p className="pxs__month" aria-hidden="true">
          {parts.year}년 {parts.month}월
        </p>
        <div className="pxs__grid">
          {WEEKDAYS.map((w, i) => (
            <div key={w} role="columnheader" className={`pxs__wd${i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : ''}`}>
              {w}
            </div>
          ))}
          {grid.weeks.flat().map((day, i) => {
            const target = day === parts.day
            return (
              <div
                key={i}
                role="gridcell"
                aria-current={target ? 'date' : undefined}
                aria-label={target ? `${day}일, 예식일` : undefined}
                className={`pxs__cell${i % 7 === 0 ? ' is-sun' : i % 7 === 6 ? ' is-sat' : ''}${target ? ' is-target' : ''}`}
              >
                {day ?? ''}
              </div>
            )
          })}
        </div>
      </div>
    </PixelPopup>
  )
}
