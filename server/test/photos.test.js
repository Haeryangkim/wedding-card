import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  start,
  validConfig,
  jsonReq,
  auth,
  createWedding,
  uploadPhoto,
  TINY_PNG,
  TINY_JPEG,
  TINY_WEBP,
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

/**
 * fetch 는 경로의 ".." 를 정리해 버리므로, 경로를 글자 그대로 보내는 원시 요청을 쓴다.
 * @param {number} port @param {string} path
 * @returns {Promise<{ status: number, body: Buffer }>}
 */
function rawGet(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      /** @type {Buffer[]} */
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    req.end()
  })
}

const URL_RE = /^\/uploads\/kim-park\/[0-9a-f]{32}\.(jpg|png|webp)$/

test('사진 업로드 → 201 { url }, 형식별 확장자, GET 으로 같은 바이트와 캐시 헤더', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    /** @type {[Buffer, string, string][]} */
    const kinds = [
      [TINY_PNG, 'image/png', 'png'],
      [TINY_JPEG, 'image/jpeg', 'jpg'],
      [TINY_WEBP, 'image/webp', 'webp'],
    ]
    /** @type {string[]} */
    const urls = []
    for (const [bytes, type, ext] of kinds) {
      const res = await uploadPhoto(srv.base, 'kim-park', token, bytes, type)
      assert.equal(res.status, 201, type)
      const json = await res.json()
      assert.deepEqual(Object.keys(json), ['url'])
      assert.match(json.url, URL_RE)
      assert.ok(json.url.endsWith(`.${ext}`))
      urls.push(json.url)

      const got = await fetch(`${srv.base}${json.url}`)
      assert.equal(got.status, 200)
      assert.equal(got.headers.get('content-type'), type)
      assert.equal(got.headers.get('cache-control'), 'public, max-age=31536000, immutable')
      assert.equal(got.headers.get('x-content-type-options'), 'nosniff')
      assert.equal(got.headers.get('content-length'), String(bytes.length))
      assert.ok(Buffer.from(await got.arrayBuffer()).equals(bytes))

      const head = await fetch(`${srv.base}${json.url}`, { method: 'HEAD' })
      assert.equal(head.status, 200)
      assert.equal(head.headers.get('content-type'), type)
    }
    assert.equal(new Set(urls).size, 3, '파일 이름은 매번 무작위')
    assert.equal(readdirSync(join(srv.dir, 'uploads', 'kim-park')).length, 3)
    // "image/png; charset=binary" 같은 파라미터가 붙어도 된다
    assert.equal((await uploadPhoto(srv.base, 'kim-park', token, TINY_PNG, 'image/png; foo=bar')).status, 201)
    assert.equal((await fetch(`${srv.base}${urls[0]}`, { method: 'POST' })).status, 405)
  }))

