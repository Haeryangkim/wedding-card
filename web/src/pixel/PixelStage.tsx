/**
 * 픽셀 청첩장의 한 화면: 결혼식장 장면(전체 화면) + HUD(위 이름·날짜 바, 아래 메뉴 도크) + 팝업.
 * 정보는 모두 눌러서 연다 — 신랑·신부 → 인사말, 하객 → 그 하객의 축하 카드, 도크 버튼 → 주제별 팝업.
 * 팝업은 한 번에 하나만 열린다.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { GuestEntry, NewGuestInput } from '../guestbook/types'
import { useGuestbook } from '../guestbook/useGuestbook'
import { WorldCanvas } from '../guestbook/ui/WorldCanvas'
import { BottomSheet } from '../guestbook/ui/BottomSheet'
import { JoinFlow } from '../guestbook/ui/JoinFlow'
import { GuestList } from '../guestbook/ui/GuestList'
import { GuestCard } from '../guestbook/ui/GuestCard'
import { useToast } from '../components/Toast'
import { copyText } from '../lib/clipboard'
import { kstParts } from '../lib/date'
import { lockScroll } from '../lib/scrollLock'
import { nativeShare, pixelShareText, pixelWeddingUrl } from '../lib/share'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Link, navigate } from '../platform/router'
import { useWedding } from '../platform/WeddingContext'
import { useBackLayer } from './backLayer'
import { HudIcon, type HudIconName } from './icons'
import { AccountsPopup, GalleryPopup, GreetingPopup, LocationPopup, SchedulePopup } from './popups'
import { StyleSwitch } from '../guestbook/ui/StyleSwitch'
import { useSceneStyle, useStyledEntries } from '../guestbook/sceneStyle'
import './PixelStage.css'

type InfoPopup = 'greeting' | 'schedule' | 'location' | 'accounts' | 'gallery'
/** guestbook = 선택 창(남기기 / 전체 보기), join = 캐릭터 만들기, list = 전체 목록 */
type Popup = InfoPopup | 'guestbook' | 'join' | 'list'

