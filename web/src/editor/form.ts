/**
 * 편집 화면의 폼 상태 ↔ WeddingConfig 변환과 기본값. 순수 함수 (DOM·네트워크 없음).
 *
 * 폼은 입력 그대로의 "문자열" 을 들고 있고(숫자·날짜·여러 줄 글 포함), 저장할 때 formToConfig 로
 * 서버가 받는 형태로 조립한다. 서버는 모르는 키를 400 으로 거절하므로 여기서 만든 키만 보낸다.
 */
import { DEFAULT_COORDS, VENUE_PLACEHOLDER } from '../lib/venue'
import type { Account, Person, WeddingConfig } from '../config/wedding'
import { formatKoreanDate } from '../lib/date'
import { PLATFORM_LIMITS } from '../platform/contract'
import { fromKstIso, toKstIso } from './datetime'

export interface PersonForm {
  name: string
  /** 표지용 이름. 비워 두면 이름에서 자동으로 만든다 */
  firstName: string
  relation: string
  fatherName: string
  fatherDeceased: boolean
  motherName: string
  motherDeceased: boolean
  phone: string
}

export interface TransportForm {
  id: string
  title: string
  /** 한 줄에 하나씩 */
  lines: string
}

export interface AccountForm {
  id: string
  role: string
  bank: string
  number: string
  holder: string
  kakaoPayUrl: string
}

export interface EditorForm {
  groom: PersonForm
  bride: PersonForm
  date: string
  time: string
  durationMinutes: string
  venue: { name: string; hall: string; address: string; tel: string; lat: string; lng: string }
  transport: TransportForm[]
  greetingTitle: string
  greetingBody: string
  /** 서버 상대 경로("/uploads/…"). 없으면 "" */
  coverImage: string
  gallery: string[]
  groomAccounts: AccountForm[]
  brideAccounts: AccountForm[]
  /** 비워 두면 자동 문구 */
  shareTitle: string
  shareDescription: string
}

export { DEFAULT_COORDS, VENUE_PLACEHOLDER }
export const DEFAULT_DURATION = 90

export const DEFAULT_GREETING = {
  title: '초대합니다',
  body: [
    '서로 다른 길을 걸어온 두 사람이',
    '이제 같은 길을 함께 걸어가려 합니다.',
    '',
    '저희의 새로운 시작을',
    '가까이에서 축복해 주시면 감사하겠습니다.',
  ],
} as const

const T = PLATFORM_LIMITS.text

let seq = 0
/** 목록 항목용 화면 전용 id (저장되지 않음) */
export function newId(): string {
  seq += 1
  return `i${seq}`
}

/** 코드포인트 기준 길이 (서버와 같은 기준) */
export function textLength(s: string): number {
  return [...s].length
}

/** 서버와 같은 정제: 제어문자 제거 후 트림 */
export function clean(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001F\u007F]/g, '').trim()
}

function clip(s: string, max: number): string {
  const cp = [...s]
  return cp.length > max ? cp.slice(0, max).join('') : s
}

/** "김신랑" → "신랑". 한글 이름이 아니면 그대로 */
export function autoFirstName(name: string): string {
  const n = clean(name)
  const cp = [...n]
  if (cp.length >= 2 && /^[가-힣]+$/.test(n)) return cp.slice(1).join('')
  return n
}

export function autoShareTitle(groomName: string, brideName: string): string {
  return clip(`${clean(groomName) || '신랑'} ♥ ${clean(brideName) || '신부'} 결혼합니다`, T.short)
}

/** "2027년 5월 15일 토요일 오후 12시 30분 · OO웨딩홀" */
export function autoShareDescription(datetimeIso: string | null, venueName: string): string {
  const t = datetimeIso ? Date.parse(datetimeIso) : NaN
  const when = Number.isNaN(t) ? '' : formatKoreanDate(new Date(t))
  const venue = clean(venueName)
  const where = venue && venue !== VENUE_PLACEHOLDER ? venue : ''
  return clip([when, where].filter(Boolean).join(' · '), T.line)
}

/** 여러 줄 입력 → 줄 배열. 줄 끝 공백과 맨 앞·맨 끝의 빈 줄은 버리고, 가운데 빈 줄(문단 나눔)은 유지 */
export function splitLines(text: string, opts: { keepBlank: boolean }): string[] {
  const lines = text.split(/\r?\n/).map(clean)
  if (!opts.keepBlank) return lines.filter((l) => l !== '')
  let start = 0
  let end = lines.length
  while (start < end && lines[start] === '') start++
  while (end > start && lines[end - 1] === '') end--
  return lines.slice(start, end)
}

