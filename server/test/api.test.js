import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { start, validGuest, postGuest, createWedding } from './helpers.js'

const SLUG = 'our-wedding'

/** @type {Awaited<ReturnType<typeof start>>} */
let srv

before(async () => {
  srv = await start()
  await createWedding(srv.base, SLUG)
})
after(async () => {
  await srv.stop()
})

test('GET /api/health → 200 { ok: true }', async () => {
  const res = await fetch(`${srv.base}/api/health`)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
})

test('POST /api/weddings/:slug/guests → 201 로 GuestEntry 를 돌려주고 비밀번호는 노출하지 않는다', async () => {
  const res = await postGuest(srv.base, SLUG, validGuest({ name: '민지', message: '행복하세요' }))
  assert.equal(res.status, 201)
  const entry = await res.json()
  assert.equal(typeof entry.id, 'string')
  assert.ok(entry.id.length >= 16)
  assert.equal(entry.name, '민지')
  assert.equal(entry.message, '행복하세요')
  assert.equal(entry.side, 'groom')
  assert.equal(typeof entry.createdAt, 'number')
  assert.deepEqual(entry.appearance, { skin: 1, hairStyle: 2, hairColor: 3, outfit: 0, outfitColor: 4, accessory: 0 })
  assert.ok(!('password' in entry))
  assert.ok(!('pw_hash' in entry))
})

test('GET /api/weddings/:slug/guests → createdAt 오름차순', async () => {
  const fresh = await start()
  try {
    await createWedding(fresh.base, SLUG)
    await postGuest(fresh.base, SLUG, validGuest({ name: '첫번째' }))
    await new Promise((r) => setTimeout(r, 5))
    await postGuest(fresh.base, SLUG, validGuest({ name: '두번째', side: 'bride' }))
    const list = await (await fetch(`${fresh.base}/api/weddings/${SLUG}/guests`)).json()
    assert.equal(list.length, 2)
    assert.equal(list[0].name, '첫번째')
    assert.equal(list[1].name, '두번째')
    assert.ok(list[0].createdAt <= list[1].createdAt)
  } finally {
    await fresh.stop()
  }
})

test('이름/메시지의 제어문자는 제거되고 앞뒤 공백은 트림된다', async () => {
  const res = await postGuest(srv.base, SLUG, validGuest({ name: '  해\t랑  ', message: '안녕\u0000하세요' }))
  const entry = await res.json()
  assert.equal(entry.name, '해랑')
  assert.equal(entry.message, '안녕하세요')
})

test('검증 실패는 모두 400 { error } 를 돌려준다', async () => {
  const bad = [
    validGuest({ name: '' }),
    validGuest({ name: '열세글자이름열세글자이름넘침' }), // 13자 초과
    validGuest({ message: '' }),
    validGuest({ message: 'a'.repeat(201) }),
    validGuest({ side: 'other' }),
    validGuest({ password: '123' }),
    validGuest({ appearance: { skin: 1, hairStyle: 2, hairColor: 3, outfit: 0, outfitColor: 4 } }), // 필드 부족
    validGuest({ appearance: { skin: 1, hairStyle: 2, hairColor: 3, outfit: 0, outfitColor: 4, accessory: 0, extra: 1 } }),
    validGuest({ appearance: { skin: 1, hairStyle: 2, hairColor: 3, outfit: 0, outfitColor: 4, accessory: 99 } }), // 범위 초과
    validGuest({ appearance: { skin: 1.5, hairStyle: 2, hairColor: 3, outfit: 0, outfitColor: 4, accessory: 0 } }), // 정수 아님
    validGuest({ extraField: 'nope' }), // 알 수 없는 필드
  ]
  for (const body of bad) {
    const res = await postGuest(srv.base, SLUG, body)
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body).slice(0, 60)}`)
    const json = await res.json()
    assert.equal(typeof json.error, 'string')
  }
})

test('JSON 이 아닌 본문 → 400', async () => {
  const res = await fetch(`${srv.base}/api/weddings/${SLUG}/guests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'this-is-not-json',
  })
  assert.equal(res.status, 400)
})

test('알 수 없는 경로 → 404, 잘못된 메서드 → 405', async () => {
  assert.equal((await fetch(`${srv.base}/api/nope`)).status, 404)
  assert.equal((await fetch(`${srv.base}/api/weddings/${SLUG}/guests`, { method: 'PUT' })).status, 405)
})

test('MAX_GUESTS 초과 → 409 (청첩장별)', async () => {
  const full = await start({ maxGuests: 1 })
  try {
    await createWedding(full.base, SLUG)
    await createWedding(full.base, 'other-one')
    assert.equal((await postGuest(full.base, SLUG, validGuest())).status, 201)
    assert.equal((await postGuest(full.base, SLUG, validGuest())).status, 409)
    // 상한은 청첩장별이다
    assert.equal((await postGuest(full.base, 'other-one', validGuest())).status, 201)
  } finally {
    await full.stop()
  }
})

test('없는 청첩장의 방명록 → 404, 예전 경로(/api/guests, /api/events)는 사라졌다', async () => {
  assert.equal((await fetch(`${srv.base}/api/weddings/no-such-one/guests`)).status, 404)
  assert.equal((await postGuest(srv.base, 'no-such-one', validGuest())).status, 404)
  assert.equal((await fetch(`${srv.base}/api/weddings/no-such-one/events`)).status, 404)
  assert.equal((await fetch(`${srv.base}/api/guests`)).status, 404)
  assert.equal((await fetch(`${srv.base}/api/events`)).status, 404)
})