interface DockItem {
  id: Popup
  /** 버튼 글자. 좁은 화면에서 줄이 바뀔 수 있는 자리는 '|' 로 표시한다 */
  label: string
  icon: HudIconName
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

/** "2027.05.15 (토) 오후 12:30" — 상단 바의 한 줄 날짜. 날짜가 올바르지 않으면 빈 문자열 */
function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const { year, month, day, hour, minute, weekday } = kstParts(d)
  const p2 = (n: number) => String(n).padStart(2, '0')
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${year}.${p2(month)}.${p2(day)} (${WEEKDAY_KO[weekday]}) ${hour < 12 ? '오전' : '오후'} ${h12}:${p2(minute)}`
}

/** 한 화면 고정: 문서 스크롤과 당겨서 새로고침/바운스를 막는다 (떠날 때 원래대로) */
function usePageLock(): void {
  useEffect(() => {
    const unlock = lockScroll()
    const root = document.documentElement
    root.classList.add('px-locked')
    window.scrollTo(0, 0)
    return () => {
      root.classList.remove('px-locked')
      unlock()
    }
  }, [])
}

export function PixelStage() {
  const { slug, isDemo, config } = useWedding()
  const toast = useToast()
  const book = useGuestbook(slug, isDemo)
  const { loading, error, myIds } = book
  // 데모: 한 맵에 한 그림체 — 보는 사람이 바꿔 볼 수 있다
  const sceneStyle = useSceneStyle(isDemo)
  const entries = useStyledEntries(book.entries, sceneStyle)

  const [popup, setPopup] = useState<Popup | null>(null)
  const [selected, setSelected] = useState<GuestEntry | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [focusSeq, setFocusSeq] = useState(0)

  usePageLock()
  const share = pixelShareText(config)
  useDocumentTitle(share.title, true)

  // ── HUD 가 가리는 높이 → 장면이 그 안쪽에 놓이도록 캔버스에 알려 준다 ──
  const stageRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLElement>(null)
  const dockRef = useRef<HTMLElement>(null)
  const [insets, setInsets] = useState({ top: 64, bottom: 96 })
  useLayoutEffect(() => {
    const stage = stageRef.current
    const top = topRef.current
    const dock = dockRef.current
    if (!stage || !top || !dock) return
    const measure = () => {
      const s = stage.getBoundingClientRect()
      const next = {
        top: Math.max(0, Math.round(top.getBoundingClientRect().bottom - s.top)),
        bottom: Math.max(0, Math.round(s.bottom - dock.getBoundingClientRect().top)),
      }
      setInsets((prev) => (prev.top === next.top && prev.bottom === next.bottom ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    ro.observe(top)
    ro.observe(dock)
    return () => ro.disconnect()
  }, [])

  // 선택한 하객이 (다른 기기에서) 지워지면 카드 닫기
  useEffect(() => {
    if (selected && !entries.some((e) => e.id === selected.id)) setSelected(null)
  }, [entries, selected])

  const open = useCallback((next: Popup) => {
    setSelected(null)
    setPopup(next)
  }, [])
  const close = useCallback(() => setPopup(null), [])

  // 뒤로 가기 = 열린 창 닫기. 팝업·카드가 열려 있는 동안 히스토리 항목 하나를 차지한다
  // (팝업끼리 바꿔 열 때는 그 항목을 그대로 쓴다)
  const closeAll = useCallback(() => {
    setPopup(null)
    setSelected(null)
  }, [])
  const releaseLayer = useBackLayer(popup !== null || selected !== null, 1, closeAll)
  /** 창이 열린 채 다른 화면으로 떠나는 링크: 창이 쌓은 항목을 새 주소로 바꿔 빈 항목이 남지 않게 한다 */
  const leaveTo = (to: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (!releaseLayer()) return
    e.preventDefault()
    navigate(to, { replace: true })
  }

  const selectGuest = useCallback((entry: GuestEntry) => {
    setPopup(null)
    setSelected(entry)
  }, [])
  const selectCouple = useCallback(() => open('greeting'), [open])
  const openList = useCallback(() => open('list'), [open])

  /** 팝업을 모두 닫고 장면에서 그 하객을 강조한다 (한 화면이라 스크롤은 없다) */
  const locate = (id: string) => {
    setPopup(null)
    setSelected(null)
    setFocusId(id)
    setFocusSeq((n) => n + 1)
  }

  const handleAdd = async (input: NewGuestInput) => {
    const entry = await book.add(input)
    locate(entry.id) // 새 캐릭터가 장면에 떨어지며 강조된다
  }

  const handleDelete = async (id: string, password: string) => {
    await book.remove(id, password)
    if (selected?.id === id) setSelected(null)
    if (focusId === id) setFocusId(null)
  }

  const doShare = async () => {
    const url = pixelWeddingUrl(slug)
    const result = await nativeShare({ title: share.title, text: share.description, url })
    if (result === 'shared' || result === 'cancelled') return
    const ok = await copyText(url)
    toast.show(ok ? '픽셀 청첩장 링크가 복사되었습니다' : '복사에 실패했습니다. 주소창을 길게 눌러 복사해 주세요')
  }

  const hasAccounts = config.accounts.groomSide.length + config.accounts.brideSide.length > 0
  const hasPhotos = config.gallery.length > 0
  const dock: DockItem[] = [
    { id: 'schedule', label: '예식 일시', icon: 'calendar' },
    { id: 'location', label: '오시는 길', icon: 'pin' },
    ...(hasAccounts ? [{ id: 'accounts', label: '마음|전하실 곳', icon: 'envelope' } as const] : []),
    ...(hasPhotos ? [{ id: 'gallery', label: '갤러리', icon: 'photo' } as const] : []),
    { id: 'guestbook', label: '방명록', icon: 'bubble' },
  ]

  const date = shortDate(config.datetime)
  const guestCount = entries.length

  return (
    <div className="px-page">
      <main className="px-stage" ref={stageRef}>
        <h1 className="px-sr">
          {config.groom.name} ♥ {config.bride.name} 픽셀 청첩장
        </h1>

        <WorldCanvas
          mode="stage"
          entries={entries}
          focusId={focusId}
          focusSeq={focusSeq}
          loaded={!loading}
          groomName={config.groom.name}
          brideName={config.bride.name}
          onSelect={selectGuest}
          onSelectCouple={selectCouple}
          onOverflowClick={openList}
          coupleStyle={sceneStyle ?? undefined}
          insetTop={insets.top}
          insetBottom={insets.bottom}
        />

        <header className="px-top" ref={topRef}>
          <div className="px-top__title">
            <p className="px-top__names">
              <span>{config.groom.name}</span>
              <span className="px-top__heart" aria-hidden="true">
                ♥
              </span>
              <span>{config.bride.name}</span>
            </p>
            {date && <p className="px-top__date">{date}</p>}
          </div>
          <div className="px-top__actions">
            <button type="button" className="px-chip" onClick={doShare} aria-label="픽셀 청첩장 공유하기">
              <HudIcon name="share" size={18} />
              <span>공유</span>
            </button>
            <Link className="px-chip" to={`/w/${slug}`} onClick={leaveTo(`/w/${slug}`)} aria-label="일반 청첩장으로 보기">
              <HudIcon name="letter" size={18} />
              <span>
                일반
                <br />
                청첩장
              </span>
            </Link>
          </div>
          {sceneStyle && <StyleSwitch value={sceneStyle} className="px-style" />}
        </header>

        {/* 캔버스의 두 사람은 키보드·스크린리더로 누를 수 없으므로 같은 동작의 버튼을 둔다 (포커스될 때만 보인다) */}
        <button type="button" className="px-greet" onClick={selectCouple} aria-haspopup="dialog">
          신랑 · 신부 인사말 보기
        </button>

        <nav className="px-dock" ref={dockRef} aria-label="청첩장 메뉴">
          {dock.map((item) => (
            <button
              key={item.id}
              type="button"
              className="px-dock__btn"
              onClick={() => open(item.id)}
              aria-haspopup="dialog"
            >
              <span className="px-dock__icon">
                <HudIcon name={item.icon} size={32} />
                {item.id === 'guestbook' && !loading && guestCount > 0 && (
                  <span className="px-dock__badge" aria-label={`하객 ${guestCount}명`}>
                    {guestCount > 999 ? '999+' : guestCount}
                  </span>
                )}
              </span>
              <span className="px-dock__label">
                {item.label.split('|').map((part) => (
                  <span key={part}>{part}</span>
                ))}
              </span>
            </button>
          ))}
        </nav>
      </main>

      {popup === 'greeting' && <GreetingPopup onClose={close} />}
      {popup === 'schedule' && <SchedulePopup onClose={close} />}
      {popup === 'location' && <LocationPopup onClose={close} />}
      {popup === 'accounts' && <AccountsPopup onClose={close} />}
      {popup === 'gallery' && <GalleryPopup onClose={close} />}

      <BottomSheet open={popup === 'guestbook'} onClose={close} title="방명록">
        <div className="px-book">
          <p className="px-book__count">
            {loading
              ? '하객들을 불러오는 중…'
              : guestCount > 0
                ? `하객 ${guestCount}명이 식장에서 축하하고 있어요`
                : '아직 아무도 없어요. 첫 번째 하객이 되어 주세요!'}
          </p>
          <button type="button" className="px-book__btn px-book__btn--primary" onClick={() => open('join')}>
            캐릭터 만들고 축하 남기기
          </button>
          <button type="button" className="px-book__btn" onClick={() => open('list')}>
            방명록 전체 보기
          </button>
          {book.mode === 'local' && (
            <p className="px-book__note">
              데모 청첩장이에요. 남긴 메시지는 이 기기에만 저장돼요.{' '}
              <Link to="/new" className="px-book__link" onClick={leaveTo('/new')}>
                나도 만들기
              </Link>
            </p>
          )}
        </div>
      </BottomSheet>

      <BottomSheet open={popup === 'join'} onClose={close} title="축하 남기기">
        <JoinFlow key={sceneStyle ?? 'any'} onSubmit={handleAdd} scope={book.scope} lockStyle={sceneStyle ?? undefined} />
      </BottomSheet>

      <BottomSheet
        open={popup === 'list'}
        onClose={close}
        title="방명록"
        headerExtra={!loading && !error ? `${guestCount}명` : undefined}
      >
        <GuestList
          entries={entries}
          myIds={myIds}
          loading={loading}
          error={error}
          onRetry={book.reload}
          onLocate={locate}
          onDelete={handleDelete}
        />
      </BottomSheet>

      {selected && (
        <GuestCard
          entry={entries.find((e) => e.id === selected.id) ?? selected}
          mine={myIds.has(selected.id)}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onLocate={locate}
        />
      )}
    </div>
  )
}
