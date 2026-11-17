import { describe, expect, it } from 'vitest'
import { RESERVED_SLUGS, SLUG_PATTERN } from '../platform/contract'
import { normalizeSlugInput, slugError, suggestSlug } from './slug'

describe('slugError', () => {
  it('규칙에 맞는 주소는 통과', () => {
    for (const s of ['abc', 'wedding-270515', 'a1b', 'kim-and-park', 'a'.repeat(30)]) {
      expect(slugError(s), s).toBeNull()
      expect(SLUG_PATTERN.test(s)).toBe(true)
    }
  })

  it('길이·문자·하이픈 위치를 각각 안내', () => {
    expect(slugError('')).toMatch(/입력/)
    expect(slugError('ab')).toMatch(/3자 이상/)
    expect(slugError('a'.repeat(31))).toMatch(/30자 이하/)
    expect(slugError('Abc')).toMatch(/소문자/)
    expect(slugError('우리결혼')).toMatch(/소문자/)
    expect(slugError('-abc')).toMatch(/하이픈/)
    expect(slugError('abc-')).toMatch(/하이픈/)
  })

  it('예약어는 모두 거절 (패턴은 맞더라도)', () => {
    for (const s of RESERVED_SLUGS) expect(slugError(s), s).not.toBeNull()
  })

  it('오류가 없으면 반드시 SLUG_PATTERN 을 만족한다', () => {
    for (const s of ['a-b', 'a--b', '0-0', 'x'.repeat(3), 'new1', 'demo-2']) {
      if (slugError(s) === null) expect(SLUG_PATTERN.test(s), s).toBe(true)
    }
  })
})

describe('normalizeSlugInput', () => {
  it('소문자화, 공백→하이픈, 허용되지 않는 문자 제거, 30자 제한', () => {
    expect(normalizeSlugInput('Kim And Park')).toBe('kim-and-park')
    expect(normalizeSlugInput('우리 wedding_2027!')).toBe('-wedding-2027')
    expect(normalizeSlugInput('a'.repeat(40))).toHaveLength(30)
  })
})

describe('suggestSlug', () => {
  it('날짜 기반 추천 (로마자 변환 없음)', () => {
    expect(suggestSlug('2027-05-15')).toBe('wedding-270515')
    expect(suggestSlug('2027-05-15', 1)).toBe('wedding-270515-2')
    expect(suggestSlug('2027-05-15', 4)).toBe('wedding-270515-5')
    expect(suggestSlug('')).toBe('our-wedding')
  })

  it('추천 주소는 항상 규칙을 통과한다', () => {
    for (let i = 0; i < 6; i++) {
      expect(slugError(suggestSlug('2031-12-01', i))).toBeNull()
      expect(slugError(suggestSlug('', i))).toBeNull()
    }
  })
})
