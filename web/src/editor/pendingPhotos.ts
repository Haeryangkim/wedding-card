/**
 * "올렸지만 아직 저장하지 않은" 사진 주소 기록 (청첩장 주소별, sessionStorage).
 *
 * 올린 사진은 저장(PUT)하기 전까지 서버에서 이 청첩장의 사진 수 상한(30장)에 포함되는데, 편집 화면이
 * 새로고침·탭 정리·로그아웃으로 사라지면 그 주소를 아는 곳이 없어져 최대 1시간 동안 지울 수도 없다.
 * 그래서 주소를 탭 저장소에 적어 두었다가 다음에 편집 화면이 열릴 때 서버에서 지운다.
 * 저장소를 쓸 수 없으면(사생활 보호 모드 등) 조용히 아무 일도 하지 않는다.
 */

const key = (slug: string) => `wedding-editor-pending:${slug}`

function read(slug: string): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key(slug)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function write(slug: string, urls: string[]): void {
  try {
    if (urls.length === 0) sessionStorage.removeItem(key(slug))
    else sessionStorage.setItem(key(slug), JSON.stringify(urls))
  } catch {
    /* 무시 */
  }
}

export function loadPendingPhotos(slug: string): string[] {
  return read(slug)
}

export function addPendingPhoto(slug: string, url: string): void {
  const urls = read(slug)
  if (!urls.includes(url)) write(slug, [...urls, url])
}

export function removePendingPhotos(slug: string, remove: Iterable<string>): void {
  const urls = read(slug)
  if (urls.length === 0) return
  const drop = new Set(remove)
  const next = urls.filter((u) => !drop.has(u))
  if (next.length !== urls.length) write(slug, next)
}

/**
 * 저장 요청이 실패했을 때, 서버가 "확실히 거절" 했는가 (= 저장되지 않았다고 믿어도 되는가).
 * 4xx 는 확실한 거절. 네트워크 오류·시간 초과(상태 없음/0)·5xx 는 서버가 이미 저장했을 수도 있다.
 */
export function isDefiniteRejection(status: number | null): boolean {
  return status !== null && status >= 400 && status < 500
}
