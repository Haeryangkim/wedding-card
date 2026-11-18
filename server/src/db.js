/**
 * node:sqlite 래퍼. WAL 모드.
 *   weddings : 청첩장 인스턴스 (slug, config JSON, 관리 비밀번호 해시)
 *   guests   : 청첩장별 방명록 (createdAt(ms) 오름차순이 기본 정렬)
 *   photos   : 청첩장별 업로드 사진 파일 목록
 *   meta     : 서버 내부 값 (토큰 서명 키 등)
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * @typedef {object} Appearance
 * @property {number} skin
 * @property {number} hairStyle
 * @property {number} hairColor
 * @property {number} outfit
 * @property {number} outfitColor
 * @property {number} accessory
 * @property {'pixel' | 'maple' | 'forest' | 'doll'} [style] 하객이 고른 그림체 (없으면 기본 픽셀 — 예전 글)
 */

/**
 * @typedef {object} GuestEntry
 * @property {string} id
 * @property {string} name
 * @property {string} message
 * @property {'groom' | 'bride'} side
 * @property {Appearance} appearance
 * @property {number} createdAt
 */

/**
 * @typedef {object} NewGuest
 * @property {string} name
 * @property {string} message
 * @property {'groom' | 'bride'} side
 * @property {Appearance} appearance
 * @property {string} password
 */

/**
 * @typedef {object} WeddingRecord
 * @property {string} slug
 * @property {any} config
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * 플랫폼 이전(단일 청첩장) DB 의 방명록이 붙는 자리. SLUG_PATTERN 에 맞지 않는 값이라
 * 어떤 청첩장도 이 이름을 가질 수 없다(= 옛 글은 보존되지만 노출되지 않는다).
 */
export const LEGACY_SLUG = '_legacy'

/**
 * @param {string} dbPath ':memory:' 또는 파일 경로
 */
