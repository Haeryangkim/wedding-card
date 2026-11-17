import { describe, expect, it } from 'vitest'
import { wedding as demo } from '../config/wedding'
import { PLATFORM_LIMITS } from '../platform/contract'
import { configToForm, emptyAccount, emptyTransport } from './form'
import type { EditorForm } from './form'
import { isHttpsUrl, passwordError, sectionOfError, sectionOfServerError, validateCreate, validateForm } from './validate'

const base = (): EditorForm => configToForm(demo)

describe('validateForm', () => {
  it('데모 내용은 오류 없음', () => {
    expect(validateForm(base())).toEqual({})
  })

  it('필수 항목: 이름·날짜·시간·장소 이름', () => {
    const f = base()
    f.groom.name = '  '
    f.bride.name = ''
    f.date = ''
    f.time = ''
    f.venue.name = ''
    const e = validateForm(f)
    expect(Object.keys(e)).toEqual(['groom.name', 'bride.name', 'date', 'time']) // 화면 순서
    expect(e['groom.name']).toMatch(/신랑 이름/)
  })

  it('글자 수 상한은 코드포인트 기준 (서버와 동일)', () => {
    const f = base()
    f.groom.name = '가'.repeat(PLATFORM_LIMITS.text.name)
    f.venue.address = '😀'.repeat(PLATFORM_LIMITS.text.address) // UTF-16 으로는 240
    expect(validateForm(f)).toEqual({})
    f.groom.name += '나'
    f.venue.address += '😀'
    f.venue.hall = 'x'.repeat(61)
    expect(Object.keys(validateForm(f))).toEqual(['groom.name', 'venue.hall', 'venue.address'])
  })

  it('소요 시간 10~600 정수', () => {
    const f = base()
    for (const [v, ok] of [['10', true], ['600', true], ['9', false], ['601', false], ['', false], ['1.5', false], ['abc', false]] as const) {
      f.durationMinutes = v
      expect('durationMinutes' in validateForm(f), v).toBe(!ok)
    }
  })

  it('좌표 범위', () => {
    const f = base()
    f.venue.lat = '91'
    f.venue.lng = ''
    const e = validateForm(f)
    expect(e['venue.lat']).toMatch(/-90 ~ 90/)
    expect(e['venue.lng']).toMatch(/숫자/)
    f.venue.lat = '-33.86'
    f.venue.lng = '151.2'
    expect(validateForm(f)).toEqual({})
  })

  it('교통 안내: 개수·줄 수·줄 길이 (빈 항목은 세지 않는다)', () => {
    const f = base()
    f.transport = Array.from({ length: 6 }, (_, i) => ({ ...emptyTransport(), title: `항목 ${i}` }))
    f.transport.push(emptyTransport())
    expect(validateForm(f)).toEqual({})
    f.transport.push({ ...emptyTransport(), title: '하나 더' })
    expect(validateForm(f).transport).toMatch(/6개/)

    const g = base()
    g.transport = [{ ...emptyTransport(), title: '버스', lines: Array.from({ length: 11 }, (_, i) => `줄 ${i}`).join('\n') }]
    expect(validateForm(g)[`transport.${g.transport[0].id}.lines`]).toMatch(/10줄/)
    g.transport[0].lines = 'x'.repeat(121)
    expect(validateForm(g)[`transport.${g.transport[0].id}.lines`]).toMatch(/120자/)
  })

  it('인사말: 20줄, 줄당 120자', () => {
    const f = base()
    f.greetingBody = Array.from({ length: 20 }, () => '줄').join('\n')
    expect(validateForm(f)).toEqual({})
    f.greetingBody += '\n한 줄 더'
    expect(validateForm(f).greetingBody).toMatch(/20줄/)
    f.greetingBody = '가'.repeat(121)
    expect(validateForm(f).greetingBody).toMatch(/120자/)
  })

  it('갤러리 24장', () => {
    const f = base()
    f.gallery = Array.from({ length: 25 }, (_, i) => `/uploads/x/${i}.jpg`)
    expect(validateForm(f).gallery).toMatch(/24장/)
  })

  it('계좌: 한쪽 4개, 입력을 시작했으면 은행·계좌번호·예금주 필수, 카카오페이는 https', () => {
    const f = base()
    const a = { ...emptyAccount('신랑'), bank: '가은행' }
    f.groomAccounts = [a]
    const e = validateForm(f)
    expect(Object.keys(e)).toEqual([`groomAccounts.${a.id}.number`, `groomAccounts.${a.id}.holder`])

    a.number = '1'
    a.holder = '김'
    a.kakaoPayUrl = 'http://qr.kakaopay.com/x'
    expect(validateForm(f)[`groomAccounts.${a.id}.kakaoPayUrl`]).toMatch(/https/)
    a.kakaoPayUrl = 'javascript:alert(1)'
    expect(validateForm(f)[`groomAccounts.${a.id}.kakaoPayUrl`]).toBeDefined()
    a.kakaoPayUrl = 'https://qr.kakaopay.com/x'
    expect(validateForm(f)).toEqual({})

    f.brideAccounts = Array.from({ length: 5 }, () => ({ ...emptyAccount('신부'), bank: 'b', number: '1', holder: 'h' }))
    expect(validateForm(f).brideAccounts).toMatch(/4개/)
    // 비어 있는 항목은 세지 않는다
    f.brideAccounts[4] = emptyAccount('신부')
    expect(validateForm(f)).toEqual({})
  })

  it('공유 문구 길이', () => {
    const f = base()
    f.shareTitle = 'x'.repeat(61)
    f.shareDescription = 'y'.repeat(121)
    expect(Object.keys(validateForm(f))).toEqual(['shareTitle', 'shareDescription'])
  })

  it('전체 크기(32KB) 초과는 인사말 쪽에 알린다', () => {
    const f = base()
    // 각 필드는 상한 이내지만 합치면 32KB 를 넘는 내용 (이모지 4바이트 × 120자 × 10줄 × 6블록 …)
    f.transport = Array.from({ length: 6 }, () => ({
      ...emptyTransport(),
      title: '가'.repeat(60),
      lines: Array.from({ length: 10 }, () => '😀'.repeat(120)).join('\n'),
    }))
    f.greetingBody = Array.from({ length: 20 }, () => '😀'.repeat(120)).join('\n')
    const e = validateForm(f)
    expect(Object.keys(e)).toEqual(['greetingBody'])
    expect(e.greetingBody).toMatch(/너무 깁니다/)
  })
})

