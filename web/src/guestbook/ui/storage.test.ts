import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JoinDraft } from './storage'
import { clearDraft, loadDraft, loadMyIds, saveDraft, saveMyIds, storageScope } from './storage'

const draft = (name: string): JoinDraft => ({ name, side: 'bride', message: `${name}의 글`, appearance: {} as JoinDraft['appearance'] })

describe('방명록 기기 저장소 (청첩장별)', () => {
  let map: Map<string, string>
  beforeEach(() => {
    map = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const demo = storageScope('demo', true)
  const a = storageScope('aa', false)
  const b = storageScope('bb', false)

  it('범위는 데모/서버와 주소로 나뉜다', () => {
    expect(demo).toBe('demo:demo')
    expect(a).toBe('api:aa')
    expect(storageScope('demo', false)).not.toBe(demo)
  })

  it('쓰다 만 글은 다른 청첩장에 나타나지 않는다', () => {
    saveDraft(demo, draft('테스트'))
    expect(loadDraft(a)).toBeNull()
    saveDraft(a, draft('가'))
    expect(loadDraft(b)).toBeNull()
    expect(loadDraft(a)?.name).toBe('가')
    expect(loadDraft(demo)?.name).toBe('테스트')
    clearDraft(a)
    expect(loadDraft(a)).toBeNull()
    expect(loadDraft(demo)?.name).toBe('테스트')
  })

  it('나누기 전의 임시 저장은 어디에도 채워지지 않고, 등록하면 지워진다', () => {
    map.set('wc.draft.v1', JSON.stringify(draft('옛글')))
    expect(loadDraft(demo)).toBeNull()
    expect(loadDraft(a)).toBeNull()
    clearDraft(a)
    expect(map.has('wc.draft.v1')).toBe(false)
  })

  it('내 캐릭터 목록도 청첩장별이고, 예전 목록은 데모만 이어받는다', () => {
    map.set('wc.myids.v1', JSON.stringify(['old1']))
    expect([...loadMyIds(demo)]).toEqual(['old1'])
    expect([...loadMyIds(a)]).toEqual([])
    saveMyIds(a, new Set(['x']))
    saveMyIds(demo, new Set())
    expect([...loadMyIds(a)]).toEqual(['x'])
    expect([...loadMyIds(b)]).toEqual([])
    expect([...loadMyIds(demo)]).toEqual([]) // 저장한 뒤에는 예전 목록으로 돌아가지 않는다
  })
})