export function emptyPerson(): PersonForm {
  return {
    name: '',
    firstName: '',
    relation: '',
    fatherName: '',
    fatherDeceased: false,
    motherName: '',
    motherDeceased: false,
    phone: '',
  }
}

export function emptyTransport(): TransportForm {
  return { id: newId(), title: '', lines: '' }
}

export function emptyAccount(role = ''): AccountForm {
  return { id: newId(), role, bank: '', number: '', holder: '', kakaoPayUrl: '' }
}

export function isBlankAccount(a: AccountForm): boolean {
  return [a.bank, a.number, a.holder, a.kakaoPayUrl].every((v) => clean(v) === '')
}

export function isBlankTransport(t: TransportForm): boolean {
  return clean(t.title) === '' && splitLines(t.lines, { keepBlank: false }).length === 0
}

// ── 새 청첩장 ─────────────────────────────────────────────────

export interface CreateInput {
  groomName: string
  brideName: string
  date: string
  time: string
}

/** /new 에서 입력한 최소 정보로 서버 검증을 통과하는 기본 WeddingConfig 를 만든다 */
export function buildInitialConfig(input: CreateInput): WeddingConfig {
  const groom = clean(input.groomName)
  const bride = clean(input.brideName)
  const datetime = toKstIso(input.date, input.time)
  if (!datetime) throw new Error('예식 날짜와 시간을 확인해 주세요.')
  return {
    groom: { name: groom, firstName: autoFirstName(groom), relation: '아들' },
    bride: { name: bride, firstName: autoFirstName(bride), relation: '딸' },
    datetime,
    durationMinutes: DEFAULT_DURATION,
    venue: {
      name: VENUE_PLACEHOLDER,
      hall: '',
      address: '',
      lat: DEFAULT_COORDS.lat,
      lng: DEFAULT_COORDS.lng,
      transport: [],
    },
    greeting: { title: DEFAULT_GREETING.title, body: [...DEFAULT_GREETING.body] },
    gallery: [],
    accounts: { groomSide: [], brideSide: [] },
    share: {
      title: autoShareTitle(groom, bride),
      description: autoShareDescription(datetime, VENUE_PLACEHOLDER),
    },
  }
}

// ── config → 폼 ───────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function personToForm(p: Person | undefined): PersonForm {
  const name = str(p?.name)
  const firstName = str(p?.firstName)
  return {
    name,
    // 자동으로 만든 값과 같으면 비워 두어 이름을 고칠 때 함께 따라가게 한다
    firstName: firstName === autoFirstName(name) ? '' : firstName,
    relation: str(p?.relation),
    fatherName: str(p?.father?.name),
    fatherDeceased: p?.father?.deceased === true,
    motherName: str(p?.mother?.name),
    motherDeceased: p?.mother?.deceased === true,
    phone: str(p?.phone),
  }
}

function accountToForm(a: Account): AccountForm {
  return {
    id: newId(),
    role: str(a.role),
    bank: str(a.bank),
    number: str(a.number),
    holder: str(a.holder),
    kakaoPayUrl: str(a.kakaoPayUrl),
  }
}

const numStr = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '')

export function configToForm(config: WeddingConfig): EditorForm {
  const dt = fromKstIso(str(config.datetime))
  const venue = config.venue
  const shareTitle = str(config.share?.title)
  const shareDescription = str(config.share?.description)
  return {
    groom: personToForm(config.groom),
    bride: personToForm(config.bride),
    date: dt?.date ?? '',
    time: dt?.time ?? '',
    durationMinutes: numStr(config.durationMinutes) || String(DEFAULT_DURATION),
    venue: {
      name: str(venue?.name) === VENUE_PLACEHOLDER ? '' : str(venue?.name),
      hall: str(venue?.hall),
      address: str(venue?.address),
      tel: str(venue?.tel),
      lat: numStr(venue?.lat),
      lng: numStr(venue?.lng),
    },
    transport: (venue?.transport ?? []).map((b) => ({
      id: newId(),
      title: str(b.title),
      lines: (b.lines ?? []).join('\n'),
    })),
    greetingTitle: str(config.greeting?.title),
    greetingBody: (config.greeting?.body ?? []).join('\n'),
    coverImage: str(config.coverImage),
    gallery: [...(config.gallery ?? [])],
    groomAccounts: (config.accounts?.groomSide ?? []).map(accountToForm),
    brideAccounts: (config.accounts?.brideSide ?? []).map(accountToForm),
    shareTitle: shareTitle === autoShareTitle(str(config.groom?.name), str(config.bride?.name)) ? '' : shareTitle,
    shareDescription:
      shareDescription === autoShareDescription(str(config.datetime), str(venue?.name)) ? '' : shareDescription,
  }
}

