/**
 * "뒤로 가기 = 열린 창 닫기". 픽셀 청첩장은 모든 내용이 팝업이라, 팝업이 열릴 때 같은 주소로
 * 히스토리 항목을 하나 쌓고(state.pxLayer = 깊이) 뒤로 가기가 그 항목을 지나가면 창을 닫는다.
 * 깊이 1 = 팝업·하객 카드, 깊이 2 = 갤러리 사진 뷰어.
 * 주소는 바뀌지 않으므로 라우터의 popstate 처리는 같은 화면을 그대로 다시 그린다.
 */
import { useEffect, useRef } from 'react'

/** history.state 에 기록된 레이어 깊이 (없으면 0) */
export function layerDepthOf(state: unknown): number {
  if (typeof state !== 'object' || state === null) return 0
  const n = (state as { pxLayer?: unknown }).pxLayer
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0
}

/** 뒤로 가기로 도착한 항목(state)이 이 깊이의 레이어보다 아래면 그 레이어를 닫아야 한다 */
export function shouldCloseOnPop(state: unknown, depth: number): boolean {
  return layerDepthOf(state) < depth
}

/** 화면에서 직접 닫았을 때(X·배경·ESC) 되돌아가야 할 히스토리 칸 수. 위에 쌓인 더 깊은 항목까지 함께 걷는다 */
export function backSteps(state: unknown, depth: number): number {
  const n = layerDepthOf(state)
  return n >= depth ? n - depth + 1 : 0
}

/**
 * open 인 동안 히스토리 항목 하나를 차지한다.
 * - 열릴 때: 항목을 쌓는다 (이미 같은 깊이의 항목 위라면 재사용)
 * - 뒤로 가기: onBack() 으로 닫는다
 * - 화면에서 닫힐 때: 쌓은 항목을 history.go 로 걷어 낸다
 * - 언마운트: 아무것도 되돌리지 않는다 (다른 화면으로 떠나는 중일 수 있다)
 *
 * @returns 떠나는 링크용: 항목이 쌓여 있으면 소유를 내려놓고 true 를 돌려준다 → replace 로 이동해야 한다
 */
export function useBackLayer(open: boolean, depth: number, onBack: () => void): () => boolean {
  const pushedRef = useRef(false)
  const openRef = useRef(open)
  const backRef = useRef(onBack)
  useEffect(() => {
    backRef.current = onBack
  })

  useEffect(() => {
    openRef.current = open
    if (open) {
      if (pushedRef.current) return
      pushedRef.current = true
      if (layerDepthOf(window.history.state) !== depth) window.history.pushState({ pxLayer: depth }, '')
    } else if (pushedRef.current) {
      pushedRef.current = false
      const steps = backSteps(window.history.state, depth)
      if (steps > 0) window.history.go(-steps)
    }
  }, [open, depth])

  useEffect(() => {
    const onPop = () => {
      const state: unknown = window.history.state
      if (pushedRef.current) {
        if (!shouldCloseOnPop(state, depth)) return
        pushedRef.current = false
        backRef.current()
        return
      }
      // 닫힌 상태에서 "앞으로"로 지난 레이어 항목에 들어왔다 → 창 없는 빈 항목이므로 바로 걷어 낸다
      if (depth === 1 && !openRef.current) {
        const n = layerDepthOf(state)
        if (n > 0) window.history.go(-n)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [depth])

  // 새로고침으로 레이어 항목 위에서 시작했다면(창은 닫혀 있다) 표시를 지운다
  useEffect(() => {
    if (depth === 1 && !openRef.current && layerDepthOf(window.history.state) > 0) {
      window.history.replaceState(null, '')
    }
  }, [depth])

  return () => {
    if (!pushedRef.current) return false
    if (layerDepthOf(window.history.state) < depth) return false
    pushedRef.current = false
    return true
  }
}