test('사진 업로드: 인증 필요(401), 없는 청첩장 404', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    const noAuth = await fetch(`${srv.base}/api/weddings/kim-park/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: TINY_PNG,
    })
    assert.equal(noAuth.status, 401)
    assert.equal((await uploadPhoto(srv.base, 'kim-park', 'bad-token')).status, 401)
    assert.equal((await uploadPhoto(srv.base, 'nobody-here', token)).status, 404)
    assert.ok(!existsSync(join(srv.dir, 'uploads', 'kim-park')))
  }))

test('사진 업로드: 헤더가 아니라 매직 바이트로 확인한다 (불일치 400, 미지원 형식 415, 빈 본문 400)', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    const up = (/** @type {Buffer} */ bytes, /** @type {string} */ type) => uploadPhoto(srv.base, 'kim-park', token, bytes, type)

    assert.equal((await up(Buffer.from('<html><script>alert(1)</script></html>'), 'image/png')).status, 400)
    assert.equal((await up(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/jpeg')).status, 400)
    assert.equal((await up(TINY_PNG, 'image/jpeg')).status, 400, 'PNG 바이트를 JPEG 이라고 보냄')
    assert.equal((await up(TINY_JPEG, 'image/webp')).status, 400)
    assert.equal((await up(Buffer.from('RIFF....WAVEfmt '), 'image/webp')).status, 400, 'RIFF 지만 WEBP 가 아님')
    assert.equal((await up(Buffer.alloc(0), 'image/png')).status, 400)
    assert.equal((await up(Buffer.from([0x89, 0x50]), 'image/png')).status, 400, '머리 바이트가 잘림')

    for (const type of ['image/gif', 'image/svg+xml', 'text/html', 'application/octet-stream', 'application/json']) {
      const res = await up(TINY_PNG, type)
      assert.equal(res.status, 415, type)
      assert.equal(typeof (await res.json()).error, 'string')
    }
    assert.equal(srv.app.db.photoCount('kim-park'), 0)
    assert.ok(!existsSync(join(srv.dir, 'uploads', 'kim-park')), '거절된 업로드는 파일을 남기지 않는다')
  }))

test('사진 업로드: 장당 2MB 초과 → 413 (Content-Length 가 있든, 스트리밍이든)', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    const limit = 2 * 1024 * 1024
    const png = (/** @type {number} */ size) => Buffer.concat([TINY_PNG, Buffer.alloc(size - TINY_PNG.length)])

    // 정확히 한도까지는 허용
    assert.equal((await uploadPhoto(srv.base, 'kim-park', token, png(limit))).status, 201)
    // Content-Length 로 미리 거절
    const over = await uploadPhoto(srv.base, 'kim-park', token, png(limit + 1))
    assert.equal(over.status, 413)
    assert.equal(typeof (await over.json()).error, 'string')

    // Content-Length 없는 청크 전송: 스트리밍 중 상한에서 잘린다
    const big = png(limit + 64 * 1024)
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < big.length; i += 64 * 1024) controller.enqueue(big.subarray(i, i + 64 * 1024))
        controller.close()
      },
    })
    const chunked = await fetch(`${srv.base}/api/weddings/kim-park/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png', ...auth(token) },
      body: stream,
      // @ts-ignore Node fetch 의 스트림 본문 옵션
      duplex: 'half',
    })
    assert.equal(chunked.status, 413)
    assert.equal(srv.app.db.photoCount('kim-park'), 1)
  }))

test('사진 수 상한 → 409, 지우면 다시 올릴 수 있다', () =>
  withServer(
    async (srv) => {
      const { token } = await createWedding(srv.base, 'kim-park')
      const first = await (await uploadPhoto(srv.base, 'kim-park', token)).json()
      assert.equal((await uploadPhoto(srv.base, 'kim-park', token)).status, 201)
      const full = await uploadPhoto(srv.base, 'kim-park', token)
      assert.equal(full.status, 409)
      assert.equal(typeof (await full.json()).error, 'string')

      const file = first.url.split('/').pop()
      assert.equal((await jsonReq(srv.base, `/api/weddings/kim-park/photos/${file}`, 'DELETE', undefined, auth(token))).status, 204)
      assert.equal((await uploadPhoto(srv.base, 'kim-park', token)).status, 201)
    },
    { maxPhotosPerWedding: 2 },
  ))

test('사진 업로드 한도: IP별 429', () =>
  withServer(
    async (srv) => {
      const { token } = await createWedding(srv.base, 'kim-park')
      // 거절된 업로드는 차감하지 않는다
      assert.equal((await uploadPhoto(srv.base, 'kim-park', token, Buffer.from('nope'), 'image/png')).status, 400)
      assert.equal((await uploadPhoto(srv.base, 'kim-park', token)).status, 201)
      assert.equal((await uploadPhoto(srv.base, 'kim-park', token)).status, 201)
      assert.equal((await uploadPhoto(srv.base, 'kim-park', token)).status, 429)
    },
    { photoRateLimit: { windowMs: 60_000, max: 2 } },
  ))

test('사진 삭제: 파일과 행이 지워진다 (인증 필요, 없는 파일 404)', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    const other = await createWedding(srv.base, 'lee-choi')
    const { url } = await (await uploadPhoto(srv.base, 'kim-park', token)).json()
    const file = url.split('/').pop()
    const path = `/api/weddings/kim-park/photos/${file}`

    assert.equal((await jsonReq(srv.base, path, 'DELETE')).status, 401)
    assert.equal((await jsonReq(srv.base, path, 'DELETE', undefined, auth(other.token))).status, 401)
    // 다른 청첩장 주인이 자기 경로로 남의 파일을 지울 수 없다
    assert.equal((await jsonReq(srv.base, `/api/weddings/lee-choi/photos/${file}`, 'DELETE', undefined, auth(other.token))).status, 404)
    assert.equal((await fetch(`${srv.base}${url}`)).status, 200)

    assert.equal((await jsonReq(srv.base, path, 'DELETE', undefined, auth(token))).status, 204)
    assert.equal((await fetch(`${srv.base}${url}`)).status, 404)
    assert.ok(!existsSync(join(srv.dir, 'uploads', 'kim-park', file)))
    assert.equal((await jsonReq(srv.base, path, 'DELETE', undefined, auth(token))).status, 404)
    for (const bad of ['..', '%2e%2e%2ftest.db', 'photo.png', `${'a'.repeat(32)}.gif`]) {
      assert.equal((await jsonReq(srv.base, `/api/weddings/kim-park/photos/${bad}`, 'DELETE', undefined, auth(token))).status, 404, bad)
    }
  }))