describe('sectionOfError / sectionOfServerError', () => {
  it('폼 오류 경로 → 섹션', () => {
    expect(sectionOfError('groom.name')).toBe('people')
    expect(sectionOfError('time')).toBe('datetime')
    expect(sectionOfError('venue.lat')).toBe('venue')
    expect(sectionOfError('transport.i3.lines')).toBe('transport')
    expect(sectionOfError('greetingBody')).toBe('greeting')
    expect(sectionOfError('gallery')).toBe('photos')
    expect(sectionOfError('brideAccounts.i9.bank')).toBe('accounts')
    expect(sectionOfError('shareTitle')).toBe('share')
  })

  it('서버 검증 메시지 → 섹션', () => {
    const msg = (p: string) => `청첩장 내용이 올바르지 않습니다 — ${p}: 비워 둘 수 없습니다.`
    expect(sectionOfServerError(msg('venue.name'))).toBe('venue')
    expect(sectionOfServerError(msg('venue.transport[0].lines[2]'))).toBe('transport')
    expect(sectionOfServerError(msg('groom.father.name'))).toBe('people')
    expect(sectionOfServerError(msg('datetime'))).toBe('datetime')
    expect(sectionOfServerError(msg('gallery[3]'))).toBe('photos')
    expect(sectionOfServerError(msg('coverImage'))).toBe('photos')
    expect(sectionOfServerError(msg('accounts.groomSide[0].kakaoPayUrl'))).toBe('accounts')
    expect(sectionOfServerError(msg('share.title'))).toBe('share')
    expect(sectionOfServerError(msg('kakaoJsKey'))).toBeNull()
    expect(sectionOfServerError('요청이 너무 잦습니다.')).toBeNull()
  })
})

describe('isHttpsUrl', () => {
  it('https 만, 공백·따옴표 불가', () => {
    expect(isHttpsUrl('https://qr.kakaopay.com/abc')).toBe(true)
    expect(isHttpsUrl('http://a.com')).toBe(false)
    expect(isHttpsUrl('https://a.com/ b')).toBe(false)
    expect(isHttpsUrl('https://a.com/"x')).toBe(false)
    expect(isHttpsUrl('https://')).toBe(false)
  })
})

describe('passwordError / validateCreate', () => {
  it('비밀번호 길이', () => {
    expect(passwordError('12345')).toMatch(/6자 이상/)
    expect(passwordError('123456')).toBeNull()
    expect(passwordError('가나다라마바')).toBeNull()
    expect(passwordError('a'.repeat(73))).toMatch(/72자 이하/)
    expect(passwordError('abc\tdef')).toMatch(/사용할 수 없는/)
  })

  const ok = {
    groomName: '김신랑',
    brideName: '박신부',
    date: '2027-05-15',
    time: '12:30',
    slug: 'wedding-270515',
    password: 'secret1',
    passwordConfirm: 'secret1',
  }

  it('정상 입력', () => {
    expect(validateCreate(ok)).toEqual({})
  })

  it('각 항목 오류', () => {
    const e = validateCreate({ groomName: '', brideName: '가'.repeat(21), date: '', time: '', slug: 'demo', password: '123', passwordConfirm: '124' })
    expect(Object.keys(e).sort()).toEqual(['brideName', 'date', 'groomName', 'password', 'passwordConfirm', 'slug', 'time'].sort())
  })

  it('비밀번호 확인 불일치', () => {
    expect(validateCreate({ ...ok, passwordConfirm: 'secret2' })).toEqual({ passwordConfirm: expect.stringMatching(/달라요/) })
  })
})
