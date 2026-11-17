/**
 * 범용 청첩장 플랫폼 계약 (web ↔ server 공용 문서).
 * 이 파일은 타입/상수만 담고 DOM·import.meta 를 참조하지 않습니다.
 * 서버(server/)는 JS 이므로 이 파일을 import 하지 않고 같은 규칙을 그대로 구현합니다 — 바꾸면 양쪽을 함께 수정.
 *
 * 개념
 *  - 서비스(플랫폼): 누구나 청첩장을 만들 수 있는 사이트. "/" 는 서비스 소개(랜딩).
 *  - 청첩장 인스턴스: slug 로 구분되는 하나의 청첩장. 주소는 /w/<slug>.
 *  - 관리: 계정 없음. 만들 때 정한 "관리 비밀번호"로 /w/<slug>/edit 에서 로그인 → 토큰 발급.
 *  - 데모: slug "demo" 는 프론트에 번들된 예시(김신랑·박신부). 서버 없이도 동작하고 방명록은 이 기기에만 저장.
 *
 * 라우트 (프론트, base path 뒤)
 *   /                 랜딩 (서비스 소개, "청첩장 만들기", "데모 보기")
 *   /new              새 청첩장 만들기
 *   /w/demo           데모 청첩장
 *   /w/:slug          청첩장
 *   /w/:slug/edit     관리(편집) 화면 — 비밀번호 로그인
 *
 * REST (모두 JSON, 오류는 4xx/5xx {error: string}; 인증은 "Authorization: Bearer <token>")
 *   GET    /api/health                               -> {ok:true}
 *   GET    /api/weddings/:slug/availability           -> {available: boolean, reason?: string}
 *   POST   /api/weddings          {slug, password, config}      -> 201 {wedding: WeddingRecord, token, expiresAt}
 *   GET    /api/weddings/:slug                                    -> 200 WeddingRecord | 404
 *   POST   /api/weddings/:slug/login   {password}                -> 200 {token, expiresAt} | 403
 *   PUT    /api/weddings/:slug         (auth) {config}           -> 200 WeddingRecord
 *   PUT    /api/weddings/:slug/password (auth) {password}        -> 204
 *   DELETE /api/weddings/:slug         (auth)                    -> 204   (방명록·사진 포함 전체 삭제)
 *   POST   /api/weddings/:slug/photos  (auth) body = 이미지 바이트, Content-Type: image/jpeg|image/png|image/webp
 *                                                                 -> 201 {url: "/uploads/<slug>/<file>"}
 *   DELETE /api/weddings/:slug/photos/:file (auth)               -> 204
 *   GET    /uploads/:slug/:file                                   -> 이미지 (장기 캐시)
 *   GET    /api/geocode?q=<검색어>                                -> 200 GeocodeResult[]  (장소/주소 → 좌표, 서버가 프록시)
 *   방명록 (청첩장별):
 *   GET    /api/weddings/:slug/guests                             -> 200 GuestEntry[] (createdAt 오름차순)
 *   POST   /api/weddings/:slug/guests   NewGuestInput             -> 201 GuestEntry
 *   DELETE /api/weddings/:slug/guests/:id  {password} 또는 (auth) -> 204 | 403 | 404
 *   GET    /api/weddings/:slug/events   (SSE)  event "added" GuestEntry / "removed" {id}
 *   서버 렌더링(카카오톡 미리보기·캘린더용):
 *   GET    /w/:slug , /w/:slug/edit   -> 프론트 index.html 에 해당 청첩장의 <title>/OG 태그를 주입해 응답
 *   GET    /w/:slug/wedding.ics       -> text/calendar
 */
import type { WeddingConfig } from '../config/wedding'

export interface WeddingRecord {
  slug: string
  config: WeddingConfig
  createdAt: number // epoch ms
  updatedAt: number
}

export interface AuthToken {
  token: string
  expiresAt: number // epoch ms
}

export interface GeocodeResult {
  name: string
  address: string
  lat: number
  lng: number
}

export const DEMO_SLUG = 'demo'

/** 주소 이름 규칙: 영문 소문자·숫자·하이픈, 3~30자, 하이픈으로 시작/끝 불가 */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/
export const RESERVED_SLUGS = [
  'demo', 'new', 'edit', 'api', 'admin', 'uploads', 'assets', 'w', 'www', 'static', 'login', 'help', 'about',
] as const

export const PLATFORM_LIMITS = {
  adminPasswordMin: 6,
  adminPasswordMax: 72,
  /** config JSON 직렬화 최대 바이트 */
  configBytes: 32 * 1024,
  /** 청첩장당 사진 수(표지 포함) / 장당 최대 바이트 (브라우저에서 리사이즈 후 업로드) */
  photosPerWedding: 30,
  photoBytes: 2 * 1024 * 1024,
  galleryMax: 24,
  /** 문자열 필드 길이 상한 */
  text: { name: 20, short: 60, address: 120, line: 120, greetingLines: 20, transportBlocks: 6, accountsPerSide: 4 },
} as const

/**
 * 프론트 API 클라이언트 인터페이스. 구현: platform/api.ts 의 getApi().
 * 서버가 설정되지 않은 빌드(VITE_API_URL 없음 — GitHub Pages 데모)에서는 available === false 이고
 * 모든 메서드는 한국어 메시지의 Error 로 reject 됩니다.
 */
export interface PlatformApi {
  readonly available: boolean
  checkSlug(slug: string): Promise<{ available: boolean; reason?: string }>
  createWedding(input: { slug: string; password: string; config: WeddingConfig }): Promise<{ wedding: WeddingRecord } & AuthToken>
  getWedding(slug: string): Promise<WeddingRecord | null>
  login(slug: string, password: string): Promise<AuthToken>
  updateWedding(slug: string, token: string, config: WeddingConfig): Promise<WeddingRecord>
  changePassword(slug: string, token: string, password: string): Promise<void>
  deleteWedding(slug: string, token: string): Promise<void>
  /** 브라우저에서 이미 리사이즈된 Blob 을 업로드 */
  uploadPhoto(slug: string, token: string, image: Blob): Promise<{ url: string }>
  deletePhoto(slug: string, token: string, url: string): Promise<void>
  geocode(query: string): Promise<GeocodeResult[]>
  /** 관리자 권한으로 방명록 글 삭제 */
  deleteGuestAsOwner(slug: string, token: string, guestId: string): Promise<void>
  /** "/uploads/..." 같은 서버 상대 경로를 실제로 불러올 수 있는 URL 로 변환 (절대 URL 은 그대로) */
  assetUrl(pathOrUrl: string): string
}
