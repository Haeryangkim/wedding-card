/**
 * PlatformApi 가 던지는 오류 해석. 순수 함수.
 * 구현체는 HTTP 상태를 Error 의 `status` 속성에 담아 주는 것을 기대하지만(예: err.status === 401),
 * 없더라도 서버의 한국어 메시지로 가능한 만큼 추정한다.
 */

const HINTS: [RegExp, number][] = [
  [/관리 권한이 없습니다/, 401],
  [/비밀번호가 일치하지 않습니다/, 403],
  [/요청이 너무 잦습니다/, 429],
  [/이미 사용 중인 주소/, 409],
  [/청첩장을 찾을 수 없습니다/, 404],
]

export function errorStatus(err: unknown): number | null {
  if (typeof err === 'object' && err !== null) {
    const status = (err as { status?: unknown }).status
    if (typeof status === 'number' && Number.isFinite(status)) return status
  }
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  for (const [re, status] of HINTS) if (re.test(message)) return status
  return null
}

/** 사용자에게 보여 줄 문구. 브라우저의 영어 네트워크 오류는 한국어 안내로 바꾼다 */
export function errorText(err: unknown, fallback = '문제가 생겼어요. 잠시 후 다시 시도해 주세요.'): string {
  if (errorStatus(err) === 429) return '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.'
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  }
  // 한글이 전혀 없는 메시지(예: 예기치 못한 예외)는 그대로 보여 주지 않는다
  return /[가-힣]/.test(message) ? message : fallback
}

export const isUnauthorized = (err: unknown): boolean => errorStatus(err) === 401
