// 링크 미리보기용 서버 렌더링(/w/:slug)과 캘린더(/w/:slug/wedding.ics)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {
  start,
  validConfig,
  jsonReq,
  auth,
  createWedding,
  uploadPhoto,
  INDEX_HTML,
} from './helpers.js'
import { renderPage, formatKoreanDate } from '../src/pages.js'
import { buildIcs, weddingEvent } from '../src/ics.js'

/** @param {(srv: Awaited<ReturnType<typeof start>>) => Promise<void>} fn @param {Record<string, any>} [overrides] */
async function withServer(fn, overrides) {
  const srv = await start(overrides)
  try {
    await fn(srv)
  } finally {
    await srv.stop()
  }
}

/** 주석 밖에서만 센다. @param {string} html @param {RegExp} re */
const count = (html, re) => (html.replace(/<!--[\s\S]*?-->/g, '').match(re) ?? []).length

/** @param {string} html @param {string} prop og:* 는 property, 그 외는 name */
function metaContent(html, prop) {
  const attr = prop.startsWith('og:') ? 'property' : 'name'
  const m = new RegExp(`<meta ${attr}="${prop}" content="([^"]*)">`).exec(html)
  return m ? m[1] : null
}

test('/w/:slug → index.html 에 그 청첩장의 title/OG 태그를 넣어 돌려준다 (기존 범용 태그는 교체)', () =>
  withServer(async (srv) => {
    await createWedding(srv.base, 'kim-park')
    const res = await fetch(`${srv.base}/w/kim-park`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /^text\/html; charset=utf-8/)
    assert.equal(res.headers.get('cache-control'), 'no-cache')
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    const html = await res.text()

    assert.ok(html.includes('<title>김신랑 ♥ 박신부 결혼합니다</title>'))
    assert.equal(metaContent(html, 'og:title'), '김신랑 ♥ 박신부 결혼합니다')
    assert.equal(metaContent(html, 'og:description'), '2027년 5월 15일 토요일 오후 12시 30분 · 예시웨딩홀')
    assert.equal(metaContent(html, 'description'), '2027년 5월 15일 토요일 오후 12시 30분 · 예시웨딩홀')
    assert.equal(metaContent(html, 'og:url'), `${srv.base}/w/kim-park`)
    assert.equal(metaContent(html, 'og:image'), `${srv.base}/og.png`)
    assert.equal(metaContent(html, 'og:type'), 'website')
    assert.equal(metaContent(html, 'twitter:card'), 'summary_large_image')
    assert.equal(metaContent(html, 'twitter:title'), '김신랑 ♥ 박신부 결혼합니다')
    assert.equal(metaContent(html, 'twitter:image'), `${srv.base}/og.png`)
    assert.equal(metaContent(html, 'robots'), 'noindex, nofollow')

    // 중복 없이 교체: 템플릿의 범용 태그는 사라진다
    assert.equal(count(html, /<title\b/g), 1)
    assert.equal(count(html, /property="og:title"/g), 1)
    assert.equal(count(html, /property="og:description"/g), 1)
    assert.equal(count(html, /property="og:image"/g), 1)
    assert.equal(count(html, /property="og:type"/g), 1)
    assert.equal(count(html, /name="description"/g), 1)
    assert.equal(count(html, /name="twitter:card"/g), 1)
    assert.ok(!html.includes('모바일 청첩장 만들기'))
    assert.ok(!html.includes('generic.example'))

    // SPA 셸의 나머지는 그대로
    assert.ok(html.includes('<div id="root"></div>'))
    assert.ok(html.includes('<script type="module" crossorigin src="/assets/index-abc.js"></script>'))
    assert.ok(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />'))
    assert.ok(html.indexOf('og:title') < html.indexOf('</head>'))
    assert.ok(html.trimEnd().endsWith('</html>'))

    // /edit 과 끝 슬래시도 같은 태그
    for (const path of ['/w/kim-park/edit', '/w/kim-park/', '/w/kim-park?from=kakao']) {
      const r = await fetch(`${srv.base}${path}`)
      assert.equal(r.status, 200, path)
      const h = await r.text()
      assert.equal(metaContent(h, 'og:title'), '김신랑 ♥ 박신부 결혼합니다', path)
      assert.equal(metaContent(h, 'og:url'), `${srv.base}/w/kim-park`, path)
    }
    // /pixel: 같은 청첩장의 픽셀 청첩장 — 자기 주소와 구분되는 제목·설명
    for (const path of ['/w/kim-park/pixel', '/w/kim-park/pixel/', '/w/kim-park/pixel?from=kakao']) {
      const r = await fetch(`${srv.base}${path}`)
      assert.equal(r.status, 200, path)
      const h = await r.text()
      assert.ok(h.includes('<title>김신랑 ♥ 박신부 결혼합니다 · 픽셀 청첩장</title>'), path)
      assert.equal(metaContent(h, 'og:title'), '김신랑 ♥ 박신부 결혼합니다 · 픽셀 청첩장', path)
      assert.equal(
        metaContent(h, 'og:description'),
        '캐릭터가 되어 축하를 남겨 주세요 · 2027년 5월 15일 토요일 오후 12시 30분 · 예시웨딩홀',
        path,
      )
      assert.equal(metaContent(h, 'og:url'), `${srv.base}/w/kim-park/pixel`, path)
      assert.equal(metaContent(h, 'og:image'), `${srv.base}/og.png`, path)
      assert.equal(metaContent(h, 'robots'), 'noindex, nofollow', path)
      assert.equal(count(h, /<title\b/g), 1, path)
      assert.equal(count(h, /property="og:title"/g), 1, path)
      assert.ok(h.includes('<div id="root"></div>'), path)
    }
    const head = await fetch(`${srv.base}/w/kim-park`, { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal((await fetch(`${srv.base}/w/kim-park`, { method: 'POST' })).status, 405)
  }))

test('/w/:slug: 사용자 입력은 HTML 이스케이프된다', () =>
  withServer(async (srv) => {
    const cfg = validConfig({
      share: { title: '</title><script>alert("x")</script>', description: `"quoted" & 'single' <b>` },
    })
    await createWedding(srv.base, 'kim-park', { config: cfg })
    const html = await (await fetch(`${srv.base}/w/kim-park`)).text()
    assert.ok(!html.includes('<script>alert'))
    assert.ok(!html.includes('<b>'))
    assert.ok(html.includes('<title>&lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</title>'))
    assert.equal(metaContent(html, 'og:description'), '&quot;quoted&quot; &amp; &#39;single&#39; &lt;b&gt;')
    assert.equal(count(html, /<script\b/g), 1, '템플릿의 스크립트 하나뿐')
  }))

test('/w/:slug: share 가 비어 있으면 이름·일시·장소로 기본 문구를 만든다', () =>
  withServer(async (srv) => {
    await createWedding(srv.base, 'kim-park', {
      config: validConfig({ share: { title: '', description: '' }, datetime: '2027-10-09T11:00:00+09:00' }),
    })
    const html = await (await fetch(`${srv.base}/w/kim-park`)).text()
    assert.equal(metaContent(html, 'og:title'), '김신랑 ♥ 박신부 결혼합니다')
    assert.equal(metaContent(html, 'og:description'), '2027년 10월 9일 토요일 오전 11시 · 예시웨딩홀')
    assert.equal(formatKoreanDate('2027-05-15T12:30:00+09:00'), '2027년 5월 15일 토요일 오후 12시 30분')
    assert.equal(formatKoreanDate('2027-05-16T00:05:00+09:00'), '2027년 5월 16일 일요일 오전 12시 5분')
  }))

test('/w/:slug: 표지 사진이 있으면 og:image 는 그 사진의 절대 URL', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    const { url } = await (await uploadPhoto(srv.base, 'kim-park', token)).json()
    const put = await jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: validConfig({ coverImage: url }) }, auth(token))
    assert.equal(put.status, 200)
    const html = await (await fetch(`${srv.base}/w/kim-park`)).text()
    assert.equal(metaContent(html, 'og:image'), `${srv.base}${url}`)
    assert.equal(metaContent(html, 'twitter:image'), `${srv.base}${url}`)
    assert.ok(!html.includes('og:image:width'), '사진 크기는 모르므로 넣지 않는다')
    assert.equal((await fetch(/** @type {string} */ (metaContent(html, 'og:image')))).status, 200)
  }))