test('/uploads 경로 탈출 시도는 모두 404 이고 다른 파일을 내보내지 않는다', () =>
  withServer(async (srv) => {
    const { token } = await createWedding(srv.base, 'kim-park')
    await createWedding(srv.base, 'lee-choi')
    const { url } = await (await uploadPhoto(srv.base, 'kim-park', token)).json()
    const file = url.split('/').pop()
    // 업로드 폴더 안팎에 "유출되면 안 되는" 파일을 둔다
    writeFileSync(join(srv.dir, 'secret.txt'), 'TOP-SECRET')
    writeFileSync(join(srv.dir, 'uploads', 'kim-park', 'notes.txt'), 'TOP-SECRET')
    writeFileSync(join(srv.dir, 'uploads', 'kim-park', `${'b'.repeat(32)}.png`), 'TOP-SECRET') // DB 에 없는 파일

    const attempts = [
      '/uploads/../secret.txt',
      '/uploads/kim-park/../../secret.txt',
      '/uploads/kim-park/..%2f..%2fsecret.txt',
      '/uploads/kim-park/%2e%2e%2f%2e%2e%2fsecret.txt',
      '/uploads/%2e%2e/secret.txt',
      '/uploads/..%2fsecret.txt',
      '/uploads/kim-park/..',
      '/uploads/kim-park/%2e%2e',
      '/uploads/kim-park/..\\..\\secret.txt',
      '/uploads/kim-park/%5c..%5csecret.txt',
      '/uploads/kim-park/notes.txt',
      `/uploads/kim-park/${'b'.repeat(32)}.png`,
      `/uploads/kim-park/${file}%00.txt`,
      `/uploads/kim-park/${file}/`,
      `/uploads/kim-park/${file}/extra`,
      `/uploads/kim-park/./${file}`,
      `/uploads/kim-park//${file}`,
      `/uploads//kim-park/${file}`,
      `/uploads/lee-choi/${file}`, // 다른 청첩장 경로로 요청
      `/uploads/lee-choi/..%2fkim-park%2f${file}`,
      `/uploads/KIM-PARK/${file}`,
      `/uploads/kim-park/${file.toUpperCase()}`,
      '/uploads/kim-park/test.db',
      '/uploads/kim-park',
      '/uploads/',
      '/uploads',
      '/uploads/%zz/x.png',
      '//uploads/kim-park/x.png',
    ]
    for (const path of attempts) {
      const res = await rawGet(srv.port, path)
      assert.equal(res.status, 404, path)
      assert.ok(!res.body.toString().includes('TOP-SECRET'), path)
    }
    // 정상 경로는 여전히 열린다
    assert.equal((await rawGet(srv.port, url)).status, 200)
    // 쿼리스트링이 붙어도 같은 파일
    assert.equal((await rawGet(srv.port, `${url}?v=1`)).status, 200)
  }))

