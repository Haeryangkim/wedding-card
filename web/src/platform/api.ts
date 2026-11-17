/**
 * 플랫폼 API 클라이언트. 규칙은 contract.ts 의 PlatformApi 주석 참고.
 *
 * VITE_API_URL
 *  - 미설정/빈 값 → 서버 없음 (available === false, 모든 요청은 한국어 메시지로 reject — 데모 전용 빌드)
 *  - "/"          → 같은 오리진 (/api/..., /uploads/...)
 *  - 그 외        → 해당 API 오리진 (끝 슬래시 제거)
 */
import type { WeddingConfig } from '../config/wedding'
import type { AuthToken, GeocodeResult, PlatformApi, WeddingRecord } from './contract'

const REQUEST_TIMEOUT_MS = 12_000
const UPLOAD_TIMEOUT_MS = 45_000

export const NO_SERVER_MESSAGE =
  '이 배포는 서버 없이 동작하는 데모예요. 청첩장을 만들거나 수정하려면 서버가 함께 설치된 배포가 필요합니다.'

/** HTTP 상태를 함께 담는 오류. status 0 = 네트워크/시간 초과, -1 = 서버 없는 빌드 */
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 순수 함수: VITE_API_URL 원본 → API 베이스. null = 서버 없음, "" = 같은 오리진, 그 외 = 절대 오리진 */
export function resolveApiBase(raw: unknown): string | null {
  const s = (raw ?? '').toString().trim()
  if (!s) return null
  return s.replace(/\/+$/, '')
}

const STATUS_MESSAGES: Record<number, string> = {
  400: '입력한 내용을 다시 확인해 주세요.',
  401: '로그인이 만료되었어요. 다시 로그인해 주세요.',
  403: '비밀번호가 올바르지 않습니다.',
  404: '청첩장을 찾을 수 없습니다.',
  409: '이미 사용 중이거나 더 이상 추가할 수 없어요.',
  413: '파일이 너무 커요. 사진은 한 장에 2MB 까지 올릴 수 있어요.',
  415: '지원하지 않는 형식이에요. JPG · PNG · WebP 사진만 올릴 수 있어요.',
  502: '외부 서비스가 응답하지 않아요. 잠시 후 다시 시도해 주세요.',
  503: '지금은 이 기능을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.',
  507: '서버 저장 공간이 부족해요. 관리자에게 문의해 주세요.',
}

