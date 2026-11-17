import { useMemo, useState, type FormEvent } from 'react'
import type { Appearance } from '../guestbook/types'
import type { Dir } from '../guestbook/character'
import { randomAppearance } from '../guestbook/character'
import { CharacterPreview } from '../guestbook/ui/CharacterPreview'
import { mulberry32 } from '../guestbook/world/rng'
import { getApi } from '../platform/api'
import { DEMO_SLUG, SLUG_PATTERN } from '../platform/contract'
import { Link, navigate } from '../platform/router'
import { SERVICE_NAME, useDocumentTitle } from '../lib/useDocumentTitle'
import './Landing.css'

const REPO_URL = 'https://github.com/Haeryangkim/wedding-card'

/** 문자열 행('#' = 칠함)으로 그리는 작은 픽셀 아이콘 */
function PixelIcon({ rows, size = 3 }: { rows: string[]; size?: number }) {
  const w = Math.max(...rows.map((r) => r.length))
  const rects: { x: number; y: number; len: number }[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (row[x] !== '#') {
        x++
        continue
      }
      let len = 1
      while (row[x + len] === '#') len++
      rects.push({ x, y, len })
      x += len
    }
  })
  return (
    <svg
      className="px-icon"
      viewBox={`0 0 ${w} ${rows.length}`}
      width={w * size}
      height={rows.length * size}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.len} height={1} fill="currentColor" />
      ))}
    </svg>
  )
}

const ICON_HEART = [
  '.##...##.',
  '####.####',
  '#########',
  '#########',
  '.#######.',
  '..#####..',
  '...###...',
  '....#....',
]
const ICON_LETTER = [
  '#############',
  '##.........##',
  '#.#.......#.#',
  '#..#.....#..#',
  '#...#...#...#',
  '#....###....#',
  '#...........#',
  '#...........#',
  '#############',
]
const ICON_PIN = [
  '..#####..',
  '.#######.',
  '###...###',
  '###...###',
  '###...###',
  '.#######.',
  '.#######.',
  '..#####..',
  '...###...',
  '...###...',
  '....#....',
]
const ICON_KEY = [
  '.####.........',
  '##..##........',
  '#....#########',
  '#....#########',
  '##..##..##.##.',
  '.####...##.##.',
]

const FEATURES: { icon: string[]; title: string; body: string }[] = [
  {
    icon: ICON_LETTER,
    title: '청첩장에 필요한 것들',
    body: '인사말, 예식 달력과 디데이, 사진 갤러리, 마음 전하실 곳, 링크 공유까지 한 페이지에 담습니다.',
  },
  {
    icon: ICON_PIN,
    title: '일정 등록 · 길안내',
    body: '하객이 캘린더에 예식 일정을 바로 등록하고, 카카오내비 · 네이버지도 · 티맵으로 예식장 가는 길을 엽니다.',
  },
  {
    icon: ICON_HEART,
    title: '픽셀 방명록',
    body: '하객이 캐릭터를 꾸미고 축하 한마디를 남기면, 그 캐릭터가 예식장 그림 속을 걸어 다닙니다.',
  },
  {
    icon: ICON_KEY,
    title: '계정 없이 관리',
    body: '주소 이름과 관리 비밀번호만 정하면 됩니다. 같은 비밀번호로 언제든 내용과 사진을 고칠 수 있어요.',
  },
]

const STEPS: { title: string; body: string }[] = [
  { title: '주소 정하기', body: '청첩장 주소 이름과 관리 비밀번호를 정합니다.' },
  { title: '내용 채우기', body: '두 분의 이름, 예식 일시와 장소, 인사말, 사진을 넣습니다.' },
  { title: '링크 보내기', body: '완성된 주소를 메신저로 전하면 끝이에요.' },
]

const GUEST_DIRS: Dir[] = ['right', 'down', 'down', 'down', 'left']
const BUBBLES = ['결혼 축하해요!', '행복하세요 ♥', '오래오래 함께!', '와, 예쁘다']

function makeGuests(seed: number): Appearance[] {
  const rand = mulberry32(seed)
  return GUEST_DIRS.map(() => randomAppearance(rand))
}

