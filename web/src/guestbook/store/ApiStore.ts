/**
 * ApiStore — docker 서버의 REST API + SSE 실시간을 쓰는 저장소.
 * REST 계약은 types.ts 참고.
 *  - base: 끝 슬래시를 제거한 값. "" 이면 같은 오리진(/api/...), 절대 URL 이면 {base}/api/...
 *  - fetch 는 타임아웃 + 읽기 쉬운 한국어 오류 메시지
 *  - subscribe 는 EventSource(/api/events) → 실패/부재 시 폴링 폴백, 탭 숨김 시 일시정지
 */
import type { GuestbookStore, GuestEntry, NewGuestInput } from '../types'
import {
  hasFieldErrors,
  sanitizeEntry,
  sanitizeList,
  sanitizeNewInput,
  validateNewGuest,
} from '../validate'

const REQUEST_TIMEOUT_MS = 10000
const POLL_INTERVAL_MS = 20000
const MAX_SSE_FAILURES = 3

export class ApiStore implements GuestbookStore {
  readonly mode = 'api' as const
  private readonly base: string

  constructor(base: string) {
    this.base = base.replace(/\/+$/, '')
  }

  private apiUrl(path: string): string {
    return `${this.base}/api${path}`
  }

  private eventsUrl(): string {
    return `${this.base}/api/events`
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    expectEmpty = false,
  ): Promise<unknown> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(this.apiUrl(path), {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } catch {
      clearTimeout(timer)
      if (controller.signal.aborted) {
        throw new Error('요청 시간이 초과되었어요. 잠시 후 다시 시도해 주세요.')
      }
      throw new Error('네트워크 연결을 확인해 주세요.')
    }
    clearTimeout(timer)

    if (!res.ok) {
      throw new Error(await errorMessage(res))
    }
    if (expectEmpty || res.status === 204) return undefined
    try {
      return await res.json()
    } catch {
      return undefined
    }
  }

  async list(): Promise<GuestEntry[]> {
    const data = await this.request('GET', '/guests')
    return sanitizeList(data)
  }

  async add(input: NewGuestInput): Promise<GuestEntry> {
    const errors = validateNewGuest(input)
    if (hasFieldErrors(errors)) {
      throw new Error(errors.name || errors.message || errors.password || '입력을 확인해 주세요.')
    }
    const clean = sanitizeNewInput(input)
    const data = await this.request('POST', '/guests', {
      name: clean.name,
      message: clean.message,
      side: clean.side,
      appearance: clean.appearance,
      password: input.password,
    })
    const entry = sanitizeEntry(data)
    if (!entry) throw new Error('방명록 등록에 실패했어요. 잠시 후 다시 시도해 주세요.')
    return entry
  }

  async remove(id: string, password: string): Promise<void> {
    await this.request('DELETE', `/guests/${encodeURIComponent(id)}`, { password }, true)
  }

  subscribe(cb: (entries: GuestEntry[]) => void): () => void {
    let closed = false
    let cache: GuestEntry[] = []
    let es: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let failures = 0

    const emit = () => {
      if (!closed) cb(cache.slice())
    }

    const refetch = async () => {
      try {
        cache = await this.list()
        emit()
      } catch {
        // 기존 캐시 유지
      }
    }

    const upsert = (entry: GuestEntry) => {
      const idx = cache.findIndex((e) => e.id === entry.id)
      if (idx >= 0) cache[idx] = entry
      else cache = [...cache, entry].sort((a, b) => a.createdAt - b.createdAt)
      emit()
    }

    const removeById = (id: string) => {
      const next = cache.filter((e) => e.id !== id)
      if (next.length !== cache.length) {
        cache = next
        emit()
      }
    }

    const stopPolling = () => {
      if (pollTimer !== null) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    const startPolling = () => {
      if (pollTimer !== null || closed) return
      pollTimer = setInterval(() => {
        if (typeof document === 'undefined' || !document.hidden) void refetch()
      }, POLL_INTERVAL_MS)
    }

    const stopSse = () => {
      if (es) {
        es.close()
        es = null
      }
    }

    const startSse = () => {
      // 이미 연결이 있으면 다시 열지 않는다(초기 적재 완료와 visibilitychange 가 겹치면
      // 두 번 불려, 추적되지 않는 EventSource 가 영구히 남는다).
      if (closed || es) return
      // 숨겨진 탭에서는 열지 않는다 → 다시 보일 때 onVisibility 가 연다.
      if (typeof document !== 'undefined' && document.hidden) return
      if (typeof EventSource === 'undefined') {
        startPolling()
        return
      }
      let src: EventSource
      try {
        src = new EventSource(this.eventsUrl())
      } catch {
        startPolling()
        return
      }
      es = src
      src.onopen = () => {
        failures = 0
        stopPolling()
        void refetch() // 재연결 시 놓친 변경 보정
      }
      src.addEventListener('added', (ev: Event) => {
        try {
          const entry = sanitizeEntry(JSON.parse((ev as MessageEvent).data))
          if (entry) upsert(entry)
        } catch {
          /* 잘못된 페이로드 무시 */
        }
      })
      src.addEventListener('removed', (ev: Event) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { id?: unknown }
          if (typeof data.id === 'string') removeById(data.id)
        } catch {
          /* 무시 */
        }
      })
      src.onerror = () => {
        if (es !== src) {
          // 이미 교체/정리된 연결의 뒤늦은 오류: 이 인스턴스만 닫는다.
          src.close()
          return
        }
        failures += 1
        if (failures >= MAX_SSE_FAILURES) {
          stopSse()
          startPolling() // 계속 실패하면 폴링으로 폴백
        }
        // 그 외에는 EventSource 가 자동 재연결
      }
    }

    const onVisibility = () => {
      if (typeof document === 'undefined') return
      if (document.hidden) {
        stopSse()
        stopPolling()
      } else {
        void refetch()
        startSse()
      }
    }

    // 초기 적재 후 실시간 구독 시작
    void refetch().then(() => {
      if (!closed) startSse()
    })
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      closed = true
      stopSse()
      stopPolling()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }
}

async function errorMessage(res: Response): Promise<string> {
  if (res.status === 429) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
  let serverMsg = ''
  try {
    const data = (await res.json()) as { error?: unknown }
    if (data && typeof data.error === 'string') serverMsg = data.error
  } catch {
    /* 본문 없음/비 JSON */
  }
  if (serverMsg) return serverMsg
  if (res.status >= 500) return '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'
  return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
}
