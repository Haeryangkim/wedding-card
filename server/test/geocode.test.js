// 장소 검색 프록시. 업스트림은 항상 로컬 가짜 서버(또는 닫힌 포트)다 — 실제 Nominatim 을 부르지 않는다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { start, startFakeGeocode } from './helpers.js'

/** @param {string} base @param {string} q */
const search = (base, q) => fetch(`${base}/api/geocode?q=${encodeURIComponent(q)}`)

test('geocode: 업스트림 결과를 GeocodeResult[] 로 바꿔 돌려준다 (정책에 맞는 요청)', async () => {
  const fake = await startFakeGeocode((url) => ({
    body: [
      {
        lat: '37.5662952',
        lon: '126.9779451',
        name: '서울특별시청',
        display_name: '서울특별시청, 110, 세종대로, 중구, 서울특별시, 04524, 대한민국',
        place_id: 1,
        licence: 'ODbL',
      },
      { lat: '35.1', lon: '129.0', name: '', display_name: 'Somewhere, Far Away' },
      { lat: 'NaN', lon: '129.0', display_name: '좌표가 깨진 항목' },
      { lat: '95', lon: '129.0', display_name: '범위를 벗어난 항목' },
      null,
      ...Array.from({ length: 10 }, (_, i) => ({ lat: '37', lon: '127', name: `추가${i}`, display_name: `추가${i}, 대한민국` })),
    ],
  }))
  const srv = await start({ geocodeUrl: fake.url })
  try {
    const res = await fetch(`${srv.base}/api/geocode?q=${encodeURIComponent('  서울시청  ')}`, {
      headers: { Cookie: 'session=private', 'X-Forwarded-For': '203.0.113.50', Referer: 'https://our.wedding/w/kim-park/edit' },
    })
    assert.equal(res.status, 200)
    const list = await res.json()
    assert.equal(list.length, 6, '최대 6개')
    assert.deepEqual(list[0], {
      name: '서울특별시청',
      address: '서울특별시 중구 세종대로 110',
      lat: 37.5662952,
      lng: 126.9779451,
    })
    assert.deepEqual(list[1], { name: 'Somewhere', address: 'Somewhere, Far Away', lat: 35.1, lng: 129 })
    for (const r of list) assert.deepEqual(Object.keys(r), ['name', 'address', 'lat', 'lng'])

    assert.equal(fake.calls.length, 1)
    const call = fake.calls[0]
    assert.equal(call.url.pathname, '/search')
    assert.equal(call.url.searchParams.get('q'), '서울시청')
    assert.equal(call.url.searchParams.get('countrycodes'), 'kr')
    assert.equal(call.url.searchParams.get('accept-language'), 'ko')
    assert.equal(call.url.searchParams.get('limit'), '6')
    assert.match(call.url.searchParams.get('format') ?? '', /^json/)
    // 식별 가능한 User-Agent, 그리고 요청자의 개인정보는 전달하지 않는다
    assert.match(String(call.headers['user-agent']), /wedding/i)
    assert.ok(!/node|undici/i.test(String(call.headers['user-agent'])))
    assert.equal(call.headers.cookie, undefined)
    assert.equal(call.headers['x-forwarded-for'], undefined)
    assert.equal(call.headers.referer, undefined)
    assert.ok(!JSON.stringify(call.headers).includes('203.0.113.50'))
  } finally {
    await srv.stop()
    await fake.stop()
  }
})

test('geocode: 같은 검색어는 캐시에서 답하고(LRU), 용량을 넘으면 가장 오래 안 쓴 것부터 버린다', async () => {
  const fake = await startFakeGeocode((url) => ({
    body: [{ lat: '37', lon: '127', name: url.searchParams.get('q'), display_name: 'x' }],
  }))
  const srv = await start({ geocodeUrl: fake.url, geocodeCacheSize: 2 })
  try {
    const names = async (/** @type {string} */ q) => (await (await search(srv.base, q)).json())[0].name
    assert.equal(await names('강남 웨딩홀'), '강남 웨딩홀')
    assert.equal(await names('강남   웨딩홀'), '강남 웨딩홀') // 공백 정규화 → 같은 키
    assert.equal(await names(' 강남 웨딩홀 '), '강남 웨딩홀')
    assert.equal(fake.calls.length, 1)

    await names('부산 호텔') // 캐시: [강남, 부산]
    await names('강남 웨딩홀') // 강남을 최근 사용으로 → [부산, 강남]
    await names('제주 리조트') // 부산이 밀려난다 → [강남, 제주]
    assert.equal(fake.calls.length, 3)
    assert.equal(srv.app.geocoder.cacheSize, 2)
    await names('강남 웨딩홀')
    assert.equal(fake.calls.length, 3, '강남은 아직 캐시에 있다')
    await names('부산 호텔')
    assert.equal(fake.calls.length, 4, '부산은 버려져서 다시 조회한다')
  } finally {
    await srv.stop()
    await fake.stop()
  }
})

