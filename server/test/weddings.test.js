import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  start,
  validConfig,
  validGuest,
  postGuest,
  jsonReq,
  auth,
  createWedding,
  uploadPhoto,
  ADMIN_PW,
} from './helpers.js'

/** @param {(srv: Awaited<ReturnType<typeof start>>) => Promise<void>} fn @param {Record<string, any>} [overrides] */
async function withServer(fn, overrides) {
  const srv = await start(overrides)
  try {
    await fn(srv)
  } finally {
    await srv.stop()
  }
}

test('주소 확인: 사용 가능 / 사용 중 / 형식 오류 / 예약어', () =>
  withServer(async (srv) => {
    const check = async (/** @type {string} */ slug) =>
      (await fetch(`${srv.base}/api/weddings/${encodeURIComponent(slug)}/availability`)).json()

    assert.deepEqual(await check('our-wedding'), { available: true })
    await createWedding(srv.base, 'our-wedding')
    const taken = await check('our-wedding')
    assert.equal(taken.available, false)
    assert.equal(typeof taken.reason, 'string')

    for (const bad of ['ab', 'a'.repeat(31), '-abc', 'abc-', 'Our-Wedding', 'a_b_c', '한글주소', 'a b c', 'demo', 'new', 'api', 'uploads', 'admin']) {
      const r = await check(bad)
      assert.equal(r.available, false, bad)
      assert.equal(typeof r.reason, 'string', bad)
    }
    // 경계값: 3자, 30자
    assert.deepEqual(await check('abc'), { available: true })
    assert.deepEqual(await check('a'.repeat(30)), { available: true })
  }))

test('청첩장 만들기 → 201 { wedding, token, expiresAt }, 비밀번호 정보는 어디에도 없다', () =>
  withServer(async (srv) => {
    const before = Date.now()
    const res = await jsonReq(srv.base, '/api/weddings', 'POST', {
      slug: 'kim-park',
      password: ADMIN_PW,
      config: validConfig(),
    })
    assert.equal(res.status, 201)
    const json = await res.json()
    assert.deepEqual(Object.keys(json).sort(), ['expiresAt', 'token', 'wedding'])
    assert.deepEqual(Object.keys(json.wedding).sort(), ['config', 'createdAt', 'slug', 'updatedAt'])
    assert.equal(json.wedding.slug, 'kim-park')
    assert.equal(json.wedding.config.groom.name, '김신랑')
    assert.ok(json.wedding.createdAt >= before)
    assert.equal(json.wedding.createdAt, json.wedding.updatedAt)
    assert.equal(typeof json.token, 'string')
    // 만료는 약 12시간 뒤
    assert.ok(Math.abs(json.expiresAt - (Date.now() + 12 * 60 * 60 * 1000)) < 60_000)
    assert.ok(!JSON.stringify(json).includes(ADMIN_PW))
    assert.ok(!/pw_hash|pw_salt|password/.test(JSON.stringify(json)))

    // 공개 조회
    const got = await fetch(`${srv.base}/api/weddings/kim-park`)
    assert.equal(got.status, 200)
    const record = await got.json()
    assert.deepEqual(record, json.wedding)
    assert.ok(!/pw_hash|pw_salt|password/.test(JSON.stringify(record)))

    // 발급된 토큰으로 바로 수정 가능
    const put = await jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: validConfig({ durationMinutes: 60 }) }, auth(json.token))
    assert.equal(put.status, 200)
  }))

