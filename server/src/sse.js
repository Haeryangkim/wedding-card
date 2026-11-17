/**
 * SSE 브로커. GET /api/weddings/:slug/events 로 접속한 클라이언트에 그 청첩장의
 * added/removed 이벤트와 주기적 하트비트 주석(:)을 보낸다. 채널은 slug 별로 분리된다.
 */

const HEARTBEAT_MS = 25_000

export class Broker {
  constructor() {
    /** @type {Map<string, Set<import('node:http').ServerResponse>>} slug → 클라이언트 */
    this.channels = new Map()
    this.count = 0
    this.timer = setInterval(() => this.heartbeat(), HEARTBEAT_MS)
    // 하트비트 타이머가 프로세스 종료를 막지 않도록
    if (typeof this.timer.unref === 'function') this.timer.unref()
  }

  /**
   * 새 SSE 클라이언트를 등록한다. (헤더는 호출 측에서 이미 기록)
   * @param {string} channel 청첩장 slug
   * @param {import('node:http').ServerResponse} res
   */
  add(channel, res) {
    let set = this.channels.get(channel)
    if (!set) {
      set = new Set()
      this.channels.set(channel, set)
    }
    set.add(res)
    this.count++
    // 초기 재접속 간격 안내 + 주석 한 줄로 스트림을 연다.
    res.write('retry: 3000\n')
    res.write(': connected\n\n')
    const drop = () => this.drop(channel, res)
    res.on('close', drop)
    res.on('error', drop)
  }

  /** @param {string} channel @param {import('node:http').ServerResponse} res */
  drop(channel, res) {
    const set = this.channels.get(channel)
    if (!set || !set.delete(res)) return
    this.count--
    if (set.size === 0) this.channels.delete(channel)
  }

  /**
   * @param {string} channel
   * @param {string} event
   * @param {unknown} data
   */
  broadcast(channel, event, data) {
    const set = this.channels.get(channel)
    if (!set) return
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const res of [...set]) {
      try {
        res.write(payload)
      } catch {
        this.drop(channel, res)
      }
    }
  }

  heartbeat() {
    for (const [channel, set] of this.channels) {
      for (const res of [...set]) {
        try {
          res.write(': ping\n\n')
        } catch {
          this.drop(channel, res)
        }
      }
    }
  }

  /** 전체 연결 수 */
  get size() {
    return this.count
  }

  /** 한 청첩장의 연결을 모두 닫는다 (청첩장 삭제 시). @param {string} channel */
  closeChannel(channel) {
    const set = this.channels.get(channel)
    if (!set) return
    for (const res of [...set]) {
      try {
        res.end()
      } catch {
        /* 무시 */
      }
      this.drop(channel, res)
    }
  }

  /** 모든 클라이언트 연결을 닫는다 (graceful shutdown). */
  closeAll() {
    clearInterval(this.timer)
    for (const channel of [...this.channels.keys()]) this.closeChannel(channel)
  }
}
