/**
 * /new — 새 청첩장 만들기. 꼭 필요한 것만 묻고(이름·일시·주소·관리 비밀번호) 나머지는 관리 화면에서 채운다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { formatKoreanDate } from '../lib/date'
import { DEMO_SLUG, PLATFORM_LIMITS } from '../platform/contract'
import type { PlatformApi } from '../platform/contract'
import { Link, href, navigate } from '../platform/router'
import { toKstIso } from '../editor/datetime'
import { availableApi } from '../editor/env'
import { errorStatus, errorText } from '../editor/errors'
import { buildInitialConfig } from '../editor/form'
import { saveToken } from '../editor/session'
import { normalizeSlugInput, slugError, suggestSlug } from '../editor/slug'
import { CheckField, MessagePanel, Notice, Shell, TextField, fieldId } from '../editor/ui'
import type { CreateForm, FormErrors } from '../editor/validate'
import { validateCreate } from '../editor/validate'
import './CreatePage.css'

export default function CreatePage() {
  const api = useMemo(() => availableApi(), [])
  return (
    <Shell>
        {api ? (
          <CreateFormView api={api} />
        ) : (
          <MessagePanel title="이곳에서는 청첩장을 만들 수 없어요">
            <p>
              지금 보고 계신 사이트는 서버 없이 운영되는 <strong>데모 전용</strong> 배포예요. 청첩장을 만들어 저장하려면
              사진과 방명록을 보관할 서버가 함께 설치되어 있어야 해요.
            </p>
            <p>
              대신 데모 청첩장에서 실제 화면과 픽셀 방명록을 모두 체험해 보실 수 있어요. 직접 운영하고 싶다면 이 프로젝트를
              Docker 로 설치하면 청첩장 만들기까지 그대로 쓸 수 있어요.
            </p>
            <div className="ed-panel__actions">
              <Link className="btn btn--primary" to={`/w/${DEMO_SLUG}`}>
                데모 청첩장 보기
              </Link>
              <Link className="btn btn--soft" to="/">
                처음으로
              </Link>
            </div>
          </MessagePanel>
        )}
    </Shell>
  )
}

type Availability =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; slug: string }
  | { kind: 'taken'; slug: string; reason: string }
  | { kind: 'unknown' } // 확인 실패 — 만들 때 서버가 다시 확인한다

const MAX_AUTO_ATTEMPTS = 5

function CreateFormView({ api }: { api: PlatformApi }) {
  const [groomName, setGroomName] = useState('')
  const [brideName, setBrideName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('12:00')
  /** 직접 고친 주소. null 이면 날짜로 만든 추천 주소를 쓴다 */
  const [customSlug, setCustomSlug] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [serverErrors, setServerErrors] = useState<FormErrors>({})
  const [availability, setAvailability] = useState<Availability>({ kind: 'idle' })

  const slug = customSlug ?? suggestSlug(date, attempt)
  const values: CreateForm = { groomName, brideName, date, time, slug, password, passwordConfirm }
  const clientErrors = validateCreate(values)
  const slugRuleError = slugError(slug)

  // 주소 사용 가능 여부 — 입력이 멈춘 뒤 확인
  const checkNo = useRef(0)
  useEffect(() => {
    const no = ++checkNo.current
    if (slugRuleError) {
      setAvailability({ kind: 'idle' })
      return
    }
    setAvailability({ kind: 'checking' })
    const timer = setTimeout(async () => {
      try {
        const res = await api.checkSlug(slug)
        if (no !== checkNo.current) return
        if (res.available) return setAvailability({ kind: 'ok', slug })
        // 추천 주소가 이미 쓰이고 있으면 다음 후보를 대신 추천한다
        if (customSlug === null && attempt < MAX_AUTO_ATTEMPTS) return setAttempt((a) => a + 1)
        setAvailability({ kind: 'taken', slug, reason: res.reason || '이미 사용 중인 주소예요.' })
      } catch {
        if (no === checkNo.current) setAvailability({ kind: 'unknown' })
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [api, slug, slugRuleError, customSlug, attempt])

  const errorOf = (key: keyof CreateForm, touched: boolean): string | undefined =>
    serverErrors[key] ?? (submitted || touched ? clientErrors[key] : undefined)

  const slugFieldError =
    serverErrors.slug ??
    (customSlug !== null && slug !== '' ? (slugRuleError ?? undefined) : submitted ? clientErrors.slug : undefined) ??
    (availability.kind === 'taken' && availability.slug === slug ? availability.reason : undefined)

  const clearServer = (key: string) => {
    setFormError('')
    setServerErrors((e) => {
      if (!(key in e)) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  const focusFirst = (errs: FormErrors) => {
    const order: (keyof CreateForm)[] = ['groomName', 'brideName', 'date', 'time', 'slug', 'password', 'passwordConfirm']
    const first = order.find((k) => errs[k])
    if (!first) return
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldId(`new.${first}`))
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus({ preventScroll: true })
    })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setSubmitted(true)
    setFormError('')
    const errs: FormErrors = { ...clientErrors }
    if (!errs.slug && availability.kind === 'taken' && availability.slug === slug) errs.slug = availability.reason
    if (Object.keys(errs).length > 0) return focusFirst(errs)

    setBusy(true)
    try {
      const config = buildInitialConfig({ groomName, brideName, date, time })
      const result = await api.createWedding({ slug, password, config })
      saveToken(slug, { token: result.token, expiresAt: result.expiresAt })
      navigate(`/w/${slug}/edit`)
    } catch (err) {
      const status = errorStatus(err)
      const message = errorText(err, '청첩장을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
      if (status === 409) {
        const next = { slug: '방금 다른 분이 먼저 사용한 주소예요. 다른 이름으로 바꿔 주세요.' }
        setServerErrors(next)
        setAvailability({ kind: 'taken', slug, reason: next.slug })
        focusFirst(next)
      } else if (status === 429) {
        setFormError('짧은 시간에 너무 많이 만들었어요. 잠시 후 다시 시도해 주세요.')
      } else if (status === 400 && /^주소|사용할 수 없는 주소/.test(message)) {
        setServerErrors({ slug: message })
        focusFirst({ slug: message })
      } else if (status === 400 && /비밀번호/.test(message)) {
        setServerErrors({ password: message })
        focusFirst({ password: message })
      } else {
        setFormError(message)
      }
      setBusy(false)
    }
  }

  const iso = toKstIso(date, time)
  const urlPrefix = `${window.location.host}${href('/w/')}`
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const touch = (key: string) => () => setTouched((t) => (t[key] ? t : { ...t, [key]: true }))
  const pwType = showPassword ? 'text' : 'password'

  return (
    <form className="new" onSubmit={submit} noValidate>
      <header className="new__head">
        <p className="new__eyebrow">INVITATION</p>
        <h1 className="new__title">청첩장 만들기</h1>
        <p className="new__lead">
          우선 꼭 필요한 것만 여쭤볼게요. 장소·인사말·사진은 만든 뒤에 천천히 채우시면 돼요.
        </p>
      </header>

      <section className="ed-card is-open new__card" aria-labelledby="new-couple">
        <h2 className="new__step" id="new-couple">
          <span>1</span> 두 분의 이름
        </h2>
        <div className="ed-grid">
          <TextField
            path="new.groomName"
            label="신랑 이름"
            value={groomName}
            onChange={(v) => {
              setGroomName(v)
              clearServer('groomName')
            }}
            onBlur={touch('groomName')}
            error={errorOf('groomName', !!touched.groomName)}
            placeholder="김신랑"
            maxLength={40}
          />
          <TextField
            path="new.brideName"
            label="신부 이름"
            value={brideName}
            onChange={(v) => {
              setBrideName(v)
              clearServer('brideName')
            }}
            onBlur={touch('brideName')}
            error={errorOf('brideName', !!touched.brideName)}
            placeholder="박신부"
            maxLength={40}
          />
        </div>
      </section>

      <section className="ed-card is-open new__card" aria-labelledby="new-when">
        <h2 className="new__step" id="new-when">
          <span>2</span> 예식 날짜와 시간
        </h2>
        <div className="ed-grid">
          <TextField
            path="new.date"
            label="날짜"
            type="date"
            value={date}
            onChange={(v) => {
              setDate(v)
              setAttempt(0)
            }}
            onBlur={touch('date')}
            error={errorOf('date', !!touched.date)}
            min="2000-01-01"
            max="2199-12-31"
          />
          <TextField
            path="new.time"
            label="시간"
            type="time"
            value={time}
            onChange={setTime}
            onBlur={touch('time')}
            error={errorOf('time', !!touched.time)}
          />
        </div>
        <p className="ed-preview-line" aria-live="polite">
          {iso ? formatKoreanDate(new Date(iso)) : '아직 정해지지 않았다면 예정일을 넣어 두세요. 나중에 바꿀 수 있어요.'}
        </p>
      </section>

      <section className="ed-card is-open new__card" aria-labelledby="new-slug">
        <h2 className="new__step" id="new-slug">
          <span>3</span> 청첩장 주소
        </h2>
        <p className="ed-help">하객에게 보낼 링크의 마지막 부분이에요. 만든 뒤에는 바꿀 수 없으니 마음에 드는 이름으로 정해 주세요.</p>
        <TextField
          path="new.slug"
          label="주소 이름"
          value={slug}
          onChange={(v) => {
            setCustomSlug(normalizeSlugInput(v))
            clearServer('slug')
          }}
          error={slugFieldError}
          hint="영문 소문자·숫자·하이픈(-) 3~30자"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
        />
        <div className="new__url" aria-live="polite">
          <p className="new__url-text">
            <span>{urlPrefix}</span>
            <strong>{slug || '…'}</strong>
          </p>
          {!slugFieldError && availability.kind === 'checking' && <span className="new__avail">확인하는 중…</span>}
          {!slugFieldError && availability.kind === 'ok' && availability.slug === slug && (
            <span className="new__avail new__avail--ok">사용할 수 있어요</span>
          )}
          {!slugFieldError && availability.kind === 'unknown' && (
            <span className="new__avail">사용 가능 여부는 만들 때 확인할게요</span>
          )}
        </div>
        {customSlug !== null && (
          <button
            type="button"
            className="btn btn--soft btn--sm"
            onClick={() => {
              setCustomSlug(null)
              setAttempt(0)
              clearServer('slug')
            }}
          >
            추천 주소로 되돌리기
          </button>
        )}
      </section>

      <section className="ed-card is-open new__card" aria-labelledby="new-pw">
        <h2 className="new__step" id="new-pw">
          <span>4</span> 관리 비밀번호
        </h2>
        <p className="ed-help">회원가입이 없는 대신, 이 비밀번호로 청첩장을 고치고 관리해요.</p>
        <input type="text" name="username" autoComplete="username" value={slug} readOnly hidden />
        <div className="ed-grid">
          <TextField
            path="new.password"
            label="비밀번호"
            type={pwType}
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            value={password}
            onChange={(v) => {
              setPassword(v)
              clearServer('password')
            }}
            onBlur={touch('password')}
            error={errorOf('password', !!touched.password)}
            hint={`${PLATFORM_LIMITS.adminPasswordMin}자 이상`}
          />
          <TextField
            path="new.passwordConfirm"
            label="비밀번호 확인"
            type={pwType}
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            onBlur={touch('passwordConfirm')}
            error={errorOf('passwordConfirm', !!touched.passwordConfirm && passwordConfirm !== '')}
          />
        </div>
        <CheckField label="비밀번호 보기" checked={showPassword} onChange={setShowPassword} />
        <Notice tone="warn">
          <strong>비밀번호는 잊어버리면 되찾을 수 없어요.</strong> 이메일이나 휴대폰 인증이 없어 다시 알려 드릴 방법이
          없으니, 두 분이 함께 볼 수 있는 곳에 꼭 적어 두세요.
        </Notice>
      </section>

      {formError && <Notice tone="error">{formError}</Notice>}

      <div className="new__submit">
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? '만드는 중…' : '청첩장 만들기'}
        </button>
        <p className="new__foot">
          이미 만든 청첩장이 있다면 청첩장 주소 뒤에 <code>/edit</code> 를 붙여 관리 화면으로 들어갈 수 있어요.
          <br />
          어떤 모습인지 먼저 보고 싶다면 <Link to={`/w/${DEMO_SLUG}`}>데모 청첩장</Link>을 둘러보세요.
        </p>
      </div>
    </form>
  )
}