test('청첩장 만들기 실패: 중복 409, 주소·비밀번호·본문 오류 400', () =>
  withServer(async (srv) => {
    await createWedding(srv.base, 'kim-park')
    const post = (/** @type {any} */ body) => jsonReq(srv.base, '/api/weddings', 'POST', body)

    const dup = await post({ slug: 'kim-park', password: ADMIN_PW, config: validConfig() })
    assert.equal(dup.status, 409)
    assert.equal(typeof (await dup.json()).error, 'string')

    const bad = [
      { slug: 'Kim-Park', password: ADMIN_PW, config: validConfig() }, // 대문자
      { slug: 'ab', password: ADMIN_PW, config: validConfig() },
      { slug: '-abc', password: ADMIN_PW, config: validConfig() },
      { slug: 'demo', password: ADMIN_PW, config: validConfig() }, // 예약어
      { slug: 'uploads', password: ADMIN_PW, config: validConfig() },
      { slug: 123, password: ADMIN_PW, config: validConfig() },
      { slug: 'good-one', password: '12345', config: validConfig() }, // 6자 미만
      { slug: 'good-one', password: 'x'.repeat(73), config: validConfig() },
      { slug: 'good-one', config: validConfig() },
      { slug: 'good-one', password: ADMIN_PW },
      { slug: 'good-one', password: ADMIN_PW, config: validConfig(), extra: 1 },
      [],
      'text',
    ]
    for (const body of bad) {
      const res = await post(body)
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80))
      assert.equal(typeof (await res.json()).error, 'string')
    }
    assert.equal((await fetch(`${srv.base}/api/weddings/good-one`)).status, 404)

    const notJson = await fetch(`${srv.base}/api/weddings`, { method: 'POST', body: '{nope' })
    assert.equal(notJson.status, 400)
    assert.equal((await fetch(`${srv.base}/api/weddings`)).status, 405)
  }))

test('없는 청첩장 → 404 (조회·로그인·수정·삭제 모두)', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    assert.equal((await fetch(`${srv.base}/api/weddings/nobody-here`)).status, 404)
    assert.equal((await fetch(`${srv.base}/api/weddings/Kim-Park`)).status, 404, '대소문자를 섞은 주소는 다른 주소')
    assert.equal((await jsonReq(srv.base, '/api/weddings/nobody-here/login', 'POST', { password: ADMIN_PW })).status, 404)
    assert.equal((await jsonReq(srv.base, '/api/weddings/nobody-here', 'PUT', { config: validConfig() }, auth(token))).status, 404)
    assert.equal((await jsonReq(srv.base, '/api/weddings/nobody-here', 'DELETE', undefined, auth(token))).status, 404)
    assert.equal((await fetch(`${srv.base}/api/weddings/kim-park/nope`)).status, 404)
  }))

test('로그인: 틀리면 403, 맞으면 토큰, 비밀번호 없으면 400', () =>
  withServer(async (srv) => {
    await createWedding(srv.base, 'kim-park')
    const login = (/** @type {any} */ body) => jsonReq(srv.base, '/api/weddings/kim-park/login', 'POST', body)

    assert.equal((await login({ password: 'wrong-pass' })).status, 403)
    assert.equal((await login({})).status, 400)
    assert.equal((await login({ password: 12345678 })).status, 400)

    const ok = await login({ password: ADMIN_PW })
    assert.equal(ok.status, 200)
    const json = await ok.json()
    assert.deepEqual(Object.keys(json).sort(), ['expiresAt', 'token'])
    assert.ok(json.expiresAt > Date.now())

    const put = await jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: validConfig() }, auth(json.token))
    assert.equal(put.status, 200)
  }))

test('로그인 실패 한도: (IP, 청첩장)별로 틀린 시도만 세고 넘으면 429', () =>
  withServer(
    async (srv) => {
      await createWedding(srv.base, 'kim-park')
      await createWedding(srv.base, 'lee-choi')
      const login = (/** @type {string} */ slug, /** @type {string} */ password) =>
        jsonReq(srv.base, `/api/weddings/${slug}/login`, 'POST', { password })

      // 성공한 로그인은 한도를 차감하지 않는다
      for (let i = 0; i < 5; i++) assert.equal((await login('kim-park', ADMIN_PW)).status, 200)
      for (let i = 0; i < 3; i++) assert.equal((await login('kim-park', `wrong-${i}`)).status, 403)
      // 한도 도달: 맞는 비밀번호여도 잠긴다
      assert.equal((await login('kim-park', ADMIN_PW)).status, 429)
      // 다른 청첩장은 영향 없음
      assert.equal((await login('lee-choi', ADMIN_PW)).status, 200)
    },
    { loginRateLimit: { windowMs: 60_000, max: 3 } },
  ))

