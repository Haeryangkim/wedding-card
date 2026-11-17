import { useState } from 'react'
import type { Appearance } from '../types'
import type { Dir } from '../character'
import { PART_DEFS, randomAppearance } from '../character'
import { CharacterPreview } from './CharacterPreview'
import './CharacterCreator.css'

export interface CharacterCreatorProps {
  value: Appearance
  onChange: (next: Appearance) => void
}

const DIR_CYCLE: Dir[] = ['down', 'right', 'up', 'left']

/** 파츠별 선택 UI + 큰 미리보기 + 랜덤 버튼. 바텀시트(약 360~430px) 안에서 동작. */
export function CharacterCreator({ value, onChange }: CharacterCreatorProps) {
  const [dir, setDir] = useState<Dir>('down')

  const rotate = () => setDir((d) => DIR_CYCLE[(DIR_CYCLE.indexOf(d) + 1) % DIR_CYCLE.length])
  const pick = (key: keyof Appearance, i: number) => onChange({ ...value, [key]: i })
  const random = () => onChange(randomAppearance())

  return (
    <div className="cc">
      <div className="cc-stage">
        <button
          type="button"
          className="cc-stage-btn"
          onClick={rotate}
          aria-label="캐릭터 방향 돌리기"
        >
          <span className="cc-shadow" aria-hidden="true" />
          <CharacterPreview kind={value} dir={dir} scale={5} animate />
        </button>
        <div className="cc-stage-row">
          <span className="cc-hint">탭하면 방향이 바뀌어요</span>
          <button type="button" className="cc-random" onClick={random}>
            랜덤
          </button>
        </div>
      </div>

      <div className="cc-parts">
        {PART_DEFS.map((part) => (
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
                    <CharacterPreview kind={{ ...value, [part.key]: i }} dir="down" scale={3} />
                    <span className="cc-thumb-label">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