test('config 의 사진 경로는 이 청첩장에 실제로 올라온 파일이어야 한다', () =>
  withServer(async (srv) => {
    const a = await createWedding(srv.base, 'kim-park')
    const b = await createWedding(srv.base, 'lee-choi')
    const mine = (await (await uploadPhoto(srv.base, 'kim-park', a.token)).json()).url
    const mine2 = (await (await uploadPhoto(srv.base, 'kim-park', a.token, TINY_JPEG, 'image/jpeg')).json()).url
    const theirs = (await (await uploadPhoto(srv.base, 'lee-choi', b.token)).json()).url
    const put = (/** @type {any} */ over) =>
      jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: validConfig(over) }, auth(a.token))

    const ok = await put({ coverImage: mine, gallery: [mine, mine2] })
    assert.equal(ok.status, 200)
    const record = await ok.json()
    assert.equal(record.config.coverImage, mine)
    assert.deepEqual(record.config.gallery, [mine, mine2])

    assert.equal((await put({ gallery: [theirs] })).status, 400, '다른 청첩장의 사진')
    assert.equal((await put({ coverImage: theirs })).status, 400)
    assert.equal((await put({ gallery: [`http://127.0.0.1${mine}`] })).status, 400, '절대 URL 은 받지 않는다')
    assert.equal((await put({ gallery: Array.from({ length: 25 }, () => mine) })).status, 400, 'galleryMax 24')

    // 사진을 지워도 config 는 서버가 고치지 않는다(호출 측의 일) → 지운 경로가 남은 config 를 다시 저장하면 400
    const file = mine2.split('/').pop()
    assert.equal((await jsonReq(srv.base, `/api/weddings/kim-park/photos/${file}`, 'DELETE', undefined, auth(a.token))).status, 204)
    const still = await (await fetch(`${srv.base}/api/weddings/kim-park`)).json()
    assert.deepEqual(still.config.gallery, [mine, mine2])
    assert.equal((await put({ coverImage: mine, gallery: [mine, mine2] })).status, 400)
    assert.equal((await put({ coverImage: mine, gallery: [mine] })).status, 200)

    // 만들 때는 아직 사진이 없으므로 사진 경로를 넣을 수 없다
    const create = await jsonReq(srv.base, '/api/weddings', 'POST', {
      slug: 'new-couple',
      password: 'admin-pass-1',
      config: validConfig({ gallery: [`/uploads/new-couple/${'c'.repeat(32)}.jpg`] }),
    })
    assert.equal(create.status, 400)
  }))

/** @param {string} url "/uploads/<slug>/<file>" → 파일 이름 */
const fileOf = (url) => /** @type {string} */ (url.split('/').pop())

test('내용 저장(PUT) 때 참조되지 않는 오래된 업로드는 정리된다 (참조 중인 사진은 유지, 파일도 삭제)', () =>
  withServer(
    async (srv) => {
      const { token } = await createWedding(srv.base, 'kim-park')
      const up = async () => (await (await uploadPhoto(srv.base, 'kim-park', token)).json()).url
      const cover = await up()
      const inGallery = await up()
      const orphanA = await up()
      const orphanB = await up()
      const dir = join(srv.dir, 'uploads', 'kim-park')
      assert.equal(readdirSync(dir).length, 4)

      const put = await jsonReq(
        srv.base,
        '/api/weddings/kim-park',
        'PUT',
        { config: validConfig({ coverImage: cover, gallery: [inGallery] }) },
        auth(token),
      )
      assert.equal(put.status, 200)
      assert.deepEqual(srv.app.db.listPhotos('kim-park').sort(), [fileOf(cover), fileOf(inGallery)].sort())
      assert.deepEqual(readdirSync(dir).sort(), [fileOf(cover), fileOf(inGallery)].sort())
      assert.equal((await fetch(`${srv.base}${cover}`)).status, 200)
      assert.equal((await fetch(`${srv.base}${orphanA}`)).status, 404)
      assert.equal((await fetch(`${srv.base}${orphanB}`)).status, 404)
    },
    { photoOrphanGraceMs: 0 },
  ))

test('유예 시간 안의 업로드는 저장 때 정리하지 않는다 (다른 탭에서 편집 중일 수 있다)', () =>
  withServer(async (srv) => {
    // 기본 유예: 1시간
    const { token } = await createWedding(srv.base, 'kim-park')
    const fresh = (await (await uploadPhoto(srv.base, 'kim-park', token)).json()).url
    const put = await jsonReq(srv.base, '/api/weddings/kim-park', 'PUT', { config: validConfig() }, auth(token))
    assert.equal(put.status, 200)
    assert.equal(srv.app.db.photoCount('kim-park'), 1)
    assert.equal((await fetch(`${srv.base}${fresh}`)).status, 200)
  }))