test('수정: 토큰 없으면 401, 있으면 200 WeddingRecord (정제된 값, kakaoJsKey 제거)', () =>
  withServer(async (srv) => {
    const { token, wedding } = await createWedding(srv.base, 'kim-park')
    const path = '/api/weddings/kim-park'

    const noAuth = await jsonReq(srv.base, path, 'PUT', { config: validConfig() })
    assert.equal(noAuth.status, 401)
    assert.equal(typeof (await noAuth.json()).error, 'string')
    assert.equal((await jsonReq(srv.base, path, 'PUT', { config: validConfig() }, auth('garbage'))).status, 401)
    assert.equal((await jsonReq(srv.base, path, 'PUT', { config: validConfig() }, { Authorization: 'Basic abc' })).status, 401)

    await new Promise((r) => setTimeout(r, 5))
    const cfg = validConfig({ kakaoJsKey: 'should-be-dropped', coverImage: null })
    cfg.groom.name = '  김\u0000신랑\t '
    cfg.greeting.body = ['첫 줄\u0007', '', '  셋째 줄  ']
    cfg.bride.phone = ''
    const res = await jsonReq(srv.base, path, 'PUT', { config: cfg }, auth(token))
    assert.equal(res.status, 200)
    const record = await res.json()
    assert.equal(record.slug, 'kim-park')
    assert.equal(record.createdAt, wedding.createdAt)
    assert.ok(record.updatedAt > wedding.updatedAt)
    assert.equal(record.config.groom.name, '김신랑')
    assert.deepEqual(record.config.greeting.body, ['첫 줄', '', '셋째 줄'])
    assert.ok(!('kakaoJsKey' in record.config))
    assert.ok(!('coverImage' in record.config))
    assert.ok(!('phone' in record.config.bride))
    assert.equal(record.config.bride.mother.deceased, true)
    assert.deepEqual(record.config.gallery, [])

    assert.deepEqual(await (await fetch(`${srv.base}${path}`)).json(), record)

    // 본문 형태 오류
    assert.equal((await jsonReq(srv.base, path, 'PUT', validConfig(), auth(token))).status, 400)
    assert.equal((await jsonReq(srv.base, path, 'PUT', { config: validConfig(), slug: 'x' }, auth(token))).status, 400)
  }))

