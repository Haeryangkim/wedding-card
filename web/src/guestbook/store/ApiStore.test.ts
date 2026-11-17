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
