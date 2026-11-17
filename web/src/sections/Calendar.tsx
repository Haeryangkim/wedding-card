import { useEffect, useMemo, useState } from 'react'
import { wedding } from '../config/wedding'
import { SectionHeading } from '../components/SectionHeading'
import { BottomSheet } from '../components/BottomSheet'
import {
  countdown,
  formatKoreanDate,
  kstParts,
  monthGrid,
  type Countdown,
} from '../lib/date'
import {
  openDeviceCalendar,
  openGoogleCalendar,
  preferredCalendarTarget,
  weddingEvent,
} from '../lib/calendar'
import { siteUrl } from '../lib/share'
import './Calendar.css'

const WEEKDAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토']

export function Calendar() {
  const date = useMemo(() => new Date(wedding.datetime), [])
  const parts = useMemo(() => kstParts(date), [date])
  const grid = useMemo(() => monthGrid(parts.year, parts.month), [parts.year, parts.month])

  const [cd, setCd] = useState<Countdown>(() => countdown(date))
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    const tick = () => setCd(countdown(date))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [date])

  const recommended = preferredCalendarTarget()

  const handleGoogle = () => {
    openGoogleCalendar(weddingEvent(wedding, siteUrl()))
    setSheetOpen(false)
  }
  const handleDevice = () => {
    openDeviceCalendar()
    setSheetOpen(false)
  }

  return (
    <section className="section calendar" aria-labelledby="calendar-title">
      <SectionHeading eyebrow="SAVE THE DATE" title="예식 안내" />

      <p className="calendar__dateline" id="calendar-title">
        {formatKoreanDate(date)}
      </p>

      <div className="calendar__card">
        <div className="calendar__grid" role="grid" aria-label={`${parts.year}년 ${parts.month}월`}>
          {WEEKDAY_HEADERS.map((w, i) => (
            <div
              key={w}
              className={`calendar__wd${i === 0 ? ' calendar__wd--sun' : ''}`}
              role="columnheader"
            >
              {w}
            </div>
          ))}
          {grid.weeks.flat().map((day, i) => {
            const isSun = i % 7 === 0
            const isTarget = day === parts.day
            return (
              <div
                key={i}
                role="gridcell"
                className={`calendar__cell${day ? '' : ' is-empty'}${isSun ? ' is-sun' : ''}${
                  isTarget ? ' is-target' : ''
                }`}
              >
                {day && (
                  <span className="calendar__day">
                    {day}
                    {isTarget && (
                      <svg className="calendar__heart" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12 21s-7.5-4.6-10-9.3C.3 8 1.9 4.6 5.2 4.6c2 0 3.3 1.1 4.8 3 1.5-1.9 2.8-3 4.8-3 3.3 0 4.9 3.4 3.2 7.1C19.5 16.4 12 21 12 21z"
                        />
                      </svg>
                    )}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {cd.done ? (
        <div className="calendar__married">
          <span className="calendar__married-hearts" aria-hidden="true">
            ♥
          </span>
          <p className="calendar__married-line">
            {wedding.groom.firstName} · {wedding.bride.firstName}, 결혼했습니다
          </p>
          <p className="calendar__married-sub">함께해 주신 모든 분들께 감사드립니다</p>
        </div>
      ) : (
        <>
          <p className="calendar__dday">
            {wedding.groom.firstName}님과 {wedding.bride.firstName}님의 결혼식이{' '}
            {cd.totalDays === 0 ? (
              <>
                <strong>오늘</strong>입니다
              </>
            ) : (
              <>
                <strong>{cd.totalDays}일</strong> 남았습니다
              </>
            )}
          </p>
          <div className="calendar__count" aria-label="예식까지 남은 시간">
            {[
              { v: cd.days, label: '일' },
              { v: cd.hours, label: '시간' },
              { v: cd.minutes, label: '분' },
              { v: cd.seconds, label: '초' },
            ].map((u) => (
              <div className="calendar__count-unit" key={u.label}>
                <span className="calendar__count-num">{String(u.v).padStart(2, '0')}</span>
                <span className="calendar__count-label">{u.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <button type="button" className="btn btn--soft btn--block calendar__add" onClick={() => setSheetOpen(true)}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1zm13 7H4v10h16zM13 11v3h3v2h-3v3h-2v-3H8v-2h3v-3z"
          />
        </svg>
        일정 등록
      </button>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="캘린더에 일정 등록">
        <button
          type="button"
          className={`calendar__opt${recommended === 'device' ? ' is-reco' : ''}`}
          onClick={handleDevice}
        >
          <span className="calendar__opt-main">기본 캘린더 (Apple 등)</span>
          <span className="calendar__opt-sub">
            {recommended === 'device' ? '이 기기에 추천' : 'iPhone · 기본 캘린더 앱'}
          </span>
        </button>
        <button
          type="button"
          className={`calendar__opt${recommended === 'google' ? ' is-reco' : ''}`}
          onClick={handleGoogle}
        >
          <span className="calendar__opt-main">Google 캘린더</span>
          <span className="calendar__opt-sub">
            {recommended === 'google' ? '이 기기에 추천' : '구글 계정 일정에 추가'}
          </span>
        </button>
      </BottomSheet>
    </section>
  )
}