test('내용 검증: 틀린 값은 400 이고 메시지에 필드 이름이 들어 있다', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    /** @type {[string, (c: any) => void][]} */
    const cases = [
      ['groom', (c) => delete c.groom],
      ['groom.name', (c) => (c.groom.name = '')],
      ['groom.name', (c) => (c.groom.name = '가'.repeat(21))],
      ['bride.name', (c) => (c.bride.name = 42)],
      ['bride.firstName', (c) => delete c.bride.firstName],
      ['groom.father.name', (c) => (c.groom.father = { name: '' })],
      ['groom.father.deceased', (c) => (c.groom.father = { name: '김아버지', deceased: 'yes' })],
      ['groom.nickname', (c) => (c.groom.nickname = '별명')],
      ['bride.mother.age', (c) => (c.bride.mother.age = 60)],
      ['datetime', (c) => (c.datetime = '2027-05-15T12:30:00Z')],
      ['datetime', (c) => (c.datetime = '2027-05-15T12:30:00+08:00')],
      ['datetime', (c) => (c.datetime = '2027-05-15 12:30')],
      ['datetime', (c) => (c.datetime = '2027-13-15T12:30:00+09:00')],
      ['datetime', (c) => (c.datetime = '2027-02-31T12:30:00+09:00')],
      ['datetime', (c) => (c.datetime = 1810000000000)],
      ['durationMinutes', (c) => (c.durationMinutes = 9)],
      ['durationMinutes', (c) => (c.durationMinutes = 601)],
      ['durationMinutes', (c) => (c.durationMinutes = 90.5)],
      ['durationMinutes', (c) => (c.durationMinutes = '90')],
      ['venue.name', (c) => (c.venue.name = '')],
      ['venue.name', (c) => (c.venue.name = '홀'.repeat(61))],
      ['venue.address', (c) => (c.venue.address = '주'.repeat(121))],
      ['venue.lat', (c) => (c.venue.lat = 90.1)],
      ['venue.lat', (c) => (c.venue.lat = '37.5')],
      ['venue.lng', (c) => (c.venue.lng = -180.5)],
      ['venue.lng', (c) => (c.venue.lng = null)],
      ['venue.transport', (c) => (c.venue.transport = Array.from({ length: 7 }, () => ({ title: 'x', lines: [] })))],
      ['venue.transport[0].lines', (c) => (c.venue.transport[0].lines = 'not-array')],
      ['venue.transport[1].lines[0]', (c) => (c.venue.transport[1].lines = ['가'.repeat(121)])],
      ['venue.transport[0].icon', (c) => (c.venue.transport[0].icon = 'bus')],
      ['greeting.body', (c) => (c.greeting.body = Array.from({ length: 21 }, () => '줄'))],
      ['greeting.body[1]', (c) => (c.greeting.body[1] = 5)],
      ['greeting.title', (c) => (c.greeting.title = '제'.repeat(61))],
      ['gallery', (c) => (c.gallery = 'photo.jpg')],
      ['gallery[0]', (c) => (c.gallery = ['https://evil.example/x.jpg'])],
      ['gallery[0]', (c) => (c.gallery = ['/uploads/kim-park/../../etc/passwd'])],
      ['gallery[0]', (c) => (c.gallery = [`/uploads/kim-park/${'a'.repeat(32)}.png`])], // 형식은 맞지만 없는 파일
      ['coverImage', (c) => (c.coverImage = '/photo.png')],
      ['accounts.groomSide', (c) => (c.accounts.groomSide = Array.from({ length: 5 }, () => c.accounts.groomSide[0]))],
      ['accounts.brideSide', (c) => delete c.accounts.brideSide],
      ['accounts.groomSide[0].kakaoPayUrl', (c) => (c.accounts.groomSide[0].kakaoPayUrl = 'javascript:alert(1)')],
      ['accounts.groomSide[0].kakaoPayUrl', (c) => (c.accounts.groomSide[0].kakaoPayUrl = 'http://qr.kakaopay.com/x')],
      ['accounts.groomSide[0].memo', (c) => (c.accounts.groomSide[0].memo = '메모')],
      ['share.title', (c) => (c.share.title = '제'.repeat(61))],
      ['share', (c) => (c.share = 'title')],
      ['theme', (c) => (c.theme = 'dark')],
      ['__proto__', (c) => Object.defineProperty(c, '__proto__', { value: { x: 1 }, enumerable: true })],
    ]
    for (const [field, mutate] of cases) {
      const cfg = validConfig()
      mutate(cfg)
      const res = await jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: cfg }, auth(token))
      const json = await res.json()
      assert.equal(res.status, 400, `${field}: expected 400, got ${res.status} ${JSON.stringify(json)}`)
      assert.ok(json.error.includes(field), `${field}: message should name the field → ${json.error}`)
    }

    // 허용되는 경계값
    const ok = validConfig({ durationMinutes: 600 })
    ok.venue.lat = -90
    ok.venue.lng = 180
    ok.datetime = '2027-05-15T12:30+09:00'
    ok.accounts.groomSide[0].kakaoPayUrl = 'https://qr.kakaopay.com/abc123'
    delete ok.gallery
    const res = await jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: ok }, auth(token))
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()))
    assert.deepEqual((await res.json()).config.gallery, [])
  }))