test('사진 수 상한: 저장되지 않고 버려진 업로드 30장이 자리를 영영 차지하지 않는다 (31번째 업로드 성공)', () =>
  withServer(
    async (srv) => {
      const { token } = await createWedding(srv.base, 'kim-park')
      assert.equal(srv.app.config.maxPhotosPerWedding, 30)
      /** @type {string[]} */
      const urls = []
      for (let i = 0; i < 30; i++) {
        const res = await uploadPhoto(srv.base, 'kim-park', token)
        assert.equal(res.status, 201, `upload ${i}`)
        urls.push((await res.json()).url)
      }
      // 아직 유예 시간 안: 상한 그대로
      assert.equal((await uploadPhoto(srv.base, 'kim-park', token)).status, 409)

      // 2장만 내용에 저장하고(이때는 유예 중이라 정리되지 않는다), 나머지 28장은 버려진 채 시간이 지난다
      const put = await jsonReq(
        srv.base,
        '/api/weddings/kim-park',
        'PUT',
        { config: validConfig({ coverImage: urls[0], gallery: [urls[1]] }) },
        auth(token),
      )
      assert.equal(put.status, 200)
      assert.equal(srv.app.db.photoCount('kim-park'), 30)
      srv.app.config.photoOrphanGraceMs = 0

      const res = await uploadPhoto(srv.base, 'kim-park', token)
      assert.equal(res.status, 201, '버려진 업로드를 정리하고 받아 준다')
      const added = (await res.json()).url
      assert.deepEqual(
        srv.app.db.listPhotos('kim-park').sort(),
        [fileOf(urls[0]), fileOf(urls[1]), fileOf(added)].sort(),
        '참조 중인 2장 + 새 사진만 남는다',
      )
      assert.equal((await fetch(`${srv.base}${urls[0]}`)).status, 200)
      assert.equal((await fetch(`${srv.base}${urls[5]}`)).status, 404)
    },
    { photoOrphanGraceMs: 60 * 60 * 1000 },
  ))

test('사진 수 상한: 전부 내용에서 쓰고 있으면 정리할 것이 없어 409', () =>
  withServer(
    async (srv) => {
      const { token } = await createWedding(srv.base, 'kim-park')
      const a = (await (await uploadPhoto(srv.base, 'kim-park', token)).json()).url
      const b = (await (await uploadPhoto(srv.base, 'kim-park', token)).json()).url
      const put = await jsonReq(
        srv.base,
        '/api/weddings/kim-park',
        'PUT',
        { config: validConfig({ coverImage: a, gallery: [b] }) },
        auth(token),
      )
      assert.equal(put.status, 200)
      assert.equal((await uploadPhoto(srv.base, 'kim-park', token)).status, 409)
      assert.equal(srv.app.db.photoCount('kim-park'), 2)
    },
    { maxPhotosPerWedding: 2, photoOrphanGraceMs: 0 },
  ))

