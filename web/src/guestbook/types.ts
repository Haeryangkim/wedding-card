/**
 * 픽셀 방명록 공용 계약. web(프론트)과 server(API)가 이 형태를 공유합니다.
 * 필드를 바꾸면 server/ 와 web/src/guestbook/ 양쪽을 함께 수정해야 합니다.
 */

/** 캐릭터 그림체. 스타일마다 파츠 목록·개수가 다르므로 외형 인덱스는 스타일과 함께일 때만 의미가 있다 */
export type CharacterStyleId = 'pixel' | 'maple' | 'forest'

/** 외형 파츠 — 각 값은 해당 스타일 옵션 배열의 인덱스 (0-based 정수) */
export interface AppearanceParts {
  skin: number
  hairStyle: number
  hairColor: number
  outfit: number
  outfitColor: number
  accessory: number // 0 = 없음
}
export type PartKey = keyof AppearanceParts

export interface Appearance extends AppearanceParts {
  /**
   * 하객이 고른 그림체. 없으면 'pixel'(기본 픽셀) — 스타일 선택이 생기기 전에 저장된 글과 호환.
   * 정규화된 값에서는 'pixel' 일 때 이 필드를 생략한다 (guestbook/styles/registry.ts).
   */
  style?: CharacterStyleId
}

export type Side = 'groom' | 'bride'

export interface GuestEntry {
  id: string
  name: string // 1~12자
  message: string // 1~200자
  side: Side
  appearance: Appearance
  createdAt: number // epoch ms
}

export interface NewGuestInput {
  name: string
  message: string
  side: Side
  appearance: Appearance
  /** 삭제용 비밀번호 (4자 이상). 서버에는 해시로만 저장 */
  password: string
}

export const LIMITS = { name: 12, message: 200, passwordMin: 4 } as const

/**
 * 저장소 어댑터. 구현체:
 *  - LocalStore : localStorage + 샘플 하객 (백엔드 없는 GitHub Pages 데모용)
 *  - ApiStore   : VITE_API_URL 의 REST API + SSE 실시간 (docker 서버)
 *
 * REST 계약 (ApiStore ↔ server):
 *   GET    {base}/api/guests            -> 200 GuestEntry[]   (createdAt 오름차순)
 *   POST   {base}/api/guests            body NewGuestInput -> 201 GuestEntry
 *   DELETE {base}/api/guests/:id        body {password}    -> 204 | 403 {error} | 404 {error}
 *   GET    {base}/api/events  (SSE)     event: "added" data: GuestEntry / event: "removed" data: {id}
 *   GET    {base}/api/health            -> 200 {ok:true}
 *   오류 응답: 4xx/5xx  {error: string}
 */
export interface GuestbookStore {
  readonly mode: 'local' | 'api'
  list(): Promise<GuestEntry[]>
  add(input: NewGuestInput): Promise<GuestEntry>
  remove(id: string, password: string): Promise<void>
  /** 변경(추가/삭제) 시 전체 목록으로 콜백. 반환값은 구독 해제 함수 */
  subscribe(cb: (entries: GuestEntry[]) => void): () => void
}