test('내용이 너무 크면 거절한다 (JSON 32KB 초과 → 400, 본문 한도 초과 → 413)', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    // 한 필드씩은 상한 이내지만 합치면 32KB 를 넘는다(4바이트 이모지 × 120자 × 20줄 × ...).
    const cfg = validConfig()
    const line = '🎉'.repeat(120)
    cfg.greeting.body = Array.from({ length: 20 }, () => line)
    cfg.venue.transport = Array.from({ length: 6 }, () => ({ title: '🎉'.repeat(60), lines: Array.from({ length: 10 }, () => line) }))
    const res = await jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: cfg }, auth(token))
    assert.equal(res.status, 400)
    assert.match((await res.json()).error, /너무 깁니다/)

    const huge = await jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: validConfig(), pad: 'x'.repeat(80 * 1024) }, auth(token))
    assert.equal(huge.status, 413)
  }))

test('비밀번호 변경 → 204, 이전 토큰·이전 비밀번호는 무효', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    const path = '/api/weddings/kim-park'

    assert.equal((await jsonReq(srv.base, `${path}/password`, 'PUT', { password: 'new-pass-22' })).status, 401)
    assert.equal((await jsonReq(srv.base, `${path}/password`, 'PUT', { password: '123' }, auth(token))).status, 400)
    assert.equal((await jsonReq(srv.base, `${path}/password`, 'PUT', { password: 'new-pass-22', x: 1 }, auth(token))).status, 400)

    const res = await jsonReq(srv.base, `${path}/password`, 'PUT', { password: 'new-pass-22' }, auth(token))
    assert.equal(res.status, 204)
    assert.equal(await res.text(), '')

    // 이전 토큰은 더 이상 통하지 않는다
    assert.equal((await jsonReq(srv.base, path, 'PUT', { config: validConfig() }, auth(token))).status, 401)
    assert.equal((await jsonReq(srv.base, `${path}/login`, 'POST', { password: ADMIN_PW })).status, 403)

    const login = await jsonReq(srv.base, `${path}/login`, 'POST', { password: 'new-pass-22' })
    assert.equal(login.status, 200)
    const fresh = (await login.json()).token
    assert.equal((await jsonReq(srv.base, path, 'PUT', { config: validConfig() }, auth(fresh))).status, 200)
  }))

test('토큰: 변조(만료·서명·주소)와 형식 오류는 401', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    const put = (/** @type {string} */ t) =>
      jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: validConfig() }, auth(t))
    assert.equal((await put(token)).status, 200)

    const [slug, exp, sig] = token.split('.')
    const tampered = [
      `${slug}.${Number(exp) + 1}.${sig}`, // 만료 연장
      `${slug}.${exp}.${sig.slice(0, -2)}AA`, // 서명 변조
      `${slug}.${exp}.`, // 서명 없음
      `${slug}.${exp}`,
      `${slug}.99999999999999.${sig}`,
      `kim-parx.${exp}.${sig}`,
      `${token}.extra`,
      '',
      'a.b.c',
    ]
    for (const t of tampered) assert.equal((await put(t)).status, 401, t)
  }))

test('토큰: 만료되면 401', () =>
  withServer(
    async (srv) => {
      const { token, expiresAt } = await createWedding(srv.base, 'kim-park')
      const put = () => jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: validConfig() }, auth(token))
      assert.equal((await put()).status, 200)
      await new Promise((r) => setTimeout(r, Math.max(0, expiresAt - Date.now()) + 30))
      assert.equal((await put()).status, 401)
    },
    { tokenTtlMs: 1000 },
  ))

test('토큰: 서명 키가 다르면(다른 서버) 통하지 않는다', async () => {
  const a = await start({ tokenSecret: 'secret-a' })
  const b = await start({ tokenSecret: 'secret-b' })
  try {
    const { token } = await createWedding(a.base, 'kim-park')
    await createWedding(b.base, 'kim-park')
    const res = await jsonReq(b.base, '/api/weddings/kim-park', 'PUT', { config: validConfig() }, auth(token))
    assert.equal(res.status, 401)
  } finally {
    await a.stop()
    await b.stop()
  }
})