export function openDb(dbPath) {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true })
  }
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')

  db.exec(`
    CREATE TABLE IF NOT EXISTS weddings (
      slug       TEXT PRIMARY KEY,
      config     TEXT NOT NULL,
      pw_hash    TEXT NOT NULL,
      pw_salt    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS guests (
      id           TEXT PRIMARY KEY,
      wedding_slug TEXT NOT NULL,
      name         TEXT NOT NULL,
      message      TEXT NOT NULL,
      side         TEXT NOT NULL CHECK (side IN ('groom','bride')),
      appearance   TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      pw_hash      TEXT NOT NULL,
      pw_salt      TEXT NOT NULL
    )
  `)
  // 마이그레이션: 단일 청첩장 시절의 guests 테이블에는 wedding_slug 가 없다.
  const guestCols = /** @type {any[]} */ (db.prepare('PRAGMA table_info(guests)').all())
  if (!guestCols.some((c) => c.name === 'wedding_slug')) {
    db.exec(`ALTER TABLE guests ADD COLUMN wedding_slug TEXT NOT NULL DEFAULT '${LEGACY_SLUG}'`)
  }
  db.exec('DROP INDEX IF EXISTS idx_guests_created')
  db.exec('CREATE INDEX IF NOT EXISTS idx_guests_wedding ON guests (wedding_slug, created_at)')
  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      file         TEXT PRIMARY KEY,
      wedding_slug TEXT NOT NULL,
      bytes        INTEGER NOT NULL,
      created_at   INTEGER NOT NULL
    )
  `)
  db.exec('CREATE INDEX IF NOT EXISTS idx_photos_wedding ON photos (wedding_slug, created_at)')
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')

  const stmts = {
    getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),

    weddingCount: db.prepare('SELECT COUNT(*) AS n FROM weddings'),
    weddingExists: db.prepare('SELECT 1 AS x FROM weddings WHERE slug = ?'),
    getWedding: db.prepare('SELECT slug, config, created_at, updated_at FROM weddings WHERE slug = ?'),
    getWeddingSecret: db.prepare('SELECT pw_hash, pw_salt FROM weddings WHERE slug = ?'),
    insertWedding: db.prepare(
      `INSERT OR IGNORE INTO weddings (slug, config, pw_hash, pw_salt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ),
    updateWeddingConfig: db.prepare('UPDATE weddings SET config = ?, updated_at = ? WHERE slug = ?'),
    updateWeddingPassword: db.prepare('UPDATE weddings SET pw_hash = ?, pw_salt = ?, updated_at = ? WHERE slug = ?'),
    deleteWedding: db.prepare('DELETE FROM weddings WHERE slug = ?'),

    insertGuest: db.prepare(
      `INSERT INTO guests (id, wedding_slug, name, message, side, appearance, created_at, pw_hash, pw_salt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    listGuests: db.prepare(
      `SELECT id, name, message, side, appearance, created_at FROM guests
       WHERE wedding_slug = ? ORDER BY created_at ASC, id ASC`,
    ),
    countGuests: db.prepare('SELECT COUNT(*) AS n FROM guests WHERE wedding_slug = ?'),
    findGuestSecret: db.prepare('SELECT pw_hash, pw_salt FROM guests WHERE wedding_slug = ? AND id = ?'),
    deleteGuest: db.prepare('DELETE FROM guests WHERE wedding_slug = ? AND id = ?'),
    deleteGuestsOf: db.prepare('DELETE FROM guests WHERE wedding_slug = ?'),

    insertPhoto: db.prepare('INSERT INTO photos (file, wedding_slug, bytes, created_at) VALUES (?, ?, ?, ?)'),
    countPhotos: db.prepare('SELECT COUNT(*) AS n FROM photos WHERE wedding_slug = ?'),
    hasPhoto: db.prepare('SELECT 1 AS x FROM photos WHERE wedding_slug = ? AND file = ?'),
    listPhotos: db.prepare('SELECT file FROM photos WHERE wedding_slug = ? ORDER BY created_at ASC, file ASC'),
    listStalePhotos: db.prepare(
      'SELECT file FROM photos WHERE wedding_slug = ? AND created_at <= ? ORDER BY created_at ASC, file ASC',
    ),
    photoBytesTotal: db.prepare('SELECT COALESCE(SUM(bytes), 0) AS n FROM photos'),
    deletePhoto: db.prepare('DELETE FROM photos WHERE wedding_slug = ? AND file = ?'),
    deletePhotosOf: db.prepare('DELETE FROM photos WHERE wedding_slug = ?'),
  }

  /** @param {any} row @returns {GuestEntry} */
  function rowToEntry(row) {
    return {
      id: row.id,
      name: row.name,
      message: row.message,
      side: row.side,
      appearance: JSON.parse(row.appearance),
      createdAt: row.created_at,
    }
  }

  /** @param {any} row @returns {WeddingRecord} */
  function rowToWedding(row) {
    return { slug: row.slug, config: JSON.parse(row.config), createdAt: row.created_at, updatedAt: row.updated_at }
  }

  return {
    // ---------- meta ----------
    /** @param {string} key @returns {string | undefined} */
    getMeta(key) {
      return /** @type {any} */ (stmts.getMeta.get(key))?.value
    },
    /** @param {string} key @param {string} value */
    setMeta(key, value) {
      stmts.setMeta.run(key, value)
    },

    // ---------- weddings ----------
    /** @returns {number} */
    weddingCount() {
      return /** @type {any} */ (stmts.weddingCount.get()).n
    },
    /** @param {string} slug */
    weddingExists(slug) {
      return stmts.weddingExists.get(slug) !== undefined
    },
    /** @param {string} slug @returns {WeddingRecord | null} 비밀번호 정보는 절대 포함하지 않는다 */
    getWedding(slug) {
      const row = stmts.getWedding.get(slug)
      return row ? rowToWedding(row) : null
    },
    /** @param {string} slug @returns {{ pw_hash: string, pw_salt: string } | undefined} */
    getWeddingSecret(slug) {
      return /** @type {any} */ (stmts.getWeddingSecret.get(slug))
    },
    /**
     * @param {string} slug @param {any} config @param {{ hash: string, salt: string }} secret
     * @returns {WeddingRecord | null} 이미 있는 slug 면 null
     */
    insertWedding(slug, config, secret) {
      const now = Date.now()
      const r = stmts.insertWedding.run(slug, JSON.stringify(config), secret.hash, secret.salt, now, now)
      if (r.changes === 0) return null
      return { slug, config, createdAt: now, updatedAt: now }
    },
    /** @param {string} slug @param {any} config @returns {WeddingRecord | null} */
    updateWeddingConfig(slug, config) {
      const r = stmts.updateWeddingConfig.run(JSON.stringify(config), Date.now(), slug)
      return r.changes > 0 ? this.getWedding(slug) : null
    },
    /** @param {string} slug @param {{ hash: string, salt: string }} secret */
    updateWeddingPassword(slug, secret) {
      return stmts.updateWeddingPassword.run(secret.hash, secret.salt, Date.now(), slug).changes > 0
    },
    /** 청첩장 + 방명록 + 사진 행을 한 트랜잭션으로 지운다(사진 파일은 호출 측에서 삭제). @param {string} slug */
    deleteWedding(slug) {
      db.exec('BEGIN')
      try {
        stmts.deleteGuestsOf.run(slug)
        stmts.deletePhotosOf.run(slug)
        const r = stmts.deleteWedding.run(slug)
        db.exec('COMMIT')
        return r.changes > 0
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },

    // ---------- guests ----------
    /** @param {string} slug @returns {GuestEntry[]} */
    list(slug) {
      return stmts.listGuests.all(slug).map(rowToEntry)
    },
    /** @param {string} slug @returns {number} */
    count(slug) {
      return /** @type {any} */ (stmts.countGuests.get(slug)).n
    },
    /**
     * @param {string} slug
     * @param {NewGuest} input
     * @param {{ hash: string, salt: string }} secret
     * @returns {GuestEntry}
     */
    insert(slug, input, secret) {
      const entry = {
        id: randomUUID(),
        name: input.name,
        message: input.message,
        side: input.side,
        appearance: input.appearance,
        createdAt: Date.now(),
      }
      stmts.insertGuest.run(
        entry.id,
        slug,
        entry.name,
        entry.message,
        entry.side,
        JSON.stringify(entry.appearance),
        entry.createdAt,
        secret.hash,
        secret.salt,
      )
      return entry
    },
    /**
     * @param {string} slug @param {string} id
     * @returns {{ pw_hash: string, pw_salt: string } | undefined}
     */
    findSecret(slug, id) {
      return /** @type {any} */ (stmts.findGuestSecret.get(slug, id))
    },
    /** @param {string} slug @param {string} id @returns {boolean} 삭제된 행이 있으면 true */
    delete(slug, id) {
      return stmts.deleteGuest.run(slug, id).changes > 0
    },

    // ---------- photos ----------
    /** @param {string} slug @param {string} file @param {number} bytes */
    addPhoto(slug, file, bytes) {
      stmts.insertPhoto.run(file, slug, bytes, Date.now())
    },
    /** @param {string} slug @returns {number} */
    photoCount(slug) {
      return /** @type {any} */ (stmts.countPhotos.get(slug)).n
    },
    /** @param {string} slug @param {string} file */
    hasPhoto(slug, file) {
      return stmts.hasPhoto.get(slug, file) !== undefined
    },
    /** @param {string} slug @returns {string[]} */
    listPhotos(slug) {
      return stmts.listPhotos.all(slug).map((r) => /** @type {any} */ (r).file)
    },
    /** 만든 지 cutoff(epoch ms) 이전인 사진 파일 이름. @param {string} slug @param {number} cutoff @returns {string[]} */
    listStalePhotos(slug, cutoff) {
      return stmts.listStalePhotos.all(slug, cutoff).map((r) => /** @type {any} */ (r).file)
    },
    /** 서비스 전체 업로드 사진 바이트 합계 @returns {number} */
    photoBytesTotal() {
      return /** @type {any} */ (stmts.photoBytesTotal.get()).n
    },
    /** @param {string} slug @param {string} file */
    deletePhoto(slug, file) {
      return stmts.deletePhoto.run(slug, file).changes > 0
    },

    close() {
      db.close()
    },
  }
}

/** @typedef {ReturnType<typeof openDb>} Db */
