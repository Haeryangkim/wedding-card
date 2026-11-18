import { STYLE_IDS, STYLE_META, type StyleId } from '../styles/registry'
import { setSceneStyle } from '../sceneStyle'
import './StyleSwitch.css'

export interface StyleSwitchProps {
  value: StyleId
  className?: string
}

/** 데모 전용: 맵 전체의 캐릭터 그림체를 바꾸는 세 칸짜리 스위치 */
export function StyleSwitch({ value, className }: StyleSwitchProps) {
  return (
    <div className={`style-switch${className ? ` ${className}` : ''}`} role="radiogroup" aria-label="캐릭터 그림체">
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