test('청첩장 간 격리: A 의 토큰은 B 에 통하지 않고, A 의 방명록은 B 에서 보이지 않는다', () =>
  withServer(async (srv) => {
    const a = await createWedding(srv.base, 'wedding-a', { password: 'password-a' })
    const b = await createWedding(srv.base, 'wedding-b', { password: 'password-b' })
    const B = '/api/weddings/wedding-b'

    // A 의 토큰으로 B 를 조작할 수 없다
    assert.equal((await jsonReq(srv.base, B, 'PUT', { config: validConfig() }, auth(a.token))).status, 401)
    assert.equal((await jsonReq(srv.base, `${B}/password`, 'PUT', { password: 'hijacked-1' }, auth(a.token))).status, 401)
    assert.equal((await uploadPhoto(srv.base, 'wedding-b', a.token)).status, 401)
    assert.equal((await jsonReq(srv.base, B, 'DELETE', undefined, auth(a.token))).status, 401)
    // A 의 토큰에서 주소만 바꿔치기해도 서명이 맞지 않는다
    const forged = a.token.replace(/^wedding-a\./, 'wedding-b.')
    assert.equal((await jsonReq(srv.base, B, 'DELETE', undefined, auth(forged))).status, 401)
    // A 의 비밀번호로 B 에 로그인할 수 없다
    assert.equal((await jsonReq(srv.base, `${B}/login`, 'POST', { password: 'password-a' })).status, 403)
    assert.equal((await fetch(`${srv.base}${B}`)).status, 200, 'B 는 그대로 있다')

    // 방명록 격리
    const ga = await (await postGuest(srv.base, 'wedding-a', validGuest({ name: 'A하객' }))).json()
    const gb = await (await postGuest(srv.base, 'wedding-b', validGuest({ name: 'B하객' }))).json()
    const listA = await (await fetch(`${srv.base}/api/weddings/wedding-a/guests`)).json()
    const listB = await (await fetch(`${srv.base}${B}/guests`)).json()
    assert.deepEqual(listA.map((/** @type {any} */ g) => g.name), ['A하객'])
    assert.deepEqual(listB.map((/** @type {any} */ g) => g.name), ['B하객'])

    // A 의 글을 B 경로로 지울 수 없다 (B 주인 토큰·맞는 글 비밀번호여도 404)
    assert.equal((await jsonReq(srv.base, `${B}/guests/${ga.id}`, 'DELETE', undefined, auth(b.token))).status, 404)
    assert.equal((await jsonReq(srv.base, `${B}/guests/${ga.id}`, 'DELETE', { password: 'pass1234' })).status, 404)
    // A 의 토큰으로 B 의 글을 지울 수 없다 (주인이 아니므로 비밀번호 경로 → 400)
    assert.equal((await jsonReq(srv.base, `${B}/guests/${gb.id}`, 'DELETE', undefined, auth(a.token))).status, 400)
    assert.equal((await (await fetch(`${srv.base}${B}/guests`)).json()).length, 1)

    // 주인은 자기 청첩장의 글을 비밀번호 없이 지운다
    assert.equal((await jsonReq(srv.base, `${B}/guests/${gb.id}`, 'DELETE', undefined, auth(b.token))).status, 204)
    assert.equal((await (await fetch(`${srv.base}${B}/guests`)).json()).length, 0)
    assert.equal((await (await fetch(`${srv.base}/api/weddings/wedding-a/guests`)).json()).length, 1)
  }))

