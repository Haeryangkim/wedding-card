// DB 마이그레이션(단일 청첩장 시절의 DB)과 재시작 후에도 유지되는 것들
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { validConfig, validGuest, postGuest, jsonReq, auth, createWedding, uploadPhoto, INDEX_HTML } from './helpers.js'

/** @param {string} dir @param {Record<string, any>} [overrides] */
async function boot(dir, overrides = {}) {
  writeFileSync(join(dir, 'index.html'), INDEX_HTML)
  const app = createApp({
    dbPath: join(dir, 'guestbook.db'),
    uploadDir: join(dir, 'uploads'),
    indexHtmlPath: join(dir, 'index.html'),
    logger: () => {},
    adminToken: null,
    tokenSecret: null,
    geocodeUrl: 'http://127.0.0.1:9/search',
    ...overrides,
  })
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', () => resolve(undefined)))
  const address = app.server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return { app, base: `http://127.0.0.1:${port}` }
}

test('예전(단일 청첩장) DB 로 시작해도 죽지 않고, 옛 방명록은 보존되지만 어떤 청첩장에도 노출되지 않는다', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wd-migrate-'))
  try {
    // 플랫폼 이전 스키마 그대로
    const old = new DatabaseSync(join(dir, 'guestbook.db'))
    old.exec(`
      CREATE TABLE guests (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, message TEXT NOT NULL,
        side TEXT NOT NULL CHECK (side IN ('groom','bride')), appearance TEXT NOT NULL,
        created_at INTEGER NOT NULL, pw_hash TEXT NOT NULL, pw_salt TEXT NOT NULL
      )`)
    old.exec('CREATE INDEX idx_guests_created ON guests (created_at)')
    old
      .prepare('INSERT INTO guests VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('old-1', '옛하객', '옛 메시지', 'groom', '{"skin":0,"hairStyle":0,"hairColor":0,"outfit":0,"outfitColor":0,"accessory":0}', 1, 'aa', 'bb')
    old.close()

    const first = await boot(dir)
    try {
      await createWedding(first.base, 'kim-park')
      assert.deepEqual(await (await fetch(`${first.base}/api/weddings/kim-park/guests`)).json(), [])
      assert.equal((await postGuest(first.base, 'kim-park', validGuest({ name: '새하객' }))).status, 201)
      const list = await (await fetch(`${first.base}/api/weddings/kim-park/guests`)).json()
      assert.deepEqual(list.map((/** @type {any} */ g) => g.name), ['새하객'])
      // 옛 글은 '_legacy' 에 붙어 남아 있다 — 이 이름은 주소 규칙에 맞지 않아 아무도 만들 수 없다
      assert.equal(first.app.db.count('_legacy'), 1)
      assert.equal((await fetch(`${first.base}/api/weddings/_legacy/guests`)).status, 404)
      const claim = await jsonReq(first.base, '/api/weddings', 'POST', { slug: '_legacy', password: 'admin-pass-1', config: validConfig() })
      assert.equal(claim.status, 400)
    } finally {
      await first.app.close()
    }

    // 다시 열어도(마이그레이션 재실행) 문제없다
    const second = await boot(dir)
    try {
      assert.equal((await (await fetch(`${second.base}/api/weddings/kim-park/guests`)).json()).length, 1)
      assert.equal(second.app.db.count('_legacy'), 1)
    } finally {
      await second.app.close()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('재시작해도 청첩장·사진·토큰이 유지된다 (서명 키는 DB 에 한 번 만들어 보관)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wd-restart-'))
  try {
    const first = await boot(dir)
    const { token } = await createWedding(first.base, 'kim-park')
    const { url } = await (await uploadPhoto(first.base, 'kim-park', token)).json()
    await first.app.close()

    const second = await boot(dir)
    try {
      assert.equal((await fetch(`${second.base}/api/weddings/kim-park`)).status, 200)
      assert.equal((await fetch(`${second.base}${url}`)).status, 200)
      const put = await jsonReq(second.base, '/api/weddings/kim-park', 'PUT', { config: validConfig() }, auth(token))
      assert.equal(put.status, 200, '재시작 전 토큰이 계속 유효하다')
    } finally {
      await second.app.close()
    }

    // TOKEN_SECRET 을 지정하면 DB 의 키 대신 그것을 쓴다 → 예전 토큰은 무효
    const third = await boot(dir, { tokenSecret: 'explicit-secret' })
    try {
      const put = await jsonReq(third.base, '/api/weddings/kim-park', 'PUT', { config: validConfig() }, auth(token))
      assert.equal(put.status, 401)
    } finally {
      await third.app.close()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('loadConfig: 새 환경변수와 기본값', () => {
  const d = loadConfig({})
  assert.equal(d.dbPath, './data/guestbook.db')
  assert.equal(d.uploadDir, 'data/uploads')
  assert.equal(d.maxWeddings, 2000)
  assert.equal(d.tokenTtlMs, 12 * 60 * 60 * 1000)
  assert.equal(d.tokenSecret, null)
  assert.equal(d.publicOrigin, null)
  assert.equal(d.indexHtmlUrl, 'http://web/index.html')
  assert.equal(d.indexHtmlPath, null)
  assert.equal(d.geocodeUrl, 'https://nominatim.openstreetmap.org/search')
  assert.ok(d.geocodeMinIntervalMs >= 1000, 'Nominatim 정책: 초당 1회 이하')
  assert.deepEqual(d.createRateLimit, { windowMs: 60 * 60 * 1000, max: 5 })
  assert.deepEqual(d.loginRateLimit, { windowMs: 10 * 60 * 1000, max: 10 })
  assert.ok(d.configBodyLimit > 32 * 1024)
  assert.deepEqual(d.loginSlugRateLimit, { windowMs: 10 * 60 * 1000, max: 50 })
  assert.equal(d.maxUploadBytes, 5 * 1024 * 1024 * 1024)
  assert.equal(d.photoOrphanGraceMs, 60 * 60 * 1000)
  assert.equal(loadConfig({ MAX_UPLOAD_BYTES: '1048576', PHOTO_ORPHAN_GRACE_MS: '0' }).maxUploadBytes, 1048576)
  assert.equal(loadConfig({ PHOTO_ORPHAN_GRACE_MS: '0' }).photoOrphanGraceMs, 0)

  const c = loadConfig({
    DB_PATH: '/data/guestbook.db',
    UPLOAD_DIR: '/srv/photos',
    TOKEN_SECRET: ' s3cret ',
    PUBLIC_ORIGIN: 'https://our.wedding/',
    INDEX_HTML_PATH: '/srv/index.html',
    GEOCODE_URL: 'http://127.0.0.1:1/search',
    MAX_WEDDINGS: '10',
    CREATE_RATE_MAX: '2',
    LOGIN_RATE_MAX: '3',
  })
  assert.equal(c.uploadDir, '/srv/photos')
  assert.equal(c.tokenSecret, 's3cret')
  assert.equal(c.publicOrigin, 'https://our.wedding')
  assert.equal(c.indexHtmlPath, '/srv/index.html')
  assert.equal(c.geocodeUrl, 'http://127.0.0.1:1/search')
  assert.equal(c.maxWeddings, 10)
  assert.equal(c.createRateLimit.max, 2)
  assert.equal(c.loginRateLimit.max, 3)
  assert.equal(loadConfig({ DB_PATH: '/data/guestbook.db' }).uploadDir, '/data/uploads')
})
