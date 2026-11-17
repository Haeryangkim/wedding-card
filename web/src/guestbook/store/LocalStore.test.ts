import { describe, it, expect, beforeEach } from 'vitest'
import { LocalStore, hashPassword } from './LocalStore'

/** node 환경용 가짜 Storage */
function makeStorage(initial: Record<string, string> = {}): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(initial))
  return {
    map,
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  } as Storage & { map: Map<string, string> }
}

/** setItem 이 항상 던지는 스토리지(시크릿 모드 모사) */
function makeThrowingStorage(): Storage {
  return {
    length: 0,
    clear: () => {},
    getItem: () => null,
    key: () => null,
    removeItem: () => {},
    setItem: () => {
      throw new Error('QuotaExceeded')
    },
  } as Storage
}

const input = {
  name: '테스터',
  message: '축하합니다',
  side: 'groom' as const,
  appearance: { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0 },
  password: 'pw1234',
}

describe('LocalStore', () => {
  let storage: ReturnType<typeof makeStorage>

  beforeEach(() => {
    storage = makeStorage()
  })

  it('mode 는 local, 샘플 하객을 포함한다', async () => {
    const store = new LocalStore(storage)
    expect(store.mode).toBe('local')
    const list = await store.list()
    expect(list.length).toBeGreaterThanOrEqual(12)
    expect(list.every((e) => e.id.startsWith('sample-'))).toBe(true)
  })

  it('목록은 createdAt 오름차순이다', async () => {
    const store = new LocalStore(storage)
    const list = await store.list()
    for (let i = 1; i < list.length; i++) {
      expect(list[i].createdAt).toBeGreaterThanOrEqual(list[i - 1].createdAt)
    }
  })

  it('add 하면 목록 끝에 추가되고 localStorage 에 저장된다', async () => {
    const store = new LocalStore(storage)
    const before = (await store.list()).length
    const entry = await store.add(input)
    const after = await store.list()
    expect(after.length).toBe(before + 1)
    expect(after.some((e) => e.id === entry.id)).toBe(true)
    expect(storage.map.has('wc.guestbook.v1')).toBe(true)

    // 새 인스턴스가 저장된 글을 다시 읽어온다
    const reopened = new LocalStore(storage)
    expect((await reopened.list()).some((e) => e.id === entry.id)).toBe(true)
  })

  it('입력이 비어 있으면 add 가 거부된다', async () => {
    const store = new LocalStore(storage)
    await expect(store.add({ ...input, name: '  ' })).rejects.toThrow()
  })

  it('비밀번호가 맞아야 삭제된다', async () => {
    const store = new LocalStore(storage)
    const entry = await store.add(input)
    await expect(store.remove(entry.id, 'wrong')).rejects.toThrow('비밀번호')
    await store.remove(entry.id, 'pw1234')
    expect((await store.list()).some((e) => e.id === entry.id)).toBe(false)
  })

  it('비밀번호는 평문으로 저장되지 않는다(해시만)', async () => {
    const store = new LocalStore(storage)
    await store.add(input)
    const raw = storage.map.get('wc.guestbook.v1') ?? ''
    expect(raw).not.toContain('pw1234')
    expect(raw).toContain(hashPassword('pw1234'))
  })

  it('샘플 하객은 삭제할 수 없다', async () => {
    const store = new LocalStore(storage)
    await expect(store.remove('sample-1', 'anything')).rejects.toThrow('삭제할 수 없')
  })

  it('없는 id 삭제는 거부된다', async () => {
    const store = new LocalStore(storage)
    await expect(store.remove('nope', 'x')).rejects.toThrow()
  })

  it('손상된 JSON 이어도 샘플만 보여주며 깨지지 않는다', async () => {
    const corrupt = makeStorage({ 'wc.guestbook.v1': '{broken json...' })
    const store = new LocalStore(corrupt)
    const list = await store.list()
    expect(list.length).toBeGreaterThanOrEqual(12)
  })

  it('storage 가 null 이면 인메모리로 동작한다', async () => {
    const store = new LocalStore(null)
    const entry = await store.add(input)
    expect((await store.list()).some((e) => e.id === entry.id)).toBe(true)
  })

  it('setItem 예외가 나도 인메모리 폴백으로 add 가 성공한다', async () => {
    const store = new LocalStore(makeThrowingStorage())
    const entry = await store.add(input)
    expect((await store.list()).some((e) => e.id === entry.id)).toBe(true)
  })

  it('subscribe 는 add/remove 시 전체 목록으로 콜백하고 해제된다', async () => {
    const store = new LocalStore(storage)
    const seen: number[] = []
    const unsub = store.subscribe((entries) => seen.push(entries.length))
    const entry = await store.add(input)
    await store.remove(entry.id, 'pw1234')
    unsub()
    await store.add(input)
    expect(seen.length).toBe(2)
  })
})