test('삭제: 방명록·사진까지 지워지고, 같은 주소로 다시 만들어도 예전 토큰은 통하지 않는다', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    const other = await createWedding(srv.base, 'lee-choi')
    await postGuest(srv.base, 'kim-park', validGuest())
    await postGuest(srv.base, 'lee-choi', validGuest())
    const photo = await (await uploadPhoto(srv.base, 'kim-park', token)).json()
    const otherPhoto = await (await uploadPhoto(srv.base, 'lee-choi', other.token)).json()
    assert.ok(existsSync(join(srv.dir, 'uploads', 'kim-park')))

    assert.equal((await jsonReq(srv.base, '/api/weddings/kim-park', 'DELETE')).status, 401)
    const del = await jsonReq(srv.base, '/api/weddings/kim-park', 'DELETE', undefined, auth(token))
    assert.equal(del.status, 204)

    assert.equal((await fetch(`${srv.base}/api/weddings/kim-park`)).status, 404)
    assert.equal((await fetch(`${srv.base}/api/weddings/kim-park/guests`)).status, 404)
    assert.equal((await fetch(`${srv.base}${photo.url}`)).status, 404)
    assert.ok(!existsSync(join(srv.dir, 'uploads', 'kim-park')), '사진 폴더가 지워진다')
    assert.equal(srv.app.db.count('kim-park'), 0)
    assert.equal(srv.app.db.photoCount('kim-park'), 0)
    assert.deepEqual(await (await fetch(`${srv.base}/api/weddings/kim-park/availability`)).json(), { available: true })

    // 다른 청첩장은 그대로
    assert.equal((await (await fetch(`${srv.base}/api/weddings/lee-choi/guests`)).json()).length, 1)
    assert.equal((await fetch(`${srv.base}${otherPhoto.url}`)).status, 200)

    // 같은 주소로 다시 만들면 새 청첩장이다: 방명록은 비어 있고 예전 토큰은 401
    await createWedding(srv.base, 'kim-park')
    assert.deepEqual(await (await fetch(`${srv.base}/api/weddings/kim-park/guests`)).json(), [])
    assert.equal((await jsonReq(srv.base, '/api/weddings/kim-park', 'DELETE', undefined, auth(token))).status, 401)
  }))

test('MAX_WEDDINGS 초과 → 503', () =>
  withServer(
    async (srv) => {
      await createWedding(srv.base, 'first-one')
      await createWedding(srv.base, 'second-one')
      const res = await jsonReq(srv.base, '/api/weddings', 'POST', { slug: 'third-one', password: ADMIN_PW, config: validConfig() })
      assert.equal(res.status, 503)
      assert.equal(typeof (await res.json()).error, 'string')
    },
    { maxWeddings: 2 },
  ))

test('청첩장 생성 한도: IP별, 검증에 실패한 요청은 차감하지 않는다', () =>
  withServer(
    async (srv) => {
      const post = (/** @type {string} */ slug, cfg = validConfig()) =>
        jsonReq(srv.base, '/api/weddings', 'POST', { slug, password: ADMIN_PW, config: cfg })
      for (let i = 0; i < 4; i++) assert.equal((await post('bad-config', validConfig({ durationMinutes: 1 }))).status, 400)
      assert.equal((await post('first-one')).status, 201)
      assert.equal((await post('first-one')).status, 409)
      assert.equal((await post('second-one')).status, 201)
      assert.equal((await post('third-one')).status, 429)
      assert.equal((await fetch(`${srv.base}/api/weddings/third-one`)).status, 404)
    },
    { createRateLimit: { windowMs: 60_000, max: 2 } },
  ))

test('ADMIN_TOKEN(운영자)은 모든 청첩장에 관리 권한을 가진다', () =>
  withServer(
    async (srv) => {
      await createWedding(srv.base, 'kim-park')
      const admin = auth('operator-secret-token')
      assert.equal((await jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: validConfig() }, admin)).status, 200)
      assert.equal((await jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: validConfig() }, auth('operator-secret-tokeN'))).status, 401)
      assert.equal((await jsonReq(srv.base, '/api/weddings/kim-park', 'DELETE', undefined, admin)).status, 204)
    },
    { adminToken: 'operator-secret-token' },
  ))

