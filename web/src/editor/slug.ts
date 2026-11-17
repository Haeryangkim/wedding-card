/**
 * 주소 이름(slug) 규칙 — 순수 함수. 규칙의 기준은 platform/contract.ts (SLUG_PATTERN, RESERVED_SLUGS).
 */
import { RESERVED_SLUGS, SLUG_PATTERN } from '../platform/contract'

export const SLUG_MIN = 3
export const SLUG_MAX = 30

/** 입력 중인 값을 규칙에 맞게 다듬는다: 소문자화, 공백·밑줄 → 하이픈, 허용되지 않는 문자 제거 */
export function normalizeSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, SLUG_MAX)
}

/** 규칙 위반이면 한국어 안내 문구, 통과하면 null */
export function slugError(slug: string): string | null {
  if (slug === '') return '주소 이름을 입력해 주세요.'
  if (!/^[a-z0-9-]+$/.test(slug)) return '영문 소문자, 숫자, 하이픈(-)만 쓸 수 있어요.'
  if (slug.length < SLUG_MIN) return `${SLUG_MIN}자 이상 입력해 주세요.`
  if (slug.length > SLUG_MAX) return `${SLUG_MAX}자 이하로 입력해 주세요.`
  if (slug.startsWith('-') || slug.endsWith('-')) return '하이픈(-)으로 시작하거나 끝날 수 없어요.'
  if (!SLUG_PATTERN.test(slug)) return '영문 소문자, 숫자, 하이픈(-) 3~30자로 입력해 주세요.'
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return '사용할 수 없는 주소예요. 다른 이름을 정해 주세요.'
  return null
}

/**
 * 예식 날짜("YYYY-MM-DD")로 주소 이름을 제안한다. 한글 이름을 로마자로 바꾸지 않는다.
 * attempt 0 → "wedding-270515", 1 → "wedding-270515-2", ...  날짜가 없으면 "our-wedding".
 */
export function suggestSlug(date: string, attempt = 0): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const base = m ? `wedding-${m[1].slice(2)}${m[2]}${m[3]}` : 'our-wedding'
  return attempt > 0 ? `${base}-${attempt + 1}` : base
}
