/**
 * 테스트 공용 헬퍼: 임의 포트 + 임시 DB/업로드 폴더 + 가짜 index.html 로 서버를 띄우고,
 * 청첩장 생성·간단한 SSE 클라이언트·가짜 장소 검색 업스트림을 제공한다. 실제 네트워크는 쓰지 않는다.
 */
import http from 'node:http'
import { createApp } from '../src/app.js'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 빌드된 프론트 index.html 을 흉내 낸 템플릿 (범용 title/OG 태그 포함).
 * 실제 빌드처럼 "<title>" 이라는 글자가 든 주석 뒤에 script/stylesheet 가 오고 그 뒤에 진짜 <title> 이 온다.
 */
export const INDEX_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <!-- <title> · description · og:* 태그는 vite.config.ts 가 빌드 시 주입합니다 -->
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-abc.css">
    <title>모바일 청첩장 만들기</title>
    <meta name="description" content="누구나 만드는 모바일 청첩장">
    <meta property="og:type" content="website">
    <meta property="og:title" content="모바일 청첩장 만들기">
    <meta property="og:description" content="누구나 만드는 모바일 청첩장">
    <meta property="og:image" content="https://generic.example/og.png">
    <meta name="twitter:card" content="summary_large_image">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

/**
 * @param {Record<string, any>} [overrides]
 */
export async function start(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wd-test-'))
  const dbPath = join(dir, 'test.db')
  const indexHtmlPath = join(dir, 'index.html')
  writeFileSync(indexHtmlPath, INDEX_HTML)
  const app = createApp({
    dbPath,
    uploadDir: join(dir, 'uploads'),
    indexHtmlPath,
    logger: () => {},
    // 환경변수에 좌우되지 않게 고정한다.
    adminToken: null,
    tokenSecret: null,
    publicOrigin: null,
    corsOrigin: null,
    trustProxy: false,
    // 기본은 사실상 무제한 → 레이트리밋은 전용 테스트에서만 켠다.
    rateLimit: { windowMs: 10 * 60 * 1000, max: 100000 },
    createRateLimit: { windowMs: 60 * 60 * 1000, max: 100000 },
    photoRateLimit: { windowMs: 10 * 60 * 1000, max: 100000 },
    geocodeRateLimit: { windowMs: 60 * 1000, max: 100000 },
    // 실제 Nominatim 을 절대 부르지 않도록 닫힌 로컬 포트를 기본값으로 둔다.
    geocodeUrl: 'http://127.0.0.1:9/search',
    geocodeMinIntervalMs: 0,
    geocodeTimeoutMs: 1000,
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

  return { base, port, stop, app, dir }
}

/** @param {Record<string, any>} [overrides] web/src/config/wedding.ts 의 예시와 같은 내용 */
export function validConfig(overrides = {}) {
  return {
    groom: {
      name: '김신랑',
      firstName: '신랑',
      relation: '장남',
      father: { name: '김아버지' },
      mother: { name: '이어머니' },
      phone: '010-0000-0000',
    },
    bride: {
      name: '박신부',
      firstName: '신부',
      relation: '장녀',
      father: { name: '박아버지' },
      mother: { name: '최어머니', deceased: true },
    },
    datetime: '2027-05-15T12:30:00+09:00',
    durationMinutes: 90,
    venue: {
      name: '예시웨딩홀',
      hall: '3층 그랜드홀',
      address: '서울특별시 중구 세종대로 110',
      tel: '02-000-0000',
      lat: 37.5662952,
      lng: 126.9779451,
      transport: [
        { title: '지하철', lines: ['1·2호선 시청역 5번 출구 도보 3분'] },
        { title: '주차', lines: ['건물 내 지하주차장 이용 (2시간 무료)'] },
      ],
    },
    greeting: { title: '초대합니다', body: ['서로 다른 길을 걸어온 두 사람이', '', '이제 같은 길을 함께 걸어가려 합니다.'] },
    gallery: [],
    accounts: {
      groomSide: [{ role: '신랑', bank: '예시은행', number: '000-0000-0000', holder: '김신랑' }],
      brideSide: [],
    },
    share: { title: '김신랑 ♥ 박신부 결혼합니다', description: '2027년 5월 15일 토요일 오후 12시 30분 · 예시웨딩홀' },
    ...overrides,
  }
}

/** @param {string} base @param {string} path @param {string} method @param {any} [body] @param {Record<string,string>} [headers] */
export function jsonReq(base, path, method, body, headers = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** @param {string} token */
export function auth(token) {
  return { Authorization: `Bearer ${token}` }
}

export const ADMIN_PW = 'admin-pass-1'

/**
 * 청첩장을 만들고 { slug, token, expiresAt, wedding } 을 돌려준다.
 * @param {string} base @param {string} [slug] @param {{ password?: string, config?: any }} [opts]
 */
export async function createWedding(base, slug = 'our-wedding', opts = {}) {
  const res = await jsonReq(base, '/api/weddings', 'POST', {
    slug,
    password: opts.password ?? ADMIN_PW,
    config: opts.config ?? validConfig(),
  })
  if (res.status !== 201) throw new Error(`createWedding ${slug} → ${res.status} ${await res.text()}`)
  const json = await res.json()
  return { slug, token: /** @type {string} */ (json.token), expiresAt: json.expiresAt, wedding: json.wedding }
}

/** 1x1 PNG / 최소 JPEG·WebP 머리 바이트 (매직 바이트 검사용) */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
export const TINY_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0'), Buffer.alloc(32)])
export const TINY_WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8L'), Buffer.alloc(18)])

/** @param {string} base @param {string} slug @param {string} token @param {Buffer} [bytes] @param {string} [type] */
export function uploadPhoto(base, slug, token, bytes = TINY_PNG, type = 'image/png') {
  return fetch(`${base}/api/weddings/${slug}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': type, ...auth(token) },
    body: bytes,
  })
}

/**
 * Nominatim 을 흉내 낸 로컬 서버. 받은 요청을 기록하고 handler 가 정한 응답을 준다.
 * @param {(url: URL) => { status?: number, body: any }} [handler]
 */
export async function startFakeGeocode(handler) {
  /** @type {{ at: number, url: URL, headers: import('node:http').IncomingHttpHeaders }[]} */
  const calls = []
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake')
    calls.push({ at: Date.now(), url, headers: req.headers })
    const out = handler
      ? handler(url)
      : {
          body: [
            {
              lat: '37.5662952',
              lon: '126.9779451',
              name: '서울특별시청',
              display_name: '서울특별시청, 110, 세종대로, 중구, 서울특별시, 04524, 대한민국',
            },
          ],
        }
    const text = typeof out.body === 'string' ? out.body : JSON.stringify(out.body)
    res.writeHead(out.status ?? 200, { 'Content-Type': 'application/json' })
    res.end(text)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}/search`,
    calls,
    stop: () => new Promise((resolve) => server.close(() => resolve(undefined))),
  }
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

/** @param {string} base @param {string} slug @param {Record<string, any>} body @param {Record<string,string>} [headers] */
export function postGuest(base, slug, body, headers = {}) {
  return fetch(`${base}/api/weddings/${slug}/guests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

/**
 * SSE 에 접속해 added/removed 이벤트를 수집한다. fetch 스트림을 직접 읽는다.
 * @param {string} base
 * @param {string} slug
 */
export async function connectSse(base, slug) {
  const ctrl = new AbortController()
  const res = await fetch(`${base}/api/weddings/${slug}/events`, { signal: ctrl.signal })
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
