import { test } from 'node:test'
import assert from 'node:assert/strict'
import { start, validGuest, postGuest, connectSse, createWedding } from './helpers.js'

const SLUG = 'our-wedding'

test('SSE: 하객 추가 시 added, 삭제 시 removed 이벤트를 받는다', async () => {
  const srv = await start()
  await createWedding(srv.base, SLUG)
  const sse = await connectSse(srv.base, SLUG)
  try {
    const created = await (await postGuest(srv.base, SLUG, validGuest({ name: '실시간', password: 'pass1234' }))).json()

    const added = await sse.waitFor('added')
    const addedData = JSON.parse(added.data)
    assert.equal(addedData.id, created.id)
    assert.equal(addedData.name, '실시간')
    assert.ok(!('password' in addedData))

    const del = await fetch(`${srv.base}/api/weddings/${SLUG}/guests/${created.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'pass1234' }),
    })
    assert.equal(del.status, 204)

    const removed = await sse.waitFor('removed')
    assert.deepEqual(JSON.parse(removed.data), { id: created.id })
  } finally {
    sse.close()
    await srv.stop()
  }
})

test('SSE: 응답 헤더가 text/event-stream 이다', async () => {
  const srv = await start()
  await createWedding(srv.base, SLUG)
  const sse = await connectSse(srv.base, SLUG)
  try {
    assert.match(sse.response.headers.get('content-type') ?? '', /text\/event-stream/)
    assert.equal(sse.response.headers.get('cache-control'), 'no-cache, no-transform')
  } finally {
    sse.close()
    await srv.stop()
  }
})

test('SSE: 연결 상한을 넘으면 503 + Retry-After, 연결이 닫히면 자리가 난다', async () => {
  const srv = await start({ sseMaxClients: 2 })
  await createWedding(srv.base, SLUG)
  const a = await connectSse(srv.base, SLUG)
  const b = await connectSse(srv.base, SLUG)
  try {
    const over = await fetch(`${srv.base}/api/weddings/${SLUG}/events`)
    assert.equal(over.status, 503)
    assert.ok(over.headers.get('retry-after'))
    await over.body?.cancel()

    a.close()
    const deadline = Date.now() + 2000
    while (srv.app.broker.size > 1 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10))
    }
    assert.equal(srv.app.broker.size, 1)

    const c = await connectSse(srv.base, SLUG)
    try {
      assert.equal(c.response.status, 200)
    } finally {
      c.close()
    }
  } finally {
    a.close()
    b.close()
    await srv.stop()
  }
})

test('SSE: IP별 연결 상한', async () => {
  const srv = await start({ sseMaxPerIp: 1 })
  await createWedding(srv.base, SLUG)
  const a = await connectSse(srv.base, SLUG)
  try {
    const over = await fetch(`${srv.base}/api/weddings/${SLUG}/events`)
    assert.equal(over.status, 503)
    await over.body?.cancel()
  } finally {
    a.close()
    await srv.stop()
  }
})

test('SSE: 청첩장별 채널 — A 의 이벤트는 B 구독자에게 가지 않는다', async () => {
  const srv = await start()
  await createWedding(srv.base, 'wedding-a')
  await createWedding(srv.base, 'wedding-b')
  const a = await connectSse(srv.base, 'wedding-a')
  const b = await connectSse(srv.base, 'wedding-b')
  try {
    const ga = await (await postGuest(srv.base, 'wedding-a', validGuest({ name: 'A하객' }))).json()
    const gb = await (await postGuest(srv.base, 'wedding-b', validGuest({ name: 'B하객' }))).json()

    // 각 구독자가 받는 첫 added 는 자기 청첩장의 글이다 (남의 글이 섞였다면 먼저 도착했을 것)
    assert.equal(JSON.parse((await a.waitFor('added')).data).id, ga.id)
    assert.equal(JSON.parse((await b.waitFor('added')).data).id, gb.id)

    await fetch(`${srv.base}/api/weddings/wedding-a/guests/${ga.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'pass1234' }),
    })
    assert.deepEqual(JSON.parse((await a.waitFor('removed')).data), { id: ga.id })
    // B 에는 더 이상 아무 이벤트도 오지 않는다
    await assert.rejects(() => b.waitFor('removed', 300), /timeout/)
    await assert.rejects(() => a.waitFor('added', 100), /timeout/)
  } finally {
    a.close()
    b.close()
    await srv.stop()
  }
})

test('SSE: 청첩장을 지우면 그 채널의 연결만 닫힌다', async () => {
  const srv = await start()
  const a = await createWedding(srv.base, 'wedding-a')
  await createWedding(srv.base, 'wedding-b')
  const sa = await connectSse(srv.base, 'wedding-a')
  const sb = await connectSse(srv.base, 'wedding-b')
  try {
    assert.equal(srv.app.broker.size, 2)
    const del = await fetch(`${srv.base}/api/weddings/wedding-a`, { method: 'DELETE', headers: { Authorization: `Bearer ${a.token}` } })
    assert.equal(del.status, 204)
    const deadline = Date.now() + 2000
    while (srv.app.broker.size > 1 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10))
    assert.equal(srv.app.broker.size, 1)
    // 남은 연결은 B 의 것: B 이벤트는 계속 온다
    const gb = await (await postGuest(srv.base, 'wedding-b', validGuest())).json()
    assert.equal(JSON.parse((await sb.waitFor('added')).data).id, gb.id)
  } finally {
    sa.close()
    sb.close()
    await srv.stop()
  }
})
