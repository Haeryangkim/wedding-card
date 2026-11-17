import { describe, it, expect } from 'vitest'
import {
  charLen,
  collapseText,
  truncate,
  validateNewGuest,
  hasFieldErrors,
  sanitizeEntry,
  sanitizeList,
  sanitizeNewInput,
} from './validate'
import { LIMITS } from './types'

describe('collapseText', () => {
  it('연속 공백을 한 칸으로 합치고 양끝을 다듬는다', () => {
    expect(collapseText('  안녕   하세요  ')).toBe('안녕 하세요')
  })
  it('제어문자/줄바꿈/탭을 제거하거나 공백으로 정규화한다', () => {
    expect(collapseText('a\u0000b\tc\nd')).toBe('a b c d')
  })
})

describe('charLen / truncate (코드포인트 기준)', () => {
  it('이모지를 한 글자로 센다', () => {
    expect(charLen('a💕b')).toBe(3)
  })
  it('코드포인트 단위로 자른다', () => {
    expect(truncate('가나다라', 2)).toBe('가나')
    expect(truncate('💕💕💕', 2)).toBe('💕💕')
  })
})

describe('validateNewGuest', () => {
  const ok = { name: '민준', message: '축하해요', password: '1234' }

  it('정상 입력은 오류가 없다', () => {
    const errors = validateNewGuest(ok)
    expect(hasFieldErrors(errors)).toBe(false)
  })
  it('빈 이름/메시지는 오류', () => {
    const errors = validateNewGuest({ name: '  ', message: '', password: '1234' })
    expect(errors.name).toBeTruthy()
    expect(errors.message).toBeTruthy()
  })
  it('길이 초과는 오류', () => {
    const errors = validateNewGuest({
      name: '가'.repeat(LIMITS.name + 1),
      message: '나'.repeat(LIMITS.message + 1),
      password: '1234',
    })
    expect(errors.name).toBeTruthy()
    expect(errors.message).toBeTruthy()
  })
  it('짧은 비밀번호는 오류', () => {
    const errors = validateNewGuest({ ...ok, password: '12' })
    expect(errors.password).toBeTruthy()
  })
})

describe('sanitizeNewInput', () => {
  it('이름/메시지를 정제하고 side 를 보정한다 (비밀번호 원문 유지)', () => {
    const out = sanitizeNewInput({
      name: '  민  준  ',
      message: '축하\n합니다',
      // @ts-expect-error 잘못된 side 값도 보정되는지 확인
      side: 'xxx',
      appearance: { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0 },
      password: ' pw12 ',
    })
    expect(out.name).toBe('민 준')
    expect(out.message).toBe('축하 합니다')
    expect(out.side).toBe('groom')
    expect(out.password).toBe(' pw12 ')
  })
})

describe('sanitizeEntry (신뢰 불가 데이터 방어)', () => {
  const base = {
    id: 'x1',
    name: '민준',
    message: '축하해요',
    side: 'bride',
    appearance: { skin: 1, hairStyle: 1, hairColor: 1, outfit: 1, outfitColor: 1, accessory: 1 },
    createdAt: 1700000000000,
  }

  it('정상 객체를 통과시킨다', () => {
    const e = sanitizeEntry(base)
    expect(e).not.toBeNull()
    expect(e?.id).toBe('x1')
    expect(e?.side).toBe('bride')
  })
  it('객체가 아니거나 id 가 없으면 null', () => {
    expect(sanitizeEntry(null)).toBeNull()
    expect(sanitizeEntry('str')).toBeNull()
    expect(sanitizeEntry({ ...base, id: '' })).toBeNull()
  })
  it('이름/메시지가 비면 null, 길이는 잘린다', () => {
    expect(sanitizeEntry({ ...base, name: '   ' })).toBeNull()
    const long = sanitizeEntry({ ...base, name: '가'.repeat(100) })
    expect(charLen(long?.name ?? '')).toBe(LIMITS.name)
  })
  it('side 가 이상하면 groom 으로 보정, createdAt 이 이상하면 숫자로 보정', () => {
    const e = sanitizeEntry({ ...base, side: 'nope', createdAt: 'bad' })
    expect(e?.side).toBe('groom')
    expect(typeof e?.createdAt).toBe('number')
  })
})

describe('sanitizeList', () => {
  it('잘못된 항목을 버리고 id 중복 제거 + createdAt 오름차순 정렬', () => {
    const list = sanitizeList([
      { id: 'b', name: 'b', message: 'm', side: 'groom', createdAt: 200 },
      null,
      { id: 'a', name: 'a', message: 'm', side: 'groom', createdAt: 100 },
      { id: 'a', name: 'a2', message: 'm2', side: 'bride', createdAt: 150 },
      'garbage',
    ])
    expect(list.map((e) => e.id)).toEqual(['a', 'b'])
    expect(list[0].name).toBe('a2') // 뒤에 온 중복 값이 우선
  })
  it('배열이 아니면 빈 배열', () => {
    expect(sanitizeList({})).toEqual([])
  })
})