/** 픽셀 방명록 맛보기: 두 사람과, 제자리에서 걷는 하객 캐릭터들 */
function PixelStage() {
  const [seed, setSeed] = useState(20270515)
  const guests = useMemo(() => makeGuests(seed), [seed])
  const bubbleA = BUBBLES[seed % BUBBLES.length]
  const bubbleB = BUBBLES[(seed + 1) % BUBBLES.length]

  return (
    <div className="stage">
      <div className="stage__frame">
        <div className="stage__scene">
          <div className="stage__arch" aria-hidden="true" />
          <div className="stage__couple">
            <CharacterPreview kind="groom" scale={3} />
            <span className="stage__heart" aria-hidden="true">
              <PixelIcon rows={ICON_HEART} size={2} />
            </span>
            <CharacterPreview kind="bride" scale={3} />
          </div>
          <div className="stage__guests">
            {guests.map((g, i) => (
              <div className="stage__guest" key={`${seed}-${i}`}>
                {i === 0 && <span className="stage__bubble stage__bubble--a">{bubbleA}</span>}
                {i === 3 && <span className="stage__bubble stage__bubble--b">{bubbleB}</span>}
                <CharacterPreview kind={g} scale={3} dir={GUEST_DIRS[i]} animate />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="stage__foot">
        <p className="stage__caption">하객이 만든 캐릭터가 예식장에 모여요</p>
        <button
          type="button"
          className="stage__shuffle"
          onClick={() => setSeed((s) => (Math.imul(s, 1103515245) + 12345) >>> 0)}
        >
          다른 하객 보기
        </button>
      </div>
    </div>
  )
}

/** 입력값(주소 이름 또는 붙여 넣은 전체 주소) → slug 후보 */
function parseSlug(input: string): string {
  const s = input.trim().toLowerCase()
  const m = /\/w\/([^/?#\s]+)/.exec(s)
  return (m ? m[1] : s).replace(/^\/+|\/+$/g, '')
}

function ManageForm() {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const slug = parseSlug(value)
    if (!slug) return setError('청첩장 주소 이름을 입력해 주세요.')
    if (slug === DEMO_SLUG) return setError('데모 청첩장은 수정할 수 없어요. 직접 만든 청첩장의 주소 이름을 입력해 주세요.')
    if (!SLUG_PATTERN.test(slug)) {
      return setError('주소 이름은 영문 소문자 · 숫자 · 하이픈(-) 3~30자예요.')
    }
    setError('')
    navigate(`/w/${slug}/edit`)
  }

  return (
    <form className="manage" onSubmit={submit} noValidate>
      <label className="manage__label" htmlFor="manage-slug">
        청첩장 주소 이름
      </label>
      <div className="manage__row">
        <div className={`manage__field${error ? ' is-error' : ''}`}>
          <span className="manage__prefix" aria-hidden="true">
            /w/
          </span>
          <input
            id="manage-slug"
            className="manage__input"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder="our-wedding"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (error) setError('')
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby="manage-help"
          />
        </div>
        <button type="submit" className="btn btn--soft manage__submit">
          관리 화면 열기
        </button>
      </div>
      <p id="manage-help" className={`manage__help${error ? ' is-error' : ''}`} role={error ? 'alert' : undefined}>
        {error || '다음 화면에서 관리 비밀번호를 입력하면 내용을 수정할 수 있어요.'}
      </p>
    </form>
  )
}

export default function Landing() {
  useDocumentTitle()
  const serverAvailable = getApi().available

  return (
    <div className="landing">
      <header className="landing__top">
        <Link className="landing__brand" to="/">
          <PixelIcon rows={ICON_HEART} size={2} />
          <span>{SERVICE_NAME}</span>
        </Link>
        <nav className="landing__nav" aria-label="바로가기">
          <Link to="/w/demo">데모</Link>
          <a href="#manage">내 청첩장 관리</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero__copy">
            <p className="hero__eyebrow">MOBILE WEDDING INVITATION</p>
            <h1 className="hero__title">
              하객이 캐릭터로 찾아오는
              <br />
              <em>모바일 청첩장</em>
            </h1>
            <p className="hero__lead">
              예식 안내와 오시는 길, 사진, 마음 전하실 곳을 한 장에 담고, 하객은 픽셀 캐릭터를 만들어 축하 인사를
              남깁니다.
            </p>
            <div className="hero__cta">
              <Link className="btn btn--primary hero__btn hero__btn--primary" to="/new">
                내 청첩장 만들기
              </Link>
              <Link className="btn hero__btn" to="/w/demo">
                데모 보기
              </Link>
            </div>
            {!serverAvailable && (
              <p className="hero__notice" role="note">
                <strong>이 사이트는 서버 없이 열어 둔 데모예요.</strong> 데모 청첩장은 그대로 체험할 수 있지만, 새
                청첩장을 만들어 저장하려면 서버를 함께 설치한 배포가 필요합니다.{' '}
                <a href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer">
                  설치 방법 보기
                </a>
              </p>
            )}
          </div>
          <PixelStage />
        </section>

        <section className="lsec" aria-labelledby="features-title">
          <header className="lsec__head">
            <p className="lsec__eyebrow">FEATURES</p>
            <h2 className="lsec__title" id="features-title">
              한 장에 담기는 것들
            </h2>
          </header>
          <ul className="features">
            {FEATURES.map((f) => (
              <li className="feature" key={f.title}>
                <span className="feature__icon">
                  <PixelIcon rows={f.icon} />
                </span>
                <h3 className="feature__title">{f.title}</h3>
                <p className="feature__body">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lsec lsec--band" aria-labelledby="steps-title">
          <header className="lsec__head">
            <p className="lsec__eyebrow">HOW IT WORKS</p>
            <h2 className="lsec__title" id="steps-title">
              만드는 순서
            </h2>
          </header>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li className="step" key={s.title}>
                <span className="step__num" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3 className="step__title">{s.title}</h3>
                  <p className="step__body">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="steps__cta">
            <Link className="btn btn--primary hero__btn hero__btn--primary" to="/new">
              내 청첩장 만들기
            </Link>
          </div>
        </section>

        <section className="lsec lsec--narrow" id="manage" aria-labelledby="manage-title">
          <header className="lsec__head">
            <p className="lsec__eyebrow">MANAGE</p>
            <h2 className="lsec__title" id="manage-title">
              이미 만든 청첩장 관리
            </h2>
          </header>
          <ManageForm />
        </section>
      </main>

      <footer className="landing__foot">
        <p className="landing__foot-brand">
          <PixelIcon rows={ICON_HEART} size={2} />
          {SERVICE_NAME}
        </p>
        <p className="landing__foot-links">
          <Link to="/w/demo">데모 청첩장</Link>
          <Link to="/new">청첩장 만들기</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}
