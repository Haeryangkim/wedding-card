/**
 * LocalStore — 백엔드 없이 localStorage + 결정적 샘플 하객으로 동작하는 저장소.
 * GitHub Pages 데모가 서버 호스팅 전까지 사용합니다.
 *  - 샘플 하객은 삭제 불가
 *  - 방문자가 추가한 글만 저장(삭제 비밀번호는 비암호 해시로만 저장)
 *  - localStorage 접근 실패(시크릿 모드 등)/손상 JSON 은 인메모리로 폴백
 *  - 'storage' 이벤트로 다른 탭과 동기화
 */
import type { GuestbookStore, GuestEntry, NewGuestInput } from '../types'
import { hasFieldErrors, sanitizeEntry, sanitizeNewInput, validateNewGuest } from '../validate'
import { buildSampleGuests, sampleIds } from '../sampleGuests'

const STORAGE_KEY = 'wc.guestbook.v1'
const STORAGE_VERSION = 1

interface StoredEntry extends GuestEntry {
  /** 삭제용 비밀번호 해시 (비암호, 데모 수준 보호) */
  pwHash: string
}

interface StoredPayload {
  version: number
  entries: StoredEntry[]
}

/** cyrb53 — 짧고 동기적인 비암호 문자열 해시. (실제 보안용 아님, 데모 삭제 보호용) */
export function hashPassword(pw: string, seed = 0x9e3779b9): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < pw.length; i++) {
    const ch = pw.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hv = 4294967296 * (2097151 & h2) + (h1 >>> 0)
  return hv.toString(16)
}

/** 접근 가능한 localStorage 를 반환하거나, 사용 불가하면 null */
function resolveStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const probe = '__wc_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}

function toEntry(s: StoredEntry): GuestEntry {
  return {
    id: s.id,
    name: s.name,
    message: s.message,
    side: s.side,
    appearance: s.appearance,
    createdAt: s.createdAt,
  }
}

function genId(): string {
  const rnd = Math.random().toString(36).slice(2, 8)
  return `g_${Date.now().toString(36)}_${rnd}`
}

export class LocalStore implements GuestbookStore {
  readonly mode = 'local' as const

  private storage: Storage | null
  private useMemory: boolean
  private added: StoredEntry[] = []
  private readonly samples: GuestEntry[]
  private readonly sampleIdSet: Set<string>
  private readonly subs = new Set<(entries: GuestEntry[]) => void>()
  private storageListener: ((e: StorageEvent) => void) | null = null

  /** storage 를 명시하면 그것을 사용(테스트용). 생략하면 실제 localStorage 를 탐지 */
  constructor(storage?: Storage | null) {
    this.samples = buildSampleGuests()
    this.sampleIdSet = sampleIds()
    this.storage = storage === undefined ? resolveStorage() : storage
    this.useMemory = !this.storage
    this.load()
  }

  private load(): void {
    if (!this.storage) return
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      if (!raw) {
        this.added = []
        return
      }
      const parsed = JSON.parse(raw) as unknown
      const list =
        parsed && typeof parsed === 'object' && Array.isArray((parsed as StoredPayload).entries)
          ? (parsed as StoredPayload).entries
          : []
      const out: StoredEntry[] = []
      for (const item of list) {
        const entry = sanitizeEntry(item)
        if (!entry) continue
        const pwHash =
          item && typeof (item as StoredEntry).pwHash === 'string'
            ? (item as StoredEntry).pwHash
            : ''
        out.push({ ...entry, pwHash })
      }
      this.added = out
    } catch {
      // 손상 JSON 또는 접근 예외 → 인메모리 폴백
      this.useMemory = true
      this.added = []
    }
  }

  private persist(): void {
    if (!this.storage || this.useMemory) return
    try {
      const payload: StoredPayload = { version: STORAGE_VERSION, entries: this.added }
      this.storage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      this.useMemory = true
    }
  }

  private snapshot(): GuestEntry[] {
    return [...this.samples, ...this.added.map(toEntry)].sort((a, b) => a.createdAt - b.createdAt)
  }

  private emit(): void {
    const snap = this.snapshot()
    for (const cb of this.subs) cb(snap)
  }

  async list(): Promise<GuestEntry[]> {
    return this.snapshot()
  }

  async add(input: NewGuestInput): Promise<GuestEntry> {
    const errors = validateNewGuest(input)
    if (hasFieldErrors(errors)) {
      throw new Error(errors.name || errors.message || errors.password || '입력을 확인해 주세요.')
    }
    const clean = sanitizeNewInput(input)
    const entry: GuestEntry = {
      id: genId(),
      name: clean.name,
      message: clean.message,
      side: clean.side,
      appearance: clean.appearance,
      createdAt: Date.now(),
    }
    this.added = [...this.added, { ...entry, pwHash: hashPassword(input.password) }]
    this.persist()
    this.emit()
    return entry
  }

  async remove(id: string, password: string): Promise<void> {
    if (this.sampleIdSet.has(id)) {
      throw new Error('기본 하객 캐릭터는 삭제할 수 없어요.')
    }
    const target = this.added.find((e) => e.id === id)
    if (!target) {
      throw new Error('이미 삭제되었거나 찾을 수 없는 방명록이에요.')
    }
    if (target.pwHash !== hashPassword(password)) {
      throw new Error('비밀번호가 일치하지 않아요.')
    }
    this.added = this.added.filter((e) => e.id !== id)
    this.persist()
    this.emit()
  }

  subscribe(cb: (entries: GuestEntry[]) => void): () => void {
    this.subs.add(cb)
    this.ensureStorageListener()
    return () => {
      this.subs.delete(cb)
      if (this.subs.size === 0) this.teardownStorageListener()
    }
  }

  private ensureStorageListener(): void {
    if (this.storageListener || typeof window === 'undefined' || !this.storage) return
    this.storageListener = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        this.load()
        this.emit()
      }
    }
    window.addEventListener('storage', this.storageListener)
  }

  private teardownStorageListener(): void {
    if (this.storageListener && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageListener)
    }
    this.storageListener = null
  }
}
