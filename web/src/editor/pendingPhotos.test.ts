import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addPendingPhoto, isDefiniteRejection, loadPendingPhotos, removePendingPhotos } from './pendingPhotos'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

describe('pendingPhotos', () => {
  let store: ReturnType<typeof memoryStorage>
  beforeEach(() => {
    store = memoryStorage()
    vi.stubGlobal('sessionStorage', store)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('청첩장 주소별로 따로, 중복 없이 기록한다', () => {
    addPendingPhoto('aa', '/uploads/aa/1.jpg')
    addPendingPhoto('aa', '/uploads/aa/1.jpg')
    addPendingPhoto('aa', '/uploads/aa/2.jpg')
    addPendingPhoto('bb', '/uploads/bb/9.jpg')
    expect(loadPendingPhotos('aa')).toEqual(['/uploads/aa/1.jpg', '/uploads/aa/2.jpg'])
    expect(loadPendingPhotos('bb')).toEqual(['/uploads/bb/9.jpg'])
    expect([...store.map.keys()]).toEqual(['wedding-editor-pending:aa', 'wedding-editor-pending:bb'])
  })

  it('지우면 목록에서 빠지고, 다 지우면 키도 없앤다', () => {
    addPendingPhoto('aa', '/uploads/aa/1.jpg')
    addPendingPhoto('aa', '/uploads/aa/2.jpg')
    removePendingPhotos('aa', new Set(['/uploads/aa/1.jpg', '/uploads/aa/none.jpg']))
    expect(loadPendingPhotos('aa')).toEqual(['/uploads/aa/2.jpg'])
    removePendingPhotos('aa', ['/uploads/aa/2.jpg'])
    expect(loadPendingPhotos('aa')).toEqual([])
    expect(store.map.size).toBe(0)
  })

  it('깨진 값이나 쓸 수 없는 저장소에서도 예외 없이 빈 목록', () => {
    store.map.set('wedding-editor-pending:aa', '{oops')
    expect(loadPendingPhotos('aa')).toEqual([])
    store.map.set('wedding-editor-pending:aa', JSON.stringify(['/a', 3, null]))
    expect(loadPendingPhotos('aa')).toEqual(['/a'])
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => addPendingPhoto('aa', '/x')).not.toThrow()
    expect(() => removePendingPhotos('aa', ['/x'])).not.toThrow()
    expect(loadPendingPhotos('aa')).toEqual([])
  })
})

describe('isDefiniteRejection', () => {
  it('4xx 만 "저장되지 않았다" 고 확신할 수 있다', () => {
    for (const s of [400, 401, 404, 413, 429]) expect(isDefiniteRejection(s), String(s)).toBe(true)
    // 시간 초과·연결 끊김(0/없음)·5xx 는 서버가 이미 저장했을 수 있다
    for (const s of [null, 0, -1, 500, 502, 503]) expect(isDefiniteRejection(s), String(s)).toBe(false)
  })
})
