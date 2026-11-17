import { test } from 'node:test'
import assert from 'node:assert/strict'
import { start, validGuest, postGuest } from './helpers.js'

test('비밀번호 삭제: 틀리면 403, 맞으면 204', async () => {
  const srv = await start()
  try {
    const entry = await (await postGuest(srv.base, validGuest({ password: 'rightpass' }))).json()

    const wrong = await fetch(`${srv.base}/api/guests/${entry.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrongpass' }),
    })
    assert.equal(wrong.status, 403)

    const right = await fetch(`${srv.base}/api/guests/${entry.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'rightpass' }),
    })
    assert.equal(right.status, 204)

    const list = await (await fetch(`${srv.base}/api/guests`)).json()
    assert.equal(list.length, 0)
  } finally {
    await srv.stop()
  }
})

test('없는 id 삭제 → 404', async () => {
  const srv = await start()
  try {
    const res = await fetch(`${srv.base}/api/guests/does-not-exist`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'whatever' }),
    })
    assert.equal(res.status, 404)
  } finally {
    await srv.stop()
  }
})

test('ADMIN_TOKEN Bearer 로 비밀번호 없이 삭제', async () => {
  const srv = await start({ adminToken: 'super-secret-admin' })
  try {
    const entry = await (await postGuest(srv.base, validGuest())).json()

    const badToken = await fetch(`${srv.base}/api/guests/${entry.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer nope' },
    })
    assert.equal(badToken.status, 400, '잘못된 관리자 토큰이면 비밀번호 경로로 떨어져 400')

    const ok = await fetch(`${srv.base}/api/guests/${entry.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer super-secret-admin' },
    })
    assert.equal(ok.status, 204)
    const list = await (await fetch(`${srv.base}/api/guests`)).json()
    assert.equal(list.length, 0)
  } finally {
    await srv.stop()
  }
})

test('본문 크기 제한 초과 → 413', async () => {
  const srv = await start({ bodyLimit: 1024 })
  try {
    const res = await fetch(`${srv.base}/api/guests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blob: 'x'.repeat(4096) }),
    })
    assert.equal(res.status, 413)
  } finally {
    await srv.stop()
  }
})

test('레이트리밋: 한도 초과 쓰기는 429', async () => {
  const srv = await start({ rateLimit: { windowMs: 60_000, max: 3 } })
  try {
    for (let i = 0; i < 3; i++) {
      assert.equal((await postGuest(srv.base, validGuest())).status, 201)
    }
    const limited = await postGuest(srv.base, validGuest())
    assert.equal(limited.status, 429)
  } finally {
    await srv.stop()
  }
})

test('CORS: 허용 목록 오리진은 echo, 비허용은 헤더 없음, 프리플라이트 204', async () => {
  const srv = await start({ corsOrigin: ['https://haeryangkim.github.io'] })
  try {
    const allowed = await fetch(`${srv.base}/api/health`, {
      headers: { Origin: 'https://haeryangkim.github.io' },
    })
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://haeryangkim.github.io')

    const denied = await fetch(`${srv.base}/api/health`, { headers: { Origin: 'https://evil.example' } })
    assert.equal(denied.headers.get('access-control-allow-origin'), null)

    const preflight = await fetch(`${srv.base}/api/guests`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://haeryangkim.github.io',
        'Access-Control-Request-Method': 'POST',
      },
    })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://haeryangkim.github.io')
    assert.match(preflight.headers.get('access-control-allow-methods') ?? '', /POST/)
  } finally {
    await srv.stop()
  }
})

test('CORS: "*" 는 모든 오리진 허용', async () => {
  const srv = await start({ corsOrigin: '*' })
  try {
    const res = await fetch(`${srv.base}/api/health`, { headers: { Origin: 'https://anything.example' } })
    assert.equal(res.headers.get('access-control-allow-origin'), '*')
  } finally {
    await srv.stop()
  }
})