test('로그인 실패 한도: 동시에 몰아 보내도 한도만큼만 대입할 수 있다 (나머지는 429)', () =>
  withServer(async (srv) => {
    assert.equal(srv.app.config.loginRateLimit.max, 10, '기본값: 10분에 10회')
    await createWedding(srv.base, 'kim-park')
    const login = (/** @type {string} */ password) =>
      jsonReq(srv.base, '/api/weddings/kim-park/login', 'POST', { password })

    const wrong = Array.from({ length: 50 }, (_, i) => login(`guess-${i}`))
    // 429 가 하나라도 나왔다 = 자리 10개가 모두 (틀린) 시도로 찼다 → 뒤에 온 맞는 비밀번호도 검사받지 못한다.
    await Promise.any(wrong.map((p) => p.then((r) => (r.status === 429 ? r : Promise.reject(new Error('other'))))))
    const right = await login(ADMIN_PW)
    const statuses = (await Promise.all(wrong)).map((r) => r.status)

    assert.equal(statuses.filter((s) => s === 403).length, 10, '실제로 비밀번호를 검사받은 요청은 한도(10)까지')
    assert.equal(statuses.filter((s) => s === 429).length, 40)
    assert.equal(right.status, 429)
    assert.equal(srv.app.loginLimiter.inflight.size, 0, '진행 중 자리는 모두 반환된다')
  }))

test('로그인 실패 한도: 성공·400 은 자리를 차감하지 않고, 지나치게 긴 비밀번호는 실패로 센다', () =>
  withServer(
    async (srv) => {
      await createWedding(srv.base, 'kim-park')
      const login = (/** @type {any} */ password) =>
        jsonReq(srv.base, '/api/weddings/kim-park/login', 'POST', { password })

      assert.equal((await login('wrong-1')).status, 403)
      assert.equal((await login('wrong-2')).status, 403)
      // 한도(3) 미만의 실패 뒤: 성공은 몇 번이든(동시에 보내도) 자리를 쓰지 않는다
      for (let i = 0; i < 5; i++) assert.equal((await login(ADMIN_PW)).status, 200)
      const burst = await Promise.all(Array.from({ length: 8 }, () => login(ADMIN_PW)))
      assert.ok(burst.every((r) => r.status === 200 || r.status === 429))
      assert.ok(burst.some((r) => r.status === 200))
      for (let i = 0; i < 3; i++) assert.equal((await login('')).status, 400)
      assert.equal((await login(ADMIN_PW)).status, 200)
      assert.equal(srv.app.loginLimiter.inflight.size, 0)
      assert.equal(srv.app.loginSlugLimiter.inflight.size, 0)

      // 세 번째 실패(해시하지 않는 긴 입력)로 한도 도달
      assert.equal((await login('x'.repeat(2000))).status, 403)
      assert.equal((await login(ADMIN_PW)).status, 429)
    },
    { loginRateLimit: { windowMs: 60_000, max: 3 } },
  ))

test('로그인 실패 한도: 청첩장 단위 상한은 IP 를 바꿔 가며 오는 시도도 묶는다', () =>
  withServer(
    async (srv) => {
      await createWedding(srv.base, 'kim-park')
      await createWedding(srv.base, 'lee-choi')
      const login = (/** @type {string} */ slug, /** @type {string} */ ip, /** @type {string} */ password) =>
        jsonReq(srv.base, `/api/weddings/${slug}/login`, 'POST', { password }, { 'X-Real-IP': ip })

      // IP 마다 1번씩 → (IP, 청첩장) 한도에는 닿지 않지만 청첩장 한도(4)에 닿는다
      for (let i = 0; i < 4; i++) assert.equal((await login('kim-park', `203.0.113.${i + 1}`, 'wrong')).status, 403)
      assert.equal((await login('kim-park', '203.0.113.99', 'wrong')).status, 429)
      assert.equal((await login('kim-park', '203.0.113.99', ADMIN_PW)).status, 429)
      // 다른 청첩장은 영향 없음
      assert.equal((await login('lee-choi', '203.0.113.1', ADMIN_PW)).status, 200)
    },
    { trustProxy: true, loginRateLimit: { windowMs: 60_000, max: 3 }, loginSlugRateLimit: { windowMs: 60_000, max: 4 } },
  ))
