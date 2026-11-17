import { useEffect, useSyncExternalStore } from 'react'
import { autoLoadStyle, getStyle, onStyleLoaded, stylesVersion, type CharacterStyle, type StyleId } from './registry'

/** 스타일 상태가 바뀔 때마다(준비·실패·재시도) 다시 렌더한다 (어떤 스타일이든). 현재 상태 번호를 돌려준다 */
export function useStylesVersion(): number {
  return useSyncExternalStore(onStyleLoaded, stylesVersion, stylesVersion)
}

/** 스타일 하나를 쓴다: 아직 없으면 불러오기 시작하고 null 을 돌려주며, 준비되면 다시 렌더된다 */
export function useStyle(id: StyleId): CharacterStyle | null {
  const version = useStylesVersion()
  const style = getStyle(id)
  // version: 실패 뒤 재시도 시점이 되면(또는 온라인 복귀) 다시 시도한다. 간격 제한은 registry 가 지킨다
  useEffect(() => {
    if (!style) autoLoadStyle(id)
  }, [id, style, version])
  return style
}
