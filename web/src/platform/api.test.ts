import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError, createApi, resolveApiBase } from './api'
import { wedding } from '../config/wedding'

function resp(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error('no body')
      return body
    },
  }
}

let fetchMock: ReturnType<typeof vi.fn>
const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit]

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveApiBase', () => {
  it('비어 있으면 서버 없음(null)', () => {
    expect(resolveApiBase(undefined)).toBeNull()
    expect(resolveApiBase('')).toBeNull()
    expect(resolveApiBase('   ')).toBeNull()
  })
  it('"/" 는 같은 오리진("")', () => {
    expect(resolveApiBase('/')).toBe('')
  })
  it('절대 주소는 끝 슬래시를 제거', () => {
    expect(resolveApiBase('https://api.example.com//')).toBe('https://api.example.com')
  })
})

describe('URL 빌드', () => {
  it('같은 오리진: /api/... 로 요청한다', async () => {
    fetchMock.mockResolvedValue(resp(200, { available: true }))
    const api = createApi(resolveApiBase('/'))
    expect(api.available).toBe(true)
    await api.checkSlug('our-day')
    expect(lastCall()[0]).toBe('/api/weddings/our-day/availability')
    expect(lastCall()[1].method).toBe('GET')
  })

  it('절대 베이스: {base}/api/... 로 요청한다', async () => {
    fetchMock.mockResolvedValue(resp(200, []))
    const api = createApi(resolveApiBase('https://api.example.com/'))
    await api.geocode(' 서울 시청 ')
    expect(lastCall()[0]).toBe(`https://api.example.com/api/geocode?q=${encodeURIComponent('서울 시청')}`)
  })

  it('createWedding 은 POST /api/weddings 에 JSON 본문을 보낸다', async () => {
    fetchMock.mockResolvedValue(resp(201, { wedding: { slug: 'abc' }, token: 't', expiresAt: 1 }))
    const out = await createApi('').createWedding({ slug: 'abc', password: 'secret1', config: wedding })
    const [url, init] = lastCall()
    expect(url).toBe('/api/weddings')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(init.body))).toMatchObject({ slug: 'abc', password: 'secret1' })
    expect(out.token).toBe('t')
  })

  it('deletePhoto 는 url 의 파일 이름만 사용한다', async () => {
    fetchMock.mockResolvedValue(resp(204))
    await createApi('').deletePhoto('abc', 'tok', '/uploads/abc/p1.webp')
    expect(lastCall()[0]).toBe('/api/weddings/abc/photos/p1.webp')
    expect(lastCall()[1].method).toBe('DELETE')
  })

  it('deleteGuestAsOwner 는 DELETE /guests/:id (id 인코딩)', async () => {
    fetchMock.mockResolvedValue(resp(204))
    await createApi('').deleteGuestAsOwner('abc', 'tok', 'a b/c')
    expect(lastCall()[0]).toBe('/api/weddings/abc/guests/a%20b%2Fc')
  })
})

describe('인증 헤더', () => {
  it('토큰이 필요한 요청은 Authorization: Bearer 를 붙인다', async () => {
    fetchMock.mockResolvedValue(resp(200, { slug: 'abc', config: wedding, createdAt: 1, updatedAt: 2 }))
    await createApi('').updateWedding('abc', 'tok-123', wedding)
    const [url, init] = lastCall()
    expect(url).toBe('/api/weddings/abc')
    expect(init.method).toBe('PUT')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123')
    expect(JSON.parse(String(init.body))).toEqual({ config: JSON.parse(JSON.stringify(wedding)) })
  })

  it('공개 요청에는 Authorization 이 없다', async () => {
    fetchMock.mockResolvedValue(resp(200, { token: 't', expiresAt: 1 }))
    await createApi('').login('abc', 'secret1')
    expect((lastCall()[1].headers as Record<string, string>).Authorization).toBeUndefined()
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({ password: 'secret1' })
  })

  it('changePassword / deleteWedding 은 204 를 그대로 통과시킨다', async () => {
    fetchMock.mockResolvedValue(resp(204))
    const api = createApi('')
    await expect(api.changePassword('abc', 'tok', 'newpass1')).resolves.toBeUndefined()
    expect(lastCall()[0]).toBe('/api/weddings/abc/password')
    await expect(api.deleteWedding('abc', 'tok')).resolves.toBeUndefined()
    expect(lastCall()[1].method).toBe('DELETE')
  })
})