test('서비스 전체 사진 용량 상한(MAX_UPLOAD_BYTES) → 507, 사진이나 청첩장을 지우면 다시 올릴 수 있다', () =>
  withServer(
    async (srv) => {
      const a = await createWedding(srv.base, 'kim-park')
      const b = await createWedding(srv.base, 'lee-choi')
      const first = await (await uploadPhoto(srv.base, 'kim-park', a.token)).json()
      assert.equal((await uploadPhoto(srv.base, 'lee-choi', b.token)).status, 201)
      assert.equal(srv.app.db.photoBytesTotal(), TINY_PNG.length * 2)

      // 상한은 청첩장을 가리지 않는 전체 합계다
      for (const [slug, token] of [['kim-park', a.token], ['lee-choi', b.token]]) {
        const res = await uploadPhoto(srv.base, slug, token)
        assert.equal(res.status, 507, slug)
        assert.equal(typeof (await res.json()).error, 'string')
      }
      // Content-Length 없는 청크 전송도 본문을 받은 뒤 다시 확인한다
      const chunked = await fetch(`${srv.base}/api/weddings/kim-park/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png', ...auth(a.token) },
        body: new ReadableStream({
          start(c) {
            c.enqueue(TINY_PNG)
            c.close()
          },
        }),
        // @ts-ignore Node fetch 의 스트림 본문 옵션
        duplex: 'half',
      })
      assert.equal(chunked.status, 507)
      assert.equal(srv.app.db.photoBytesTotal(), TINY_PNG.length * 2)

      // 사진 삭제 → 자리가 난다
      const del = await jsonReq(srv.base, `/api/weddings/kim-park/photos/${fileOf(first.url)}`, 'DELETE', undefined, auth(a.token))
      assert.equal(del.status, 204)
      assert.equal((await uploadPhoto(srv.base, 'kim-park', a.token)).status, 201)
      assert.equal((await uploadPhoto(srv.base, 'kim-park', a.token)).status, 507)
      // 청첩장 삭제 → 자리가 난다
      assert.equal((await jsonReq(srv.base, '/api/weddings/lee-choi', 'DELETE', undefined, auth(b.token))).status, 204)
      assert.equal((await uploadPhoto(srv.base, 'kim-park', a.token)).status, 201)
    },
    { maxUploadBytes: TINY_PNG.length * 2 + 10 },
  ))

/**
 * 본문의 마지막 1바이트를 남겨 둔 채 멈춰 있는 업로드. finish() 가 마지막 바이트를 보내고 응답 상태를 돌려준다.
 * @param {number} port @param {string} slug @param {string} token
 */
async function heldUpload(port, slug, token) {
  const sock = net.connect(port, '127.0.0.1')
  await new Promise((resolve, reject) => sock.once('connect', resolve).once('error', reject))
  /** @type {Buffer[]} */
  const chunks = []
  sock.on('data', (c) => chunks.push(c))
  const done = new Promise((resolve) => sock.once('close', resolve))
  sock.write(
    `POST /api/weddings/${slug}/photos HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer ${token}\r\n` +
      `Content-Type: image/png\r\nContent-Length: ${TINY_PNG.length}\r\nConnection: close\r\n\r\n`,
  )
  await new Promise((resolve) => sock.write(TINY_PNG.subarray(0, TINY_PNG.length - 1), () => resolve(undefined)))
  // 서버가 헤더를 받고 권한 확인을 지나 본문을 기다리는 상태가 될 시간을 준다.
  await new Promise((resolve) => setTimeout(resolve, 100))
  return {
    async finish() {
      sock.write(TINY_PNG.subarray(TINY_PNG.length - 1))
      await done
      const head = Buffer.concat(chunks).toString('latin1')
      return Number(/^HTTP\/1\.1 (\d{3})/.exec(head)?.[1] ?? 0)
    },
  }
}

test('업로드 권한은 본문을 받은 뒤 다시 확인한다: 삭제 후 다른 사람이 다시 만든 주소에 예전 업로드가 들어가지 않는다', () =>
  withServer(async (srv) => {
    const old = await createWedding(srv.base, 'nice-slug', { password: 'old-owner-pw' })
    const held = await heldUpload(srv.port, 'nice-slug', old.token)

    assert.equal((await jsonReq(srv.base, '/api/weddings/nice-slug', 'DELETE', undefined, auth(old.token))).status, 204)
    const fresh = await createWedding(srv.base, 'nice-slug', { password: 'new-owner-pw' })
    assert.equal((await uploadPhoto(srv.base, 'nice-slug', old.token)).status, 401, '예전 토큰은 이미 무효')

    assert.equal(await held.finish(), 401)
    assert.equal(srv.app.db.photoCount('nice-slug'), 0)
    assert.ok(!existsSync(join(srv.dir, 'uploads', 'nice-slug')), '파일도 남지 않는다')
    // 새 주인은 정상적으로 올릴 수 있다
    assert.equal((await uploadPhoto(srv.base, 'nice-slug', fresh.token)).status, 201)
  }))

test('업로드 권한은 본문을 받은 뒤 다시 확인한다: 업로드 도중 비밀번호가 바뀌면 401, 청첩장이 지워지면 404', () =>
  withServer(async (srv) => {
    const a = await createWedding(srv.base, 'kim-park')
    const held = await heldUpload(srv.port, 'kim-park', a.token)
    const change = await jsonReq(srv.base, '/api/weddings/kim-park/password', 'PUT', { password: 'brand-new-pw' }, auth(a.token))
    assert.equal(change.status, 204)
    assert.equal(await held.finish(), 401)
    assert.equal(srv.app.db.photoCount('kim-park'), 0)

    const b = await createWedding(srv.base, 'lee-choi')
    const held2 = await heldUpload(srv.port, 'lee-choi', b.token)
    assert.equal((await jsonReq(srv.base, '/api/weddings/lee-choi', 'DELETE', undefined, auth(b.token))).status, 204)
    assert.equal(await held2.finish(), 404)
  }))