test('/w/:slug: 절대 URL 의 오리진 — PUBLIC_ORIGIN 우선, 없으면 (신뢰할 때만) X-Forwarded-*', async () => {
  const fixed = await start({ publicOrigin: 'https://our.wedding', trustProxy: true })
  const proxied = await start({ trustProxy: true })
  const direct = await start({ trustProxy: false })
  const fwd = { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'invite.example.kr' }
  try {
    for (const s of [fixed, proxied, direct]) await createWedding(s.base, 'kim-park')
    const og = async (/** @type {string} */ base, /** @type {Record<string,string>} */ headers) => {
      const html = await (await fetch(`${base}/w/kim-park`, { headers })).text()
      return [metaContent(html, 'og:url'), metaContent(html, 'og:image')]
    }
    assert.deepEqual(await og(fixed.base, fwd), ['https://our.wedding/w/kim-park', 'https://our.wedding/og.png'])
    assert.deepEqual(await og(proxied.base, fwd), ['https://invite.example.kr/w/kim-park', 'https://invite.example.kr/og.png'])
    // X-Forwarded-Proto 만 있으면 Host 헤더와 조합
    assert.deepEqual(await og(proxied.base, { 'X-Forwarded-Proto': 'https' }), [
      `https://127.0.0.1:${proxied.port}/w/kim-park`,
      `https://127.0.0.1:${proxied.port}/og.png`,
    ])
    // 프록시를 신뢰하지 않으면 클라이언트가 보낸 X-Forwarded-* 는 무시
    assert.deepEqual(await og(direct.base, fwd), [`${direct.base}/w/kim-park`, `${direct.base}/og.png`])
    // 이상한 호스트 값은 버린다 (태그 주입 방지)
    const html = await (await fetch(`${proxied.base}/w/kim-park`, { headers: { 'X-Forwarded-Host': 'evil.example"><script>' } })).text()
    assert.ok(!html.includes('evil.example'))
    assert.equal(metaContent(html, 'og:url'), '/w/kim-park')

    // 캘린더의 링크도 같은 오리진
    const ics = await (await fetch(`${fixed.base}/w/kim-park/wedding.ics`)).text()
    assert.ok(ics.replace(/\r\n /g, '').includes('URL:https://our.wedding/w/kim-park'))
  } finally {
    await fixed.stop()
    await proxied.stop()
    await direct.stop()
  }
})

