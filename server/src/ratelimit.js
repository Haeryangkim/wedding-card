/**
 * IP별 슬라이딩 윈도 쓰기 제한 (메모리 기반). POST/DELETE 에만 적용.
 */
export class RateLimiter {
  /** @param {{ windowMs: number, max: number }} opts */
  constructor(opts) {
    this.windowMs = opts.windowMs
    this.max = opts.max
    /** @type {Map<string, number[]>} key=IP, value=타임스탬프 목록 */
    this.hits = new Map()
    // 오래된 항목 주기적 정리
    this.timer = setInterval(() => this.sweep(), this.windowMs)
    if (typeof this.timer.unref === 'function') this.timer.unref()
  }

  /**
   * 요청을 기록하고 허용 여부를 돌려준다.
   * @param {string} key
   * @returns {boolean} 허용이면 true, 초과면 false
   */
  take(key) {
    const now = Date.now()
    const cutoff = now - this.windowMs
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff)
    if (list.length >= this.max) {
      this.hits.set(key, list)
      return false
    }
    list.push(now)
    this.hits.set(key, list)
    return true
  }

  sweep() {
    const cutoff = Date.now() - this.windowMs
    for (const [key, list] of this.hits) {
      const kept = list.filter((t) => t > cutoff)
      if (kept.length === 0) this.hits.delete(key)
      else this.hits.set(key, kept)
    }
  }

  stop() {
    clearInterval(this.timer)
  }
}
