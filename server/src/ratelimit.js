/**
 * 키별 슬라이딩 윈도 제한 (메모리 기반).
 * 방명록 등록·청첩장 생성·사진 업로드·장소 검색은 IP, 삭제 비밀번호 실패는 `IP:id`,
 * 로그인 실패는 `IP:slug` 를 키로 쓴다.
 */
export class RateLimiter {
  /** @param {{ windowMs: number, max: number }} opts */
  constructor(opts) {
    this.windowMs = opts.windowMs
    this.max = opts.max
    /** @type {Map<string, number[]>} key=IP, value=타임스탬프 목록 */
    this.hits = new Map()
    /** @type {Map<string, number>} begin() 으로 잡았지만 아직 end() 하지 않은(결과를 기다리는) 시도 수 */
    this.inflight = new Map()
    // 오래된 항목 주기적 정리
    this.timer = setInterval(() => this.sweep(), this.windowMs)
    if (typeof this.timer.unref === 'function') this.timer.unref()
  }

  /**
   * 기록하지 않고 이미 한도에 도달했는지만 확인한다.
   * @param {string} key
   * @returns {boolean} 한도 초과 상태면 true
   */
  isLimited(key) {
    const list = this.hits.get(key)
    if (!list) return false
    const cutoff = Date.now() - this.windowMs
    let n = 0
    for (const t of list) if (t > cutoff) n++
    return n >= this.max
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

  /**
   * "실패만 세는" 한도용 예약. 기록된 실패 + 진행 중인 시도가 한도 미만일 때만 자리를 잡는다.
   * 비밀번호 해시처럼 await 가 끼는 검사 "직전에 동기적으로" 호출해야 동시에 몰려온 요청이
   * 한도를 넘겨 검사받지 못한다. 잡은 자리는 반드시 end() 로 돌려준다.
   * @param {string} key
   * @returns {boolean} 자리를 잡았으면 true, 한도 초과면 false
   */
  begin(key) {
    const cutoff = Date.now() - this.windowMs
    let n = this.inflight.get(key) ?? 0
    const list = this.hits.get(key)
    if (list) for (const t of list) if (t > cutoff) n++
    if (n >= this.max) return false
    this.inflight.set(key, (this.inflight.get(key) ?? 0) + 1)
    return true
  }

  /**
   * begin() 으로 잡은 자리를 돌려준다. 실패한 시도만 한도에 기록한다.
   * @param {string} key
   * @param {boolean} failed 틀린 시도였으면 true
   */
  end(key, failed) {
    const n = (this.inflight.get(key) ?? 0) - 1
    if (n > 0) this.inflight.set(key, n)
    else this.inflight.delete(key)
    if (!failed) return
    const now = Date.now()
    const cutoff = now - this.windowMs
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff)
    list.push(now)
    this.hits.set(key, list)
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
