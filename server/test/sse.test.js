import { test } from 'node:test'
import assert from 'node:assert/strict'
import { start, validGuest, postGuest, connectSse } from './helpers.js'

test('SSE: 하객 추가 시 added, 삭제 시 removed 이벤트를 받는다', async () => {
  const srv = await start()
  const sse = await connectSse(srv.base)
  try {
    const created = await (await postGuest(srv.base, validGuest({ name: '실시간', password: 'pass1234' }))).json()

    const added = await sse.waitFor('added')
    const addedData = JSON.parse(added.data)
    assert.equal(addedData.id, created.id)
    assert.equal(addedData.name, '실시간')
    assert.ok(!('password' in addedData))

    const del = await fetch(`${srv.base}/api/guests/${created.id}`, {
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
  const sse = await connectSse(srv.base)
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
  const a = await connectSse(srv.base)
  const b = await connectSse(srv.base)
  try {
    const over = await fetch(`${srv.base}/api/events`)
    assert.equal(over.status, 503)
    assert.ok(over.headers.get('retry-after'))
    await over.body?.cancel()

    a.close()
    const deadline = Date.now() + 2000
    while (srv.app.broker.size > 1 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10))
    }
    assert.equal(srv.app.broker.size, 1)

    const c = await connectSse(srv.base)
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
  const a = await connectSse(srv.base)
  try {
    const over = await fetch(`${srv.base}/api/events`)
    assert.equal(over.status, 503)
    await over.body?.cancel()
  } finally {
    a.close()
    await srv.stop()
  }
})
