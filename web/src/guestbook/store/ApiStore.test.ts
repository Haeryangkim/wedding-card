import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiStore } from './ApiStore'

interface MockResponse {
  ok: boolean
  status: number
  json?: () => Promise<unknown>
}

function resp(status: number, body?: unknown): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error('no body')
      return body
    },
  }
}

const sampleEntry = {
  id: 'srv1',
  name: '서버하객',
  message: '축하해요',
  side: 'bride',
  appearance: { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0 },
  createdAt: 1700000000000,
}

const input = {
  name: '테스터',
  message: '축하합니다',
  side: 'groom' as const,
  appearance: { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0 },
  password: 'pw1234',
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function lastUrl(): string {
  return String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0])
}

describe('ApiStore URL 빌드', () => {
  it('base "" 는 같은 오리진(/api/...) 으로 요청한다', async () => {
    fetchMock.mockResolvedValue(resp(200, [sampleEntry]))
    await new ApiStore('').list()
    expect(lastUrl()).toBe('/api/guests')
  })

  it('절대 base 는 {base}/api/... 로 요청한다', async () => {
    fetchMock.mockResolvedValue(resp(200, []))
    await new ApiStore('https://api.example.com').list()
    expect(lastUrl()).toBe('https://api.example.com/api/guests')
  })

  it('base 의 끝 슬래시는 제거된다', async () => {
    fetchMock.mockResolvedValue(resp(200, []))
    await new ApiStore('https://api.example.com///').list()
    expect(lastUrl()).toBe('https://api.example.com/api/guests')
  })

  it('add 는 POST /api/guests, remove 는 DELETE /api/guests/:id', async () => {
    fetchMock.mockResolvedValue(resp(201, sampleEntry))
    await new ApiStore('').add(input)
    let call = fetchMock.mock.calls[0]
    expect(call[0]).toBe('/api/guests')
    expect(call[1].method).toBe('POST')
    const sent = JSON.parse(call[1].body)
    expect(sent.name).toBe('테스터')
    expect(sent.password).toBe('pw1234')

    fetchMock.mockResolvedValue(resp(204))
    await new ApiStore('').remove('a b/c', 'pw1234')
    call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
    expect(call[0]).toBe('/api/guests/a%20b%2Fc')
    expect(call[1].method).toBe('DELETE')
  })
})

describe('ApiStore 응답 처리', () => {
  it('list 는 신뢰 불가 항목을 걸러낸다', async () => {
    fetchMock.mockResolvedValue(resp(200, [sampleEntry, { id: '' }, null, { bogus: 1 }]))
    const list = await new ApiStore('').list()
    expect(list.map((e) => e.id)).toEqual(['srv1'])
  })
})

describe('ApiStore 오류 매핑', () => {
  it('네트워크 오류는 읽기 쉬운 한국어 메시지', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(new ApiStore('').list()).rejects.toThrow('네트워크')
  })

  it('429 는 요청 과다 메시지', async () => {
    fetchMock.mockResolvedValue(resp(429, { error: 'rate' }))
    await expect(new ApiStore('').list()).rejects.toThrow('요청이 너무 많')
  })

  it('4xx 는 서버 {error} 문자열을 그대로 쓴다', async () => {
    fetchMock.mockResolvedValue(resp(403, { error: '비밀번호가 올바르지 않습니다.' }))
    await expect(new ApiStore('').remove('srv1', 'bad')).rejects.toThrow('비밀번호가 올바르지 않습니다.')
  })

  it('5xx 는 일반 서버 오류 메시지', async () => {
    fetchMock.mockResolvedValue(resp(500))
    await expect(new ApiStore('').list()).rejects.toThrow('서버에 문제')
  })
})

describe('ApiStore.subscribe 의 EventSource 수명', () => {
  class FakeEventSource {
    static instances: FakeEventSource[] = []
    closed = false
    onopen: (() => void) | null = null
    onerror: (() => void) | null = null
    readonly url: string
    constructor(url: string) {
      this.url = url
      FakeEventSource.instances.push(this)
    }
    addEventListener(): void {}
    close(): void {
      this.closed = true
    }
  }

  function makeDocument() {
    const listeners = new Set<() => void>()
    const doc = {
      hidden: false,
      addEventListener: (_type: string, fn: () => void) => void listeners.add(fn),
      removeEventListener: (_type: string, fn: () => void) => void listeners.delete(fn),
    }
    const setHidden = (hidden: boolean) => {
      doc.hidden = hidden
      for (const fn of [...listeners]) fn()
    }
    return { doc, setHidden, listeners }
  }

  /** 테스트가 원하는 시점에 응답하는 fetch */
  function deferredFetch() {
    const pending: ((r: MockResponse) => void)[] = []
    fetchMock.mockImplementation(() => new Promise<MockResponse>((resolve) => pending.push(resolve)))
    return {
      resolveAll: () => {
        for (const r of pending.splice(0)) r(resp(200, [sampleEntry]))
      },
    }
  }

  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }
  const open = () => FakeEventSource.instances.filter((e) => !e.closed)

  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  it('초기 적재 중 숨겨졌다가(응답 도착) 다시 보여도 EventSource 는 하나뿐이다', async () => {
    const { doc, setHidden, listeners } = makeDocument()
    vi.stubGlobal('document', doc)
    const net = deferredFetch()

    const unsub = new ApiStore('').subscribe(() => {})
    setHidden(true)
    net.resolveAll() // 숨겨진 동안 초기 GET 이 끝남
    await flush()
    expect(open()).toHaveLength(0) // 숨겨진 탭에서는 열지 않는다

    setHidden(false)
    net.resolveAll()
    await flush()
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(open()).toHaveLength(1)

    unsub()
    expect(open()).toHaveLength(0)
    expect(listeners.size).toBe(0)
  })

  it('초기 적재가 진행 중일 때 숨김→보임이 일어나도 EventSource 는 하나뿐이다', async () => {
    const { doc, setHidden } = makeDocument()
    vi.stubGlobal('document', doc)
    const net = deferredFetch()

    const unsub = new ApiStore('').subscribe(() => {})
    setHidden(true)
    setHidden(false) // 여기서 SSE 가 열린다
    expect(open()).toHaveLength(1)

    net.resolveAll() // 이제 초기 GET 완료 → startSse 가 다시 불린다
    await flush()
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(open()).toHaveLength(1)

    unsub()
    expect(open()).toHaveLength(0)
  })

  it('숨김/보임을 반복해도 열린 연결은 항상 최대 하나', async () => {
    const { doc, setHidden } = makeDocument()
    vi.stubGlobal('document', doc)
    fetchMock.mockResolvedValue(resp(200, [sampleEntry]))

    const unsub = new ApiStore('').subscribe(() => {})
    await flush()
    for (let i = 0; i < 3; i++) {
      setHidden(true)
      expect(open()).toHaveLength(0)
      setHidden(false)
      await flush()
      expect(open()).toHaveLength(1)
    }
    unsub()
    expect(open()).toHaveLength(0)
  })
})
