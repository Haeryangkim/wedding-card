import type { CSSProperties } from 'react'
import { STYLE_IDS, STYLE_META, type StyleId } from '../styles/registry'
import { setSceneStyle } from '../sceneStyle'
import './StyleSwitch.css'

export interface StyleSwitchProps {
  value: StyleId
  className?: string
}

/** 한 줄에 놓는 칸 수의 상한 — 390px 폭 휴대폰에서 가장 긴 이름도 잘리지 않는 값 */
const MAX_PER_ROW = 4

/** 칸 수: 줄 수를 먼저 정하고 그 줄들에 고르게 나눈다 (4개 → 4, 6개 → 3+3, 8개 → 4+4) */
function switchColumns(count: number): number {
  const rows = Math.max(1, Math.ceil(count / MAX_PER_ROW))
  return Math.max(1, Math.ceil(count / rows))
}

/** 데모 전용: 맵 전체의 캐릭터 그림체를 바꾸는 스위치. 그림체가 많으면 여러 줄로 접힌다 */
export function StyleSwitch({ value, className }: StyleSwitchProps) {
  const cols = switchColumns(STYLE_IDS.length)
  const rows = Math.ceil(STYLE_IDS.length / cols)
  return (
    <div
      className={`style-switch${rows > 1 ? ' style-switch--rows' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--style-switch-cols': cols } as CSSProperties}
      role="radiogroup"
      aria-label="캐릭터 그림체"
    >
      {STYLE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={id === value}
          className={`style-switch__btn${id === value ? ' is-selected' : ''}`}
          onClick={() => setSceneStyle(id)}
        >
          {STYLE_META[id].label}
        </button>
      ))}
    </div>
  )
}