test('/w/:slug: 없는 청첩장은 SPA 셸(범용 태그) + 404, 데모는 200', () =>
  withServer(async (srv) => {
    await createWedding(srv.base, 'kim-park')
    for (const path of ['/w/nobody-here', '/w/nobody-here/edit', '/w/nobody-here/pixel', '/w/Bad_Slug!', '/w/kim-park/unknown', '/w/kim-park/pixel/extra', '/w/', '/w', '/w/%zz']) {
      const res = await fetch(`${srv.base}${path}`)
      assert.equal(res.status, 404, path)
      assert.match(res.headers.get('content-type') ?? '', /^text\/html/, path)
      const html = await res.text()
      assert.ok(html.includes('<title>모바일 청첩장 만들기</title>'), path)
      assert.ok(html.includes('<div id="root"></div>'), path)
      assert.equal(count(html, /<title\b/g), 1, path)
      assert.ok(!html.includes('김신랑'), path)
    }
    for (const path of ['/w/demo', '/w/demo/edit', '/w/demo/pixel']) {
      const res = await fetch(`${srv.base}${path}`)
      assert.equal(res.status, 200, path)
      assert.equal(await res.text(), INDEX_HTML, path)
    }
  }))

test('/w/:slug/wedding.ics → text/calendar (프론트와 같은 규칙의 RFC 5545)', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    const res = await fetch(`${srv.base}/w/kim-park/wedding.ics`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /^text\/calendar/)
    assert.match(res.headers.get('content-disposition') ?? '', /wedding\.ics/)
    const ics = await res.text()
    assert.equal(ics, buildIcs(weddingEvent(validConfig(), `${srv.base}/w/kim-park`)))
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
    assert.ok(ics.includes('DTSTART:20270515T033000Z'))
    assert.ok(ics.includes('DTEND:20270515T050000Z'))
    assert.ok(ics.includes('SUMMARY:김신랑 ♥ 박신부 결혼식'))
    assert.ok(ics.includes('TRIGGER:-P1D'))
    for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75)

    // 내용을 고치면 캘린더도 바뀐다
    await jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: validConfig({ datetime: '2027-06-01T17:00:00+09:00', durationMinutes: 60 }) }, auth(token))
    const updated = await (await fetch(`${srv.base}/w/kim-park/wedding.ics`)).text()
    assert.ok(updated.includes('DTSTART:20270601T080000Z'))
    assert.ok(updated.includes('DTEND:20270601T090000Z'))

    assert.equal((await fetch(`${srv.base}/w/nobody-here/wedding.ics`)).status, 404)
    assert.equal((await fetch(`${srv.base}/w/demo/wedding.ics`)).status, 404)
  }))

