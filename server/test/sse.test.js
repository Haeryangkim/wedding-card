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
