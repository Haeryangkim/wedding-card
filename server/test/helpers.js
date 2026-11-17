/**
 * 테스트 공용 헬퍼: 임의 포트 + 임시 DB 로 서버를 띄우고, 간단한 SSE 클라이언트를 제공한다.
 */
import { createApp } from '../src/app.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * @param {Record<string, any>} [overrides]
 */
export async function start(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gb-test-'))
  const dbPath = join(dir, 'test.db')
  const app = createApp({
    dbPath,
    logger: () => {},
    // 기본은 사실상 무제한 → 레이트리밋은 전용 테스트에서만 켠다.
    rateLimit: { windowMs: 10 * 60 * 1000, max: 100000 },
    ...overrides,
  })
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', () => resolve(undefined)))
  const address = app.server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const base = `http://127.0.0.1:${port}`

  async function stop() {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  }

  return { base, port, stop, app }
}

/** @param {Record<string, any>} [overrides] */
export function validGuest(overrides = {}) {
  return {
    name: '김하객',
    message: '두 분의 결혼을 진심으로 축하합니다!',
    side: 'groom',
    appearance: { skin: 1, hairStyle: 2, hairColor: 3, outfit: 0, outfitColor: 4, accessory: 0 },
    password: 'pass1234',
    ...overrides,
  }
}

/** @param {string} base @param {Record<string, any>} body @param {Record<string,string>} [headers] */
export function postGuest(base, body, headers = {}) {
  return fetch(`${base}/api/guests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

/**
 * SSE 에 접속해 added/removed 이벤트를 수집한다. fetch 스트림을 직접 읽는다.
 * @param {string} base
 */
export async function connectSse(base) {
  const ctrl = new AbortController()
  const res = await fetch(`${base}/api/events`, { signal: ctrl.signal })
  const reader = /** @type {ReadableStreamDefaultReader<Uint8Array>} */ (res.body.getReader())
  const decoder = new TextDecoder()
  let buf = ''
  /** @type {{event: string, data: string}[]} */
  const queue = []
  /** @type {((ev: {event: string, data: string}) => void)[]} */
  const resolvers = []

  /** @param {string} raw */
  function parse(raw) {
    let event = 'message'
    /** @type {string[]} */
    const data = []
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    if (data.length === 0 && event === 'message') return null // 주석/retry
    return { event, data: data.join('\n') }
  }

  ;(async function pump() {
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const raw = buf.slice(0, i)
          buf = buf.slice(i + 2)
          const ev = parse(raw)
          if (ev) {
            const r = resolvers.shift()
            if (r) r(ev)
            else queue.push(ev)
          }
        }
      }
    } catch {
      /* abort 시 정상 종료 */
    }
  })()

  /** @param {number} [timeout] */
  function next(timeout = 2000) {
    if (queue.length) return Promise.resolve(queue.shift())
    return Promise.race([
      new Promise((resolve) => resolvers.push(resolve)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SSE timeout')), timeout)),
    ])
  }

  /** @param {string} eventName @param {number} [timeout] */
  async function waitFor(eventName, timeout = 3000) {
    const deadline = Date.now() + timeout
    for (;;) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new Error(`SSE wait timeout: ${eventName}`)
      const ev = await next(remaining)
      if (ev && ev.event === eventName) return ev
    }
  }

  return { waitFor, close: () => ctrl.abort(), response: res }
}