test('템플릿을 INDEX_HTML_URL 에서 늦게 가져와 캐시하고, 실패하면 예전 사본을 쓴다', async () => {
  let hits = 0
  let healthy = false
  const web = http.createServer((req, res) => {
    hits++
    if (!healthy) {
      res.writeHead(502)
      return res.end('bad gateway')
    }
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(INDEX_HTML.replace('index-abc.js', `index-v${hits}.js`))
  })
  await new Promise((resolve) => web.listen(0, '127.0.0.1', () => resolve(undefined)))
  const address = web.address()
  const webPort = typeof address === 'object' && address ? address.port : 0
  const srv = await start({ indexHtmlPath: null, indexHtmlUrl: `http://127.0.0.1:${webPort}/index.html`, indexHtmlTtlMs: 600 })
  try {
    // 서버가 뜰 때는 web 이 필요 없다(가져오지 않는다)
    await createWedding(srv.base, 'kim-park')
    assert.equal(hits, 0)

    // 한 번도 가져오지 못했으면 503
    const down = await fetch(`${srv.base}/w/kim-park`)
    assert.equal(down.status, 503)
    assert.ok(down.headers.get('retry-after'))
    await down.text()

    healthy = true
    const first = await (await fetch(`${srv.base}/w/kim-park`)).text()
    assert.ok(first.includes('<title>김신랑 ♥ 박신부 결혼합니다</title>'))
    const version = /index-v(\d+)\.js/.exec(first)?.[1]
    assert.ok(version)
    const hitsAfterFirst = hits
    // TTL 안에서는 다시 가져오지 않는다
    for (let i = 0; i < 3; i++) await (await fetch(`${srv.base}/w/kim-park`)).text()
    assert.equal(hits, hitsAfterFirst)

    // TTL 이 지나면 새로 가져온다(재배포 반영)
    await new Promise((r) => setTimeout(r, 700))
    const second = await (await fetch(`${srv.base}/w/kim-park`)).text()
    assert.equal(hits, hitsAfterFirst + 1)
    const version2 = /index-v(\d+)\.js/.exec(second)?.[1]
    assert.notEqual(version2, version)

    // web 이 죽으면 예전 사본으로 계속 응답한다
    healthy = false
    await new Promise((r) => setTimeout(r, 700))
    const stale = await fetch(`${srv.base}/w/kim-park`)
    assert.equal(stale.status, 200)
    const staleHtml = await stale.text()
    assert.ok(staleHtml.includes(`index-v${version2}.js`))
    assert.ok(staleHtml.includes('<title>김신랑 ♥ 박신부 결혼합니다</title>'))
  } finally {
    await srv.stop()
    await new Promise((resolve) => web.close(() => resolve(undefined)))
  }
})

test('renderPage: 따옴표 종류·속성 순서가 다른 기존 태그도 지우고, </head> 가 없어도 동작한다', () => {
  const meta = {
    title: '새 제목',
    description: '새 설명 $1 $& $$',
    url: 'https://x.example/w/a',
    image: 'https://x.example/og.png',
    imageSize: { width: 800, height: 400 },
  }
  const template = [
    '<!doctype html><html><head>',
    "<TITLE lang='ko'>옛\n제목</TITLE>",
    "<meta content='옛 설명' name='description'/>",
    '<meta property=og:title content=old>',
    '<meta property="og:image:width" content="1">',
    '<meta name="twitter:site" content="@old">',
    '<meta name="robots" content="index">',
    '<link rel="canonical" href="https://old.example/">',
    '<meta name="viewport" content="width=device-width">',
    '<meta name="descriptionx" content="keep me">',
    '<meta name="theme-color" content="#fff">',
    '</head><body><div id="root"></div></body></html>',
  ].join('\n')
  const html = renderPage(template, meta, { noindex: true })
  for (const gone of ['옛', 'old', '@old', 'content="index"', 'canonical']) assert.ok(!html.includes(gone), gone)
  for (const kept of ['name="viewport"', 'name="descriptionx"', 'name="theme-color"', '<div id="root">']) {
    assert.ok(html.includes(kept), kept)
  }
  assert.equal(count(html, /<title\b/gi), 1)
  assert.ok(html.includes('content="새 설명 $1 $&amp; $$"'), '치환 패턴($1 등)이 해석되지 않는다')
  assert.ok(html.includes('<meta property="og:image:width" content="800">'))
  assert.ok(html.indexOf('새 제목') < html.indexOf('</head>'))

  const headless = renderPage('<div id="root"></div>', meta)
  assert.ok(headless.includes('<title>새 제목</title>'))
  assert.ok(headless.includes('<div id="root"></div>'))
  // meta 가 없으면(없는 청첩장) 템플릿을 그대로 둔다
  assert.equal(renderPage(template, null), template)
})

