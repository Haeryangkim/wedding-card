import { useEffect, useRef, useState } from 'react'
import type { Appearance, PartKey } from '../types'
import {
  randomAppearanceFor,
  retryStyle,
  styleOf,
  STYLE_IDS,
  STYLE_META,
  styleStatus,
  trimSpriteCaches,
  type Dir,
  type StyleId,
} from '../styles/registry'
import { useStyle } from '../styles/useStyle'
import { CharacterPreview } from './CharacterPreview'
import './CharacterCreator.css'

/** 그림체별로 마지막에 만들던 외형 — 그림체를 오가도 작업이 사라지지 않게 기억한다 */
export type StyleMemory = Partial<Record<StyleId, Appearance>>

export interface CharacterCreatorProps {
  /** 현재 외형 (그림체 포함 — style 이 없으면 기본 픽셀) */
  value: Appearance
  onChange: (next: Appearance) => void
  /**
   * 그림체별 기억 저장소. 넘기면 만들기 화면이 닫혔다 열려도(단계 이동 등) 이어진다.
   * 생략하면 이 컴포넌트가 떠 있는 동안만 기억한다.
   */
  memory?: { current: StyleMemory }
}

const DIR_CYCLE: Dir[] = ['down', 'right', 'up', 'left']
/** 머리 모양·액세서리 썸네일은 상반신만 크게 (의상은 전신) */
const BUST_ROWS = 21

/** 그림체 선택 + 파츠별 선택 UI + 큰 미리보기 + 랜덤 버튼. 바텀시트(약 360~430px) 안에서 동작. */
export function CharacterCreator({ value, onChange, memory }: CharacterCreatorProps) {
  const [dir, setDir] = useState<Dir>('down')
  const ownMemory = useRef<StyleMemory>({})
  const mem = memory ?? ownMemory
  const styleId = styleOf(value)
  const style = useStyle(styleId)
  const failed = !style && styleStatus(styleId) === 'failed'

  // 썸네일 수십 장이 외형을 바꿀 때마다 새로 구워져 캐시에 쌓인다 — 화면을 닫을 때 비운다 (장면은 다음 프레임에 필요한 것만 다시 굽는다)
  useEffect(() => trimSpriteCaches, [])

  // 고르지 않은 그림체의 카드에도 "고르면 이 캐릭터가 된다" 는 견본을 보여 준다:
  // 그 그림체로 만들던 캐릭터가 있으면 그것, 없으면 이 화면이 뜰 때 한 번 정한 랜덤 캐릭터
  const [fresh] = useState<Record<StyleId, Appearance>>(() => ({
    pixel: randomAppearanceFor('pixel'),
    maple: randomAppearanceFor('maple'),
    forest: randomAppearanceFor('forest'),
  }))
  const sampleOf = (id: StyleId): Appearance => (id === styleId ? value : (mem.current[id] ?? fresh[id]))

  const rotate = () => setDir((d) => DIR_CYCLE[(DIR_CYCLE.indexOf(d) + 1) % DIR_CYCLE.length])
  const emit = (next: Appearance) => {
    mem.current[styleOf(next)] = next
    onChange(next)
  }
  const pick = (key: PartKey, i: number) => emit({ ...value, [key]: i })
  const random = () => emit(randomAppearanceFor(styleId))
  const switchStyle = (id: StyleId) => {
    if (id === styleId) return
    mem.current[styleId] = value
    emit(sampleOf(id))
  }

  return (
    <div className="cc">
      <div className="cc-styles" role="radiogroup" aria-label="그림체">
        {STYLE_IDS.map((id) => {
          const meta = STYLE_META[id]
          const selected = id === styleId
          return (
            <button
              type="button"
              key={id}
              role="radio"
              aria-checked={selected}
              className={`cc-style${selected ? ' is-selected' : ''}`}
              onClick={() => switchStyle(id)}
            >
              <span className="cc-style-sample" aria-hidden="true">
                <CharacterPreview kind={sampleOf(id)} dir="down" scale={2.4} />
              </span>
              <span className="cc-style-label">{meta.label}</span>
              <span className="cc-style-desc">{meta.description}</span>
            </button>
          )
        })}
      </div>

      <div className="cc-stage">
        <button
          type="button"
          className="cc-stage-btn"
          onClick={rotate}
          aria-label="캐릭터 방향 돌리기"
        >
          {STYLE_META[styleId].shadowR > 0 && <span className="cc-shadow" aria-hidden="true" />}
          <CharacterPreview kind={value} dir={dir} scale={4} animate />
        </button>
        <div className="cc-stage-row">
          <span className="cc-hint">탭하면 방향이 바뀌어요</span>
          <button type="button" className="cc-random" onClick={random}>
            랜덤
          </button>
        </div>
      </div>

      {failed ? (
        <div className="cc-loading cc-failed" role="alert">
          <p>{STYLE_META[styleId].label} 그림체를 불러오지 못했어요.</p>
          <p className="cc-failed-hint">연결을 확인하고 다시 시도하거나, 다른 그림체를 골라 주세요.</p>
          <button type="button" className="cc-retry" onClick={() => retryStyle(styleId)}>
            다시 시도
          </button>
        </div>
      ) : !style ? (
        <p className="cc-loading" role="status">
          {STYLE_META[styleId].label} 그림체를 불러오는 중…
        </p>
      ) : (
        <div className="cc-parts">
          {style.partDefs.map((part) => (
            <div className="cc-row" key={part.key}>
              <div className="cc-row-label">{part.label}</div>
              <div className="cc-options" role="group" aria-label={part.label}>
                {part.options.map((opt, i) => {
                  const selected = value[part.key] === i
                  if (opt.swatch) {
                    return (
                      <button
                        type="button"
                        key={i}
                        className={`cc-chip${selected ? ' is-selected' : ''}`}
                        aria-pressed={selected}
                        aria-label={opt.label}
                        title={opt.label}
                        onClick={() => pick(part.key, i)}
                      >
                        <span className="cc-chip-color" style={{ background: opt.swatch }} />
                      </button>
                    )
                  }
                  return (
                    <button
                      type="button"
                      key={i}
                      className={`cc-thumb${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      aria-label={opt.label}
                      title={opt.label}
                      onClick={() => pick(part.key, i)}
                    >
                      {part.key === 'outfit' ? (
                        <CharacterPreview kind={{ ...value, [part.key]: i }} dir="down" scale={2} />
                      ) : (
                        <CharacterPreview
                          kind={{ ...value, [part.key]: i }}
                          dir="down"
                          scale={3}
                          rows={BUST_ROWS}
                        />
                      )}
                      <span className="cc-thumb-label">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
