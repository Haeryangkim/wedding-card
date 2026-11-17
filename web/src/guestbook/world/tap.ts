/**
 * 캔버스 탭 판별기. pointerdown/pointerup 으로는 "탭이었는지"만 기록하고,
 * 실제 동작은 뒤따르는 click 에서 consume() 으로 꺼내 실행한다.
 *
 * pointerup 에서 바로 동작하면(카드·팝업을 띄우면) 터치 기기에서는 그 뒤에 합성되는 click 이
 * 방금 뜬 오버레이의 버튼에 떨어진다. click 은 손가락을 뗀 시점의 대상(캔버스)에 먼저 전달되므로
 * 거기서 동작하면 새 오버레이로 새지 않는다.
 */
export const TAP_MAX_MOVE = 10
export const TAP_MAX_MS = 600

export interface TapPoint {
  x: number
  y: number
}

export class TapTracker {
  private tracking = false
  private downX = 0
  private downY = 0
  private downT = 0
  private pending: TapPoint | null = null

  down(x: number, y: number, t: number): void {
    this.tracking = true
    this.pending = null
    this.downX = x
    this.downY = y
    this.downT = t
  }

  /** 스크롤(이동)·롱프레스가 아니면 탭으로 기록한다 */
  up(x: number, y: number, t: number): void {
    if (!this.tracking) return
    this.tracking = false
    const moved = Math.hypot(x - this.downX, y - this.downY)
    this.pending = moved > TAP_MAX_MOVE || t - this.downT > TAP_MAX_MS ? null : { x, y }
  }

  cancel(): void {
    this.tracking = false
    this.pending = null
  }

  /** click 에서 호출: 기록된 탭이 있으면 그 좌표를 한 번만 돌려준다 */
  consume(): TapPoint | null {
    const p = this.pending
    this.pending = null
    return p
  }
}