test('renderPage: 주석 안의 "<title>" 글자를 태그로 착각해 script/stylesheet 를 지우지 않는다 (실제 빌드 모양)', () => {
  const meta = {
    title: '새 제목',
    description: '새 설명',
    url: 'https://x.example/w/a',
    image: 'https://x.example/og.png',
    imageSize: null,
  }
  const comment = '<!-- <title> · description · og:* 태그는 vite.config.ts 가 빌드 시 주입합니다 -->'
  const template = [
    '<!doctype html>',
    '<html lang="ko">',
    '  <head>',
    '    <meta charset="UTF-8" />',
    `    ${comment}`,
    '    <script type="module" crossorigin src="/assets/index-CZRnfdwA.js"></script>',
    '    <link rel="stylesheet" crossorigin href="/assets/index-CFT3bO_q.css">',
    '    <title>범용 제목</title>',
    '    <meta name="description" content="범용 설명">',
    '    <meta property="og:title" content="범용 제목">',
    '    <!-- <meta name="robots" content="index"> <meta property="og:image" content="x"> -->',
    '  </head>',
    '  <body>',
    '    <div id="root"></div>',
    '  </body>',
    '</html>',
  ].join('\n')

  for (const html of [renderPage(template, meta, { noindex: true }), renderPage(template, null, { noindex: true })]) {
    assert.ok(html.includes(comment), '주석은 닫는 --> 까지 그대로')
    assert.ok(html.includes('<!-- <meta name="robots" content="index"> <meta property="og:image" content="x"> -->'))
    assert.equal((html.match(/<!--/g) ?? []).length, (html.match(/-->/g) ?? []).length, '열린 주석이 없다')
    assert.ok(html.includes('<script type="module" crossorigin src="/assets/index-CZRnfdwA.js"></script>'))
    assert.ok(html.includes('<link rel="stylesheet" crossorigin href="/assets/index-CFT3bO_q.css">'))
    assert.equal(count(html, /<title\b/g), 1, '주석 밖의 <title> 은 정확히 하나')
    assert.equal(count(html, /name="robots"/g), 1)
    assert.ok(html.includes('<div id="root"></div>'))
  }
  const html = renderPage(template, meta, { noindex: true })
  const visible = html.replace(/<!--[\s\S]*?-->/g, '')
  assert.ok(visible.includes('<title>새 제목</title>'))
  assert.ok(visible.includes('<meta property="og:title" content="새 제목">'))
  assert.ok(!visible.includes('범용'))
  assert.ok(visible.indexOf('og:title') < visible.indexOf('</head>'))
})

test('/w/:slug: 주석이 든 템플릿에서도 앱 script/stylesheet 가 살아 있고 태그는 주석 밖에 있다', () =>
  withServer(async (srv) => {
    await createWedding(srv.base, 'kim-park')
    const html = await (await fetch(`${srv.base}/w/kim-park`)).text()
    assert.ok(html.includes('빌드 시 주입합니다 -->'))
    assert.ok(html.includes('<link rel="stylesheet" crossorigin href="/assets/index-abc.css">'))
    const visible = html.replace(/<!--[\s\S]*?-->/g, '')
    assert.ok(!visible.includes('<!--'), '닫히지 않은 주석이 없다')
    assert.ok(visible.includes('<script type="module" crossorigin src="/assets/index-abc.js"></script>'))
    assert.ok(visible.includes('<title>김신랑 ♥ 박신부 결혼합니다</title>'))
    assert.ok(visible.includes('<div id="root"></div>'))
  }))
