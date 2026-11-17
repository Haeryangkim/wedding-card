/**
 * node:sqlite 래퍼. WAL 모드, 하객 CRUD.
 * createdAt(ms) 오름차순이 기본 정렬.
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
    CREATE TABLE IF NOT EXISTS guests (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      message    TEXT NOT NULL,
      side       TEXT NOT NULL CHECK (side IN ('groom','bride')),
      appearance TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      pw_hash    TEXT NOT NULL,
      pw_salt    TEXT NOT NULL
    )
  `)
  db.exec('CREATE INDEX IF NOT EXISTS idx_guests_created ON guests (created_at)')

  const stmts = {
    insert: db.prepare(
      `INSERT INTO guests (id, name, message, side, appearance, created_at, pw_hash, pw_salt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    list: db.prepare(
      `SELECT id, name, message, side, appearance, created_at FROM guests ORDER BY created_at ASC, id ASC`,
    ),
    count: db.prepare('SELECT COUNT(*) AS n FROM guests'),
    findSecret: db.prepare('SELECT pw_hash, pw_salt FROM guests WHERE id = ?'),
    delete: db.prepare('DELETE FROM guests WHERE id = ?'),
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

  return {
    /** @returns {GuestEntry[]} */
    list() {
      return stmts.list.all().map(rowToEntry)
    },

    /** @returns {number} */
    count() {
      return /** @type {any} */ (stmts.count.get()).n
    },

    /**
     * @param {NewGuest} input
     * @param {{ hash: string, salt: string }} secret
     * @returns {GuestEntry}
     */
    insert(input, secret) {
      const entry = {
        id: randomUUID(),
        name: input.name,
        message: input.message,
        side: input.side,
        appearance: input.appearance,
        createdAt: Date.now(),
      }
      stmts.insert.run(
        entry.id,
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
     * @param {string} id
     * @returns {{ pw_hash: string, pw_salt: string } | undefined}
     */
    findSecret(id) {
      return /** @type {any} */ (stmts.findSecret.get(id))
    },

    /**
     * @param {string} id
     * @returns {boolean} 삭제된 행이 있으면 true
     */
    delete(id) {
      return stmts.delete.run(id).changes > 0
    },

    close() {
      db.close()
    },
  }
}

/** @typedef {ReturnType<typeof openDb>} Db */