// ── 폼 → config ───────────────────────────────────────────────

function personToConfig(p: PersonForm): Person {
  const name = clean(p.name)
  const out: Person = {
    name,
    firstName: clean(p.firstName) || autoFirstName(name),
    relation: clean(p.relation),
  }
  const father = clean(p.fatherName)
  if (father) out.father = p.fatherDeceased ? { name: father, deceased: true } : { name: father }
  const mother = clean(p.motherName)
  if (mother) out.mother = p.motherDeceased ? { name: mother, deceased: true } : { name: mother }
  const phone = clean(p.phone)
  if (phone) out.phone = phone
  return out
}

function accountToConfig(a: AccountForm, fallbackRole: string): Account {
  const out: Account = {
    role: clean(a.role) || fallbackRole,
    bank: clean(a.bank),
    number: clean(a.number),
    holder: clean(a.holder),
  }
  const url = clean(a.kakaoPayUrl)
  if (url) out.kakaoPayUrl = url
  return out
}

/** 폼에 실제로 적용될 공유 문구 (비어 있으면 자동 문구) */
export function effectiveShare(form: EditorForm): { title: string; description: string } {
  const venueName = clean(form.venue.name) || VENUE_PLACEHOLDER
  return {
    title: clean(form.shareTitle) || autoShareTitle(form.groom.name, form.bride.name),
    description: clean(form.shareDescription) || autoShareDescription(toKstIso(form.date, form.time), venueName),
  }
}

/**
 * 폼 → 서버에 보낼 WeddingConfig. validateForm 을 통과한 폼을 넣는 것을 전제로 하지만,
 * 통과하지 못한 값이 와도 예외 없이 "가장 가까운" 값을 만든다(변경 여부 비교용으로도 쓰인다).
 * 비어 있는 선택 항목(부모님, 연락처, 전화, 표지, 카카오페이)은 키 자체를 넣지 않는다.
 */
export function formToConfig(form: EditorForm): WeddingConfig {
  const lat = Number(form.venue.lat)
  const lng = Number(form.venue.lng)
  const duration = Number(form.durationMinutes)
  const venue: WeddingConfig['venue'] = {
    name: clean(form.venue.name) || VENUE_PLACEHOLDER,
    hall: clean(form.venue.hall),
    address: clean(form.venue.address),
    lat: form.venue.lat.trim() !== '' && Number.isFinite(lat) ? lat : DEFAULT_COORDS.lat,
    lng: form.venue.lng.trim() !== '' && Number.isFinite(lng) ? lng : DEFAULT_COORDS.lng,
    transport: form.transport
      .filter((b) => !isBlankTransport(b))
      .map((b) => ({ title: clean(b.title), lines: splitLines(b.lines, { keepBlank: false }) })),
  }
  const tel = clean(form.venue.tel)
  if (tel) venue.tel = tel

  const config: WeddingConfig = {
    groom: personToConfig(form.groom),
    bride: personToConfig(form.bride),
    datetime: toKstIso(form.date, form.time) ?? '',
    durationMinutes: Number.isInteger(duration) ? duration : DEFAULT_DURATION,
    venue,
    greeting: { title: clean(form.greetingTitle), body: splitLines(form.greetingBody, { keepBlank: true }) },
    gallery: [...form.gallery],
    accounts: {
      groomSide: form.groomAccounts.filter((a) => !isBlankAccount(a)).map((a) => accountToConfig(a, '신랑')),
      brideSide: form.brideAccounts.filter((a) => !isBlankAccount(a)).map((a) => accountToConfig(a, '신부')),
    },
    share: effectiveShare(form),
  }
  if (form.coverImage) config.coverImage = form.coverImage
  return config
}

/** 저장된 내용과 비교하기 위한 지문. 화면 전용 id 와 무관하다 */
export function formFingerprint(form: EditorForm): string {
  return JSON.stringify(formToConfig(form))
}

/** config 가 참조하는 업로드 경로 전부 (표지 + 갤러리) */
export function photoRefs(config: Pick<WeddingConfig, 'coverImage' | 'gallery'>): string[] {
  return [...(config.coverImage ? [config.coverImage] : []), ...(config.gallery ?? [])]
}

/** 배열 항목을 한 칸 옮긴다 (범위를 벗어나면 그대로) */
export function moveItem<T>(list: readonly T[], index: number, delta: number): T[] {
  const to = index + delta
  const out = [...list]
  if (index < 0 || index >= out.length || to < 0 || to >= out.length) return out
  const [item] = out.splice(index, 1)
  out.splice(to, 0, item)
  return out
}
