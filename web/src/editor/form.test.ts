import { describe, expect, it } from 'vitest'
import { wedding as demo } from '../config/wedding'
import type { WeddingConfig } from '../config/wedding'
import {
  autoFirstName,
  autoShareDescription,
  autoShareTitle,
  buildInitialConfig,
  configToForm,
  DEFAULT_COORDS,
  emptyAccount,
  emptyTransport,
  formFingerprint,
  formToConfig,
  moveItem,
  photoRefs,
  splitLines,
  VENUE_PLACEHOLDER,
} from './form'
import { validateForm } from './validate'

/** 서버가 허용하는 키 (server/src/wedding-config.js) */
const TOP_KEYS = ['groom', 'bride', 'datetime', 'durationMinutes', 'venue', 'greeting', 'coverImage', 'gallery', 'accounts', 'share']
const PERSON_KEYS = ['name', 'firstName', 'relation', 'father', 'mother', 'phone']
const VENUE_KEYS = ['name', 'hall', 'address', 'tel', 'lat', 'lng', 'transport']
const ACCOUNT_KEYS = ['role', 'bank', 'number', 'holder', 'kakaoPayUrl']

function expectOnlyKnownKeys(c: WeddingConfig) {
  const json = JSON.parse(JSON.stringify(c)) as Record<string, any>
  const only = (o: object, keys: string[]) => {
    for (const k of Object.keys(o)) expect(keys, `unexpected key ${k}`).toContain(k)
  }
  only(json, TOP_KEYS)
  only(json.groom, PERSON_KEYS)
  only(json.bride, PERSON_KEYS)
  only(json.venue, VENUE_KEYS)
  for (const p of [json.groom.father, json.groom.mother, json.bride.father, json.bride.mother]) {
    if (p) only(p, ['name', 'deceased'])
  }
  for (const b of json.venue.transport) only(b, ['title', 'lines'])
  only(json.greeting, ['title', 'body'])
  only(json.accounts, ['groomSide', 'brideSide'])
  for (const a of [...json.accounts.groomSide, ...json.accounts.brideSide]) only(a, ACCOUNT_KEYS)
  only(json.share, ['title', 'description'])
  // null / 빈 선택 항목은 키 자체가 없어야 한다
  expect(JSON.stringify(json)).not.toMatch(/:null/)
}

describe('buildInitialConfig', () => {
  const config = buildInitialConfig({ groomName: ' 김신랑 ', brideName: '박신부', date: '2027-05-15', time: '12:30' })

  it('입력한 이름·일시와 서버 검증을 통과하는 기본값', () => {
    expect(config.groom).toEqual({ name: '김신랑', firstName: '신랑', relation: '아들' })
    expect(config.bride.name).toBe('박신부')
    expect(config.datetime).toBe('2027-05-15T12:30:00+09:00')
    expect(config.durationMinutes).toBe(90)
    expect(config.venue.name).toBe(VENUE_PLACEHOLDER) // 서버는 장소 이름을 비워 둘 수 없다
    expect(config.venue.lat).toBe(DEFAULT_COORDS.lat)
    expect(config.venue.transport).toEqual([])
    expect(config.gallery).toEqual([])
    expect(config.coverImage).toBeUndefined()
    expect(config.accounts).toEqual({ groomSide: [], brideSide: [] })
    expect(config.greeting.body.length).toBeGreaterThan(0)
    expect(config.share.title).toBe('김신랑 ♥ 박신부 결혼합니다')
    expect(config.share.description).toBe('2027년 5월 15일 토요일 오후 12시 30분')
    expectOnlyKnownKeys(config)
  })

  it('만든 직후에는 장소를 정하지 않은 채로도 바로 저장할 수 있다', () => {
    const form = configToForm(config)
    expect(form.venue.name).toBe('')
    expect(validateForm(form)).toEqual({})
    // 아무것도 고치지 않았으면 그대로 다시 저장할 수 있는 내용이 나온다
    expect(formToConfig(form)).toEqual(config)
  })

  it('날짜가 틀리면 예외', () => {
    expect(() => buildInitialConfig({ groomName: '가', brideName: '나', date: '2027-02-30', time: '12:00' })).toThrow()
  })
})