async function errorFrom(res: Response): Promise<ApiError> {
  if (res.status === 429) return new ApiError('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', 429)
  let serverMsg = ''
  try {
    const data = (await res.json()) as { error?: unknown }
    if (data && typeof data.error === 'string') serverMsg = data.error.trim()
  } catch {
    /* 본문 없음 / JSON 아님 */
  }
  const msg =
    serverMsg ||
    STATUS_MESSAGES[res.status] ||
    (res.status >= 500
      ? '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'
      : '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
  return new ApiError(msg, res.status)
}

interface RequestOptions {
  token?: string
  /** JSON 으로 직렬화해 보낼 본문 */
  json?: unknown
  /** 그대로 보낼 본문 (사진 업로드) */
  raw?: Blob
  timeoutMs?: number
}

const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * API 클라이언트 생성 (테스트에서는 base 를 직접 넘긴다).
 * @param base resolveApiBase() 결과
 * @param publicBase 정적 자산 base 경로 (import.meta.env.BASE_URL)
 */
export function createApi(base: string | null, publicBase = '/'): PlatformApi {
  const available = base !== null
  const seg = encodeURIComponent
  const weddingPath = (slug: string, rest = '') => `/api/weddings/${seg(slug)}${rest}`

  async function send(method: string, path: string, opts: RequestOptions = {}): Promise<Response> {
    if (base === null) throw new ApiError(NO_SERVER_MESSAGE, -1)
    const headers: Record<string, string> = {}
    let body: BodyInit | undefined
    if (opts.raw) {
      headers['Content-Type'] = opts.raw.type || 'application/octet-stream'
      body = opts.raw
    } else if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.json)
    }
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? REQUEST_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(`${base}${path}`, { method, headers, body, signal: controller.signal })
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError('요청 시간이 초과되었어요. 잠시 후 다시 시도해 주세요.', 0)
      }
      throw new ApiError('네트워크 연결을 확인해 주세요.', 0)
    } finally {
      clearTimeout(timer)
    }
    return res
  }

  async function json<T>(method: string, path: string, opts?: RequestOptions): Promise<T> {
    const res = await send(method, path, opts)
    if (!res.ok) throw await errorFrom(res)
    try {
      return (await res.json()) as T
    } catch {
      throw new ApiError('서버 응답을 이해하지 못했어요. 잠시 후 다시 시도해 주세요.', res.status)
    }
  }

  async function empty(method: string, path: string, opts?: RequestOptions): Promise<void> {
    const res = await send(method, path, opts)
    if (!res.ok) throw await errorFrom(res)
  }

  return {
    available,

    checkSlug(slug) {
      return json<{ available: boolean; reason?: string }>('GET', weddingPath(slug, '/availability'))
    },

    createWedding(input: { slug: string; password: string; config: WeddingConfig }) {
      return json<{ wedding: WeddingRecord } & AuthToken>('POST', '/api/weddings', { json: input })
    },

    async getWedding(slug) {
      const res = await send('GET', weddingPath(slug))
      if (res.status === 404) return null
      if (!res.ok) throw await errorFrom(res)
      try {
        return (await res.json()) as WeddingRecord
      } catch {
        throw new ApiError('서버 응답을 이해하지 못했어요. 잠시 후 다시 시도해 주세요.', res.status)
      }
    },

    login(slug, password) {
      return json<AuthToken>('POST', weddingPath(slug, '/login'), { json: { password } })
    },

    updateWedding(slug, token, config) {
      return json<WeddingRecord>('PUT', weddingPath(slug), { token, json: { config } })
    },

    changePassword(slug, token, password) {
      return empty('PUT', weddingPath(slug, '/password'), { token, json: { password } })
    },

    deleteWedding(slug, token) {
      return empty('DELETE', weddingPath(slug), { token })
    },

    uploadPhoto(slug, token, image) {
      return json<{ url: string }>('POST', weddingPath(slug, '/photos'), {
        token,
        raw: image,
        timeoutMs: UPLOAD_TIMEOUT_MS,
      })
    },

    deletePhoto(slug, token, url) {
      const file = url.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? ''
      return empty('DELETE', weddingPath(slug, `/photos/${seg(file)}`), { token })
    },

    geocode(query) {
      return json<GeocodeResult[]>('GET', `/api/geocode?q=${seg(query.trim())}`)
    },

    deleteGuestAsOwner(slug, token, guestId) {
      return empty('DELETE', weddingPath(slug, `/guests/${seg(guestId)}`), { token })
    },

    assetUrl(pathOrUrl) {
      if (!pathOrUrl) return pathOrUrl
      if (ABSOLUTE_URL.test(pathOrUrl)) return pathOrUrl // http(s):, data:, blob:, //host
      if (pathOrUrl.startsWith('/uploads/')) return `${base ?? ''}${pathOrUrl}`
      // 그 외 상대 경로는 번들된 정적 자산(public/) — base path 를 붙인다
      return `${publicBase.replace(/\/*$/, '/')}${pathOrUrl.replace(/^\/+/, '')}`
    },
  }
}

/** 이 빌드의 API 베이스 (null = 서버 없음, "" = 같은 오리진) */
export function apiBase(): string | null {
  return resolveApiBase(import.meta.env.VITE_API_URL)
}

let instance: PlatformApi | null = null

/** VITE_API_URL 기반 싱글턴 */
export function getApi(): PlatformApi {
  instance ??= createApi(apiBase(), import.meta.env.BASE_URL)
  return instance
}
