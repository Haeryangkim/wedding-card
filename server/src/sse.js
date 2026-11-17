/**
 * SSE 브로커. GET /api/events 로 접속한 클라이언트에 added/removed 이벤트와
 * 주기적 하트비트 주석(:)을 보낸다.
 */

const HEARTBEAT_MS = 25_000

export class Broker {
  constructor() {
    /** @type {Set<import('node:http').ServerResponse>} */
    this.clients = new Set()
    this.timer = setInterval(() => this.heartbeat(), HEARTBEAT_MS)
    // 하트비트 타이머가 프로세스 종료를 막지 않도록
    if (typeof this.timer.unref === 'function') this.timer.unref()
  }

  /**
   * 새 SSE 클라이언트를 등록한다. (헤더는 호출 측에서 이미 기록)
   * @param {import('node:http').ServerResponse} res
   */
  add(res) {
    this.clients.add(res)
    // 초기 재접속 간격 안내 + 주석 한 줄로 스트림을 연다.
    res.write('retry: 3000\n')
    res.write(': connected\n\n')
    const drop = () => this.clients.delete(res)
    res.on('close', drop)
    res.on('error', drop)
  }

  /**
   * @param {string} event
   * @param {unknown} data
   */
  broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const res of this.clients) {
      try {
        res.write(payload)
      } catch {
        this.clients.delete(res)
      }
    }
  }

  heartbeat() {
    for (const res of this.clients) {
      try {
        res.write(': ping\n\n')
      } catch {
        this.clients.delete(res)
      }
    }
  }

  get size() {
    return this.clients.size
  }

  /** 모든 클라이언트 연결을 닫는다 (graceful shutdown). */
  closeAll() {
    clearInterval(this.timer)
    for (const res of this.clients) {
      try {
        res.end()
      } catch {
        /* 무시 */
      }
    }
    this.clients.clear()
  }
}