describe('configToForm ↔ formToConfig', () => {
  it('데모 청첩장 왕복: undefined 없이 같은 내용', () => {
    const out = formToConfig(configToForm(demo))
    expectOnlyKnownKeys(out)
    expect(out).not.toHaveProperty('coverImage')
    const { coverImage: _c, ...rest } = demo
    expect(out).toEqual(rest)
  })

  it('자동 값과 같은 표지용 이름·공유 문구는 폼에서 비워 두어 이후 변경을 따라간다', () => {
    const form = configToForm(demo)
    expect(form.groom.firstName).toBe('')
    expect(form.shareTitle).toBe('')
    expect(form.shareDescription).toBe('')
    form.groom.name = '이몽룡'
    form.venue.name = '광한루'
    const out = formToConfig(form)
    expect(out.groom.firstName).toBe('몽룡')
    expect(out.share.title).toBe('이몽룡 ♥ 박신부 결혼합니다')
    expect(out.share.description).toBe('2027년 5월 15일 토요일 오후 12시 30분 · 광한루')
  })

  it('직접 쓴 표지용 이름·공유 문구는 유지', () => {
    const form = configToForm({ ...demo, groom: { ...demo.groom, firstName: 'Shin' }, share: { title: '우리 결혼해요', description: '와 주세요' } })
    expect(form.groom.firstName).toBe('Shin')
    expect(form.shareTitle).toBe('우리 결혼해요')
    const out = formToConfig(form)
    expect(out.groom.firstName).toBe('Shin')
    expect(out.share).toEqual({ title: '우리 결혼해요', description: '와 주세요' })
  })

  it('비어 있는 선택 항목은 키를 넣지 않고, 故 표시는 이름이 있을 때만', () => {
    const form = configToForm(demo)
    form.groom.fatherName = '  '
    form.groom.fatherDeceased = true
    form.groom.motherDeceased = true
    form.groom.phone = ''
    form.venue.tel = ' '
    const out = formToConfig(form)
    expect(out.groom).not.toHaveProperty('father')
    expect(out.groom.mother).toEqual({ name: '이어머니', deceased: true })
    expect(out.groom).not.toHaveProperty('phone')
    expect(out.venue).not.toHaveProperty('tel')
    expect(out.bride.father).toEqual({ name: '박아버지' }) // deceased:false 는 보내지 않는다
    expectOnlyKnownKeys(out)
  })

  it('교통 안내·계좌: 빈 항목은 버리고 여러 줄 입력을 줄 배열로', () => {
    const form = configToForm(demo)
    form.transport = [
      { ...emptyTransport(), title: ' 지하철 ', lines: '2호선 시청역\n\n  1호선 시청역  \n' },
      emptyTransport(),
    ]
    form.groomAccounts = [
      { ...emptyAccount('신랑'), bank: '가은행', number: '1-2-3', holder: '김신랑', kakaoPayUrl: ' https://qr.kakaopay.com/abc ' },
      emptyAccount('신랑 아버지'), // 받는 분만 있고 나머지가 비어 있으면 버린다
    ]
    form.brideAccounts = [{ ...emptyAccount(''), bank: '나은행', number: '9', holder: '박신부' }]
    const out = formToConfig(form)
    expect(out.venue.transport).toEqual([{ title: '지하철', lines: ['2호선 시청역', '1호선 시청역'] }])
    expect(out.accounts.groomSide).toEqual([
      { role: '신랑', bank: '가은행', number: '1-2-3', holder: '김신랑', kakaoPayUrl: 'https://qr.kakaopay.com/abc' },
    ])
    expect(out.accounts.brideSide).toEqual([{ role: '신부', bank: '나은행', number: '9', holder: '박신부' }])
  })

  it('인사말: 가운데 빈 줄은 유지, 앞뒤 빈 줄은 제거', () => {
    const form = configToForm(demo)
    form.greetingBody = '\n첫 줄  \n\n둘째 줄\n\n\n'
    expect(formToConfig(form).greeting.body).toEqual(['첫 줄', '', '둘째 줄'])
  })

  it('사진 경로는 그대로, 표지가 없으면 키 없음', () => {
    const form = configToForm({ ...demo, coverImage: '/uploads/abc/1.jpg', gallery: ['/uploads/abc/2.jpg'] })
    const out = formToConfig(form)
    expect(out.coverImage).toBe('/uploads/abc/1.jpg')
    expect(out.gallery).toEqual(['/uploads/abc/2.jpg'])
    expect(photoRefs(out)).toEqual(['/uploads/abc/1.jpg', '/uploads/abc/2.jpg'])
    form.coverImage = ''
    expect(formToConfig(form)).not.toHaveProperty('coverImage')
  })

  it('좌표·소요 시간은 숫자로', () => {
    const form = configToForm(demo)
    form.venue.lat = '35.1795543'
    form.venue.lng = ' 129.0756416 '
    form.durationMinutes = '60'
    const out = formToConfig(form)
    expect(out.venue.lat).toBe(35.1795543)
    expect(out.venue.lng).toBe(129.0756416)
    expect(out.durationMinutes).toBe(60)
  })

  it('지문은 화면 전용 id 와 무관하고 내용이 바뀌면 달라진다', () => {
    const a = configToForm(demo)
    const b = configToForm(demo)
    expect(a.transport[0].id).not.toBe(b.transport[0].id)
    expect(formFingerprint(a)).toBe(formFingerprint(b))
    b.greetingTitle = '모십니다'
    expect(formFingerprint(a)).not.toBe(formFingerprint(b))
  })

  it('불완전한 config 도 예외 없이 폼으로', () => {
    const form = configToForm({ groom: { name: '가' } } as unknown as WeddingConfig)
    expect(form.groom.name).toBe('가')
    expect(form.transport).toEqual([])
    expect(form.gallery).toEqual([])
    expect(form.date).toBe('')
  })
})

describe('자동 문구', () => {
  it('autoFirstName', () => {
    expect(autoFirstName('김신랑')).toBe('신랑')
    expect(autoFirstName('김준')).toBe('준')
    expect(autoFirstName('John Kim')).toBe('John Kim')
    expect(autoFirstName('')).toBe('')
  })
  it('autoShareTitle 은 60자를 넘지 않는다', () => {
    expect([...autoShareTitle('가'.repeat(40), '나'.repeat(40))].length).toBeLessThanOrEqual(60)
  })
  it('autoShareDescription: 장소가 미정이면 날짜만', () => {
    expect(autoShareDescription('2027-05-15T12:30:00+09:00', VENUE_PLACEHOLDER)).toBe('2027년 5월 15일 토요일 오후 12시 30분')
    expect(autoShareDescription(null, 'OO홀')).toBe('OO홀')
    expect(autoShareDescription(null, '')).toBe('')
  })
})

describe('splitLines / moveItem', () => {
  it('splitLines', () => {
    expect(splitLines('a\r\n\r\nb', { keepBlank: true })).toEqual(['a', '', 'b'])
    expect(splitLines('a\n\nb', { keepBlank: false })).toEqual(['a', 'b'])
    expect(splitLines('', { keepBlank: true })).toEqual([])
  })
  it('moveItem', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
    expect(moveItem(['a'], -1, 1)).toEqual(['a'])
  })
})
