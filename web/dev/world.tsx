/**
 * WorldCanvas 개발용 하네스 (dev 전용, 빌드/배포에 포함되지 않음).
 * ?n=0 | 12 | 150 으로 가짜 하객 수를 바꿔 장면을 확인한다.
 */
import { StrictMode, useCallback, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { WorldCanvas } from '../src/guestbook/ui/WorldCanvas'
import type { Appearance, GuestEntry, Side } from '../src/guestbook/types'
import { hashString, mulberry32 } from '../src/guestbook/world/rng'
import '../src/styles/tokens.css'
import '../src/styles/fonts.css'

const NAMES = [
  '김민준', '이서연', '박도윤', '최지우', '정하준', '강서윤', '조은우', '윤지호',
  '임하은', '한유준', '오예준', '서지안', '신아린', '권시우', '황나윤', '안주원',
  '송채원', '류건우', '전소율', '홍태민', '문서아', '양지율', '백현우', '남다은',
]
const MESSAGES = [
  '두 사람 결혼 진심으로 축하해!',
  '오래오래 행복하게 잘 살아 🎉',
  '평생 서로 아껴주며 사랑하길 바라요.',
  '결혼 축하해요! 꽃길만 걸어요.',
  '멋진 부부가 될 거예요. 축복합니다!',
  '행복 가득한 신혼 보내세요~',
  '늘 지금처럼 다정하게 지내요.',
  '좋은 날 함께해서 기뻐요. 축하해!',
  '서로의 든든한 버팀목이 되어주길.',
  '사랑으로 가득한 가정 이루세요 💐',
  '결혼 축하드려요! 건강하고 행복하게.',
  '두 분의 앞날을 응원합니다.',
]

function makeAppearance(r: () => number): Appearance {
  const pick = (n: number) => Math.floor(r() * n)
  return {
    skin: pick(4),
    hairStyle: pick(6),
    hairColor: pick(5),
    outfit: pick(5),
    outfitColor: pick(6),
    accessory: pick(4),
  }
}

function makeEntry(id: string, i: number): GuestEntry {
  const r = mulberry32(hashString(id) ^ (i + 1))
  const name = NAMES[Math.floor(r() * NAMES.length)]
  const message = MESSAGES[Math.floor(r() * MESSAGES.length)]
  const side: Side = r() < 0.5 ? 'groom' : 'bride'
  return {
    id,
    name,
    message,
    side,
    appearance: makeAppearance(r),
    createdAt: 1_700_000_000_000 + i * 1000,
  }
}

function generate(n: number): GuestEntry[] {
  const out: GuestEntry[] = []
  for (let i = 0; i < n; i++) out.push(makeEntry(`g${i}`, i))
  return out
}

function App() {
  const initialN = useMemo(() => {
    const q = Number(new URLSearchParams(location.search).get('n'))
    return Number.isFinite(q) && q >= 0 ? q : 12
  }, [])
  const [entries, setEntries] = useState<GuestEntry[]>(() => generate(initialN))
  const [focusId, setFocusId] = useState<string | null>(null)
  const [selected, setSelected] = useState<GuestEntry | null>(null)
  const [counter, setCounter] = useState(0)

  const reset = useCallback((n: number) => {
    setEntries(generate(n))
    setFocusId(null)
    setSelected(null)
  }, [])

  const addOne = useCallback(() => {
    const id = `live-${counter}`
    setCounter((c) => c + 1)
    setEntries((es) => {
      const e = makeEntry(id, 900 + es.length)
      setTimeout(() => setFocusId(id), 50)
      return [...es, e]
    })
  }, [counter])

  const removeOne = useCallback(() => {
    setEntries((es) => es.slice(0, Math.max(0, es.length - 1)))
  }, [])

  const focusRandom = useCallback(() => {
    setEntries((es) => {
      if (es.length) setFocusId(es[Math.floor(Math.random() * es.length)].id)
      return es
    })
  }, [])

  return (
    <div className="harness">
      <header className="bar">
        <strong>WorldCanvas</strong>
        <span className="count">{entries.length}명</span>
        <button onClick={() => reset(0)}>0</button>
        <button onClick={() => reset(12)}>12</button>
        <button onClick={() => reset(150)}>150</button>
        <button onClick={addOne}>+1</button>
        <button onClick={removeOne}>-1</button>
        <button onClick={focusRandom}>focus</button>
      </header>
      <div className="stage">
        <WorldCanvas entries={entries} focusId={focusId} onSelect={setSelected} />
      </div>
      <p className="sel">
        {selected ? `선택: ${selected.name} — ${selected.message}` : '캐릭터를 탭하면 여기 표시 / 빈 바닥 탭 시 하트'}
      </p>
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