test('geocode: 업스트림 호출 사이에 최소 간격을 둔다 (동시에 몰려도 한 줄로)', async () => {
  const fake = await startFakeGeocode()
  const srv = await start({ geocodeUrl: fake.url, geocodeMinIntervalMs: 200 })
  try {
    const all = await Promise.all(['장소 하나', '장소 둘', '장소 셋', '장소 하나'].map((q) => search(srv.base, q)))
    for (const res of all) assert.equal(res.status, 200)
    assert.equal(fake.calls.length, 3, '같은 검색어는 줄 서 있는 동안 채워진 캐시를 쓴다')
    for (let i = 1; i < fake.calls.length; i++) {
      const gap = fake.calls[i].at - fake.calls[i - 1].at
      assert.ok(gap >= 180, `gap ${gap}ms < 200ms`)
    }
  } finally {
    await srv.stop()
    await fake.stop()
  }
})

test('geocode: 업스트림 실패 → 502 { error }, 실패는 캐시하지 않는다', async () => {
  let mode = 'error'
  const fake = await startFakeGeocode(() => {
    if (mode === 'error') return { status: 500, body: { error: 'boom' } }
    if (mode === 'html') return { body: '<html>blocked</html>' }
    if (mode === 'object') return { body: { error: 'Unable to geocode' } }
    return { body: [{ lat: '37', lon: '127', name: '복구됨', display_name: '복구됨, 대한민국' }] }
  })
  const srv = await start({ geocodeUrl: fake.url })
  try {
    for (const m of ['error', 'html', 'object']) {
      mode = m
      const res = await search(srv.base, '서울시청')
      assert.equal(res.status, 502, m)
      assert.equal(typeof (await res.json()).error, 'string')
    }
    mode = 'ok'
    const ok = await search(srv.base, '서울시청')
    assert.equal(ok.status, 200)
    assert.equal((await ok.json())[0].name, '복구됨')
    assert.equal(fake.calls.length, 4)
  } finally {
    await srv.stop()
    await fake.stop()
  }
})

test('geocode: 업스트림에 연결할 수 없으면 502', async () => {
  const srv = await start() // 기본값: 닫힌 로컬 포트
  try {
    const res = await search(srv.base, '서울시청')
    assert.equal(res.status, 502)
    assert.equal(typeof (await res.json()).error, 'string')
  } finally {
    await srv.stop()
  }
})

test('geocode: 검색어 검증 400, 빈 결과는 200 [], 메서드 405', async () => {
  const fake = await startFakeGeocode(() => ({ body: [] }))
  const srv = await start({ geocodeUrl: fake.url })
  try {
    assert.equal((await fetch(`${srv.base}/api/geocode`)).status, 400)
    assert.equal((await search(srv.base, '')).status, 400)
    assert.equal((await search(srv.base, ' 가 ')).status, 400)
    assert.equal((await search(srv.base, '가'.repeat(81))).status, 400)
    assert.equal(fake.calls.length, 0)

    const empty = await search(srv.base, '없는 장소')
    assert.equal(empty.status, 200)
    assert.deepEqual(await empty.json(), [])
    assert.equal((await fetch(`${srv.base}/api/geocode?q=abc`, { method: 'POST' })).status, 405)
  } finally {
    await srv.stop()
    await fake.stop()
  }
})

test('geocode: IP별 한도 초과 → 429 (업스트림을 부르지 않는다)', async () => {
  const fake = await startFakeGeocode()
  const srv = await start({ geocodeUrl: fake.url, geocodeRateLimit: { windowMs: 60_000, max: 3 } })
  try {
    const statuses = []
    for (let i = 0; i < 5; i++) statuses.push((await search(srv.base, `검색어 ${i}`)).status)
    assert.deepEqual(statuses, [200, 200, 200, 429, 429])
    assert.equal(fake.calls.length, 3)
  } finally {
    await srv.stop()
    await fake.stop()
  }
})