describe('사진 업로드', () => {
  it('Blob 을 그대로 본문으로, Blob 의 타입을 Content-Type 으로 보낸다', async () => {
    fetchMock.mockResolvedValue(resp(201, { url: '/uploads/abc/x.webp' }))
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
    const out = await createApi('https://api.example.com').uploadPhoto('abc', 'tok', blob)
    const [url, init] = lastCall()
    expect(url).toBe('https://api.example.com/api/weddings/abc/photos')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(blob)
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('image/webp')
    expect(headers.Authorization).toBe('Bearer tok')
    expect(out.url).toBe('/uploads/abc/x.webp')
  })
})

describe('오류 매핑', () => {
  const api = () => createApi('')

  it('getWedding: 404 는 null', async () => {
    fetchMock.mockResolvedValue(resp(404, { error: '청첩장을 찾을 수 없습니다.' }))
    await expect(api().getWedding('nope')).resolves.toBeNull()
  })

  it('서버의 {error} 문구를 그대로 쓴다 (필드 검증 메시지)', async () => {
    fetchMock.mockResolvedValue(resp(400, { error: '신랑 이름을 입력해 주세요.' }))
    await expect(api().updateWedding('abc', 't', wedding)).rejects.toThrow('신랑 이름을 입력해 주세요.')
  })

  it('본문이 없으면 상태 코드별 기본 문구', async () => {
    const cases: [number, string][] = [
      [401, '다시 로그인'],
      [403, '비밀번호가 올바르지'],
      [413, '2MB'],
      [415, 'JPG'],
      [507, '저장 공간'],
      [500, '서버에 문제'],
      [418, '요청을 처리하지 못했'],
    ]
    for (const [status, text] of cases) {
      fetchMock.mockResolvedValue(resp(status))
      await expect(api().login('abc', 'x')).rejects.toThrow(text)
    }
  })

  it('429 는 서버 문구와 무관하게 고정 안내', async () => {
    fetchMock.mockResolvedValue(resp(429, { error: 'Too Many Requests' }))
    await expect(api().geocode('서울')).rejects.toThrow('요청이 너무 많')
  })

  it('ApiError 에 status 가 담긴다', async () => {
    fetchMock.mockResolvedValue(resp(401, { error: '인증이 필요합니다.' }))
    const err = await api()
      .deleteWedding('abc', 'old')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(401)
    expect((err as ApiError).message).toBe('인증이 필요합니다.')
  })

  it('네트워크 오류는 한국어 안내 (status 0)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await api()
      .getWedding('abc')
      .catch((e: unknown) => e)
    expect((err as ApiError).message).toContain('네트워크')
    expect((err as ApiError).status).toBe(0)
  })
})

describe('서버 없는 빌드', () => {
  it('available=false 이고 모든 요청이 fetch 없이 reject 된다', async () => {
    const api = createApi(resolveApiBase(''))
    expect(api.available).toBe(false)
    await expect(api.getWedding('abc')).rejects.toThrow('데모')
    await expect(api.checkSlug('abc')).rejects.toThrow('서버')
    await expect(api.uploadPhoto('abc', 't', new Blob(['x'], { type: 'image/png' }))).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('assetUrl', () => {
  it('/uploads/ 경로는 API 오리진 기준', () => {
    expect(createApi('').assetUrl('/uploads/abc/a.jpg')).toBe('/uploads/abc/a.jpg')
    expect(createApi('https://api.example.com').assetUrl('/uploads/abc/a.jpg')).toBe(
      'https://api.example.com/uploads/abc/a.jpg',
    )
  })
  it('절대 · data · blob URL 은 그대로', () => {
    const api = createApi('https://api.example.com')
    for (const u of ['https://cdn.example.com/a.jpg', 'data:image/png;base64,AAAA', 'blob:https://x/1', '//cdn/a.jpg']) {
      expect(api.assetUrl(u)).toBe(u)
    }
  })
  it('그 외 상대 경로는 정적 자산 base path 기준', () => {
    expect(createApi(null, '/wedding-card/').assetUrl('photos/1.jpg')).toBe('/wedding-card/photos/1.jpg')
    expect(createApi(null, '/').assetUrl('/photos/1.jpg')).toBe('/photos/1.jpg')
  })
})
