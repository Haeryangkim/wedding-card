/**
 * 로그인 뒤의 편집 화면: 접히는 카드 섹션 + 하단 고정 저장 바.
 * 폼 상태는 여기 한 곳에 있고, 변환·검증은 form.ts / validate.ts 의 순수 함수가 맡는다.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatKoreanDate } from '../lib/date'
import { copyText } from '../lib/clipboard'
import type { WeddingConfig } from '../config/wedding'
import { Link, href } from '../platform/router'
import { toKstIso } from './datetime'
import type { EditorEnv, UpdateForm } from './env'
import { errorStatus, errorText } from './errors'
import type { EditorForm } from './form'
import { configToForm, effectiveShare, formFingerprint, formToConfig, isBlankAccount, isBlankTransport, photoRefs } from './form'
import { addPendingPhoto, isDefiniteRejection, loadPendingPhotos, removePendingPhotos } from './pendingPhotos'
import { fieldId, Notice, SectionCard } from './ui'
import type { FormErrors, SectionId } from './validate'
import { sectionOfError, sectionOfServerError, validateForm } from './validate'
import { PeopleSection } from './sections/PeopleSection'
import { DateTimeSection } from './sections/DateTimeSection'
import { VenueSection } from './sections/VenueSection'
import { TransportSection } from './sections/TransportSection'
import { GreetingSection } from './sections/GreetingSection'
import { PhotosSection } from './sections/PhotosSection'
import { AccountsSection } from './sections/AccountsSection'
import { ShareSection } from './sections/ShareSection'
import { GuestsSection } from './sections/GuestsSection'
import { SettingsSection } from './sections/SettingsSection'

type CardId = SectionId | 'guests' | 'settings'

interface EditorProps {
  env: EditorEnv
  initialConfig: WeddingConfig
  onPasswordChanged: (newPassword: string) => Promise<void>
  onDeleted: () => void
  onLogout: () => void
  /** 저장하지 않은 변경이 있는지 바깥(페이지)에 알린다 */
  onDirtyChange: (dirty: boolean) => void
}

const NO_ERRORS: FormErrors = {}

export function Editor({ env, initialConfig, onPasswordChanged, onDeleted, onLogout, onDirtyChange }: EditorProps) {
  const { slug, api } = env
  const [form, setForm] = useState<EditorForm>(() => configToForm(initialConfig))
  const [savedPrint, setSavedPrint] = useState(() => formFingerprint(configToForm(initialConfig)))
  const [open, setOpen] = useState<Set<CardId>>(() => new Set<CardId>(['people']))
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [savedOnce, setSavedOnce] = useState(false)

  const formRef = useRef(form)
  useLayoutEffect(() => {
    formRef.current = form
  }, [form])
  /** 저장된 내용이 쓰는 사진 / 서버에 올라가 있다고 아는 사진 */
  const savedRefs = useRef(new Set(photoRefs(initialConfig)))
  const serverPhotos = useRef(new Set(photoRefs(initialConfig)))
  /**
   * 응답을 아직 받지 못한 저장 요청에 들어 있는 사진. 서버가 이미 저장했을 수 있으므로,
   * 결과를 알기 전에는 폼에서 빼더라도 서버에서 지우지 않는다 (공개된 청첩장의 사진이 깨진다).
   */
  const inFlightRefs = useRef(new Set<string>())

  const update: UpdateForm = useCallback((fn) => setForm(fn), [])
  const print = useMemo(() => formFingerprint(form), [form])
  const dirty = print !== savedPrint
  const errors = useMemo(() => (showErrors ? validateForm(form) : NO_ERRORS), [showErrors, form])
  const errorCount = Object.keys(errors).length

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const toggle = (id: CardId) =>
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const deletePhotoQuietly = useCallback(
    (url: string) => {
      serverPhotos.current.delete(url)
      // 실패해도 괜찮다: 저장된 내용이 쓰지 않는 사진은 서버가 나중에 정리한다
      env
        .authed((token) => api.deletePhoto(slug, token, url))
        .then(
          () => removePendingPhotos(slug, [url]),
          (err: unknown) => {
            // 이미 없는 사진이면 더 기억할 필요가 없다. 그 밖의 실패는 다음에 편집 화면을 열 때 다시 지운다
            if (errorStatus(err) === 404) removePendingPhotos(slug, [url])
          },
        )
    },
    [api, env, slug],
  )

  const onPhotoUploaded = useCallback(
    (url: string) => {
      serverPhotos.current.add(url)
      addPendingPhoto(slug, url)
    },
    [slug],
  )

  // 지난 편집에서 올리고 저장하지 않은 채 남은 사진(새로고침·탭 정리·로그아웃)을 서버에서 지운다.
  // 그대로 두면 최대 1시간 동안 사진 수 상한을 차지해 새 사진을 올릴 수 없다.
  useEffect(() => {
    const saved = new Set(photoRefs(initialConfig))
    const pending = loadPendingPhotos(slug)
    removePendingPhotos(slug, pending.filter((url) => saved.has(url)))
    for (const url of pending) {
      if (!saved.has(url) && !serverPhotos.current.has(url)) deletePhotoQuietly(url)
    }
    // 편집 화면이 열릴 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 폼에서 뺀 사진: 저장된 내용이 아직 쓰고 있으면 저장 뒤에, 한 번도 저장되지 않았으면 바로 지운다 */
  const onPhotoRemoved = useCallback(
    (url: string) => {
      setTimeout(() => {
        if (savedRefs.current.has(url) || inFlightRefs.current.has(url)) return
        if (photoRefs(formRef.current).includes(url)) return
        if (serverPhotos.current.has(url)) deletePhotoQuietly(url)
      }, 0)
    },
    [deletePhotoQuietly],
  )

  const scrollToField = (path: string) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldId(path)) ?? document.getElementById(`sec-${sectionOfError(path)}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true })
    })
  }

  const save = async () => {
    if (saving || uploading) return
    setSaveError('')
    const current = formRef.current
    const errs = validateForm(current)
    const paths = Object.keys(errs)
    setShowErrors(true)
    if (paths.length > 0) {
      setOpen((cur) => new Set<CardId>([...cur, ...paths.map(sectionOfError)]))
      scrollToField(paths[0])
      env.toast(`확인이 필요한 곳이 ${paths.length}군데 있어요`)
      return
    }
    const config = formToConfig(current)
    setSaving(true)
    inFlightRefs.current = new Set(photoRefs(config))
    try {
      const record = await env.authed((token) => api.updateWedding(slug, token, config))
      setSavedPrint(JSON.stringify(config))
      setSavedOnce(true)
      setShowErrors(false)
      savedRefs.current = new Set(photoRefs(record.config))
      inFlightRefs.current = new Set()
      removePendingPhotos(slug, savedRefs.current)
      // 저장된 내용도, 지금 폼도 쓰지 않는 사진은 서버에서 지운다 (저장이 끝난 "뒤" 에만)
      const inForm = new Set(photoRefs(formRef.current))
      for (const url of [...serverPhotos.current]) {
        if (!savedRefs.current.has(url) && !inForm.has(url)) deletePhotoQuietly(url)
      }
      env.toast('저장했어요')
    } catch (err) {
      // 서버가 확실히 거절했을 때만 "저장되지 않았다" 고 본다. 응답을 못 받은 경우(시간 초과·연결 끊김·5xx)는
      // 이미 저장됐을 수 있으므로, 보낸 사진을 저장된 것으로 취급해 다음 저장이 성공할 때까지 지우지 않는다.
      if (!isDefiniteRejection(errorStatus(err))) {
        for (const url of inFlightRefs.current) savedRefs.current.add(url)
      }
      inFlightRefs.current = new Set()
      const message = errorText(err, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setSaveError(message)
      if (errorStatus(err) !== 401) {
        const section = sectionOfServerError(message)
        if (section) {
          setOpen((cur) => new Set<CardId>([...cur, section]))
          requestAnimationFrame(() =>
            document.getElementById(`sec-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          )
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const publicUrl = `${window.location.origin}${href(`/w/${slug}`)}`
  const copyLink = async () => {
    env.toast((await copyText(publicUrl)) ? '청첩장 주소를 복사했어요' : '복사하지 못했어요. 주소를 길게 눌러 복사해 주세요')
  }

  // ── 카드 요약 · 표시 ─────────────────────────────────────────
  const badgeFor = (id: SectionId, todo = false) => {
    if (Object.keys(errors).some((p) => sectionOfError(p) === id)) return { text: '확인 필요', tone: 'error' as const }
    return todo ? { text: '입력 전', tone: 'todo' as const } : undefined
  }
  const iso = toKstIso(form.date, form.time)
  const share = effectiveShare(form)
  const transportCount = form.transport.filter((b) => !isBlankTransport(b)).length
  const groomAcc = form.groomAccounts.filter((a) => !isBlankAccount(a)).length
  const brideAcc = form.brideAccounts.filter((a) => !isBlankAccount(a)).length
  const card = (id: CardId) => ({ id, open: open.has(id), onToggle: () => toggle(id) })
  const sectionProps = { form, update, errors }

  const status = saving
    ? '저장하는 중이에요…'
    : uploading
      ? '사진을 올리는 중이에요…'
      : errorCount > 0
        ? `확인이 필요한 곳이 ${errorCount}군데 있어요`
        : dirty
          ? '저장하지 않은 변경사항이 있어요'
          : savedOnce
            ? '저장했어요. 청첩장에 바로 반영돼요'
            : '모든 내용이 저장되어 있어요'

  return (
    <div className="ed-editor">
      <header className="ed-header">
        <div className="ed-header__text">
          <p className="ed-header__eyebrow">청첩장 관리</p>
          <h1 className="ed-header__title">
            {form.groom.name.trim() || '신랑'} <span aria-hidden="true">·</span> {form.bride.name.trim() || '신부'}
          </h1>
          <p className="ed-header__url">{publicUrl.replace(/^https?:\/\//, '')}</p>
        </div>
        <div className="ed-header__actions">
          <Link className="btn btn--soft btn--sm" to={`/w/${slug}`} target="_blank" rel="noopener">
            청첩장 보기
          </Link>
          <button type="button" className="btn btn--soft btn--sm" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </header>

      <div className="ed-cards">
        <SectionCard
          {...card('people')}
          title="기본 정보"
          summary={`${form.groom.name.trim() || '신랑'} · ${form.bride.name.trim() || '신부'}`}
          badge={badgeFor('people')}
        >
          <PeopleSection {...sectionProps} />
        </SectionCard>

        <SectionCard
          {...card('datetime')}
          title="예식 일시"
          summary={iso ? formatKoreanDate(new Date(iso)) : '날짜를 정해 주세요'}
          badge={badgeFor('datetime', !iso)}
        >
          <DateTimeSection {...sectionProps} />
        </SectionCard>

        <SectionCard
          {...card('venue')}
          title="예식 장소"
          summary={[form.venue.name.trim(), form.venue.hall.trim()].filter(Boolean).join(' ') || '장소를 입력해 주세요'}
          badge={badgeFor('venue', form.venue.name.trim() === '')}
        >
          <VenueSection {...sectionProps} env={env} />
        </SectionCard>

        <SectionCard
          {...card('transport')}
          title="교통 안내"
          summary={transportCount > 0 ? `${transportCount}개 항목` : '지하철 · 버스 · 주차 안내'}
          badge={badgeFor('transport')}
        >
          <TransportSection {...sectionProps} />
        </SectionCard>

        <SectionCard
          {...card('greeting')}
          title="인사말"
          summary={form.greetingTitle.trim() || '초대의 글'}
          badge={badgeFor('greeting')}
        >
          <GreetingSection {...sectionProps} />
        </SectionCard>

        <SectionCard
          {...card('photos')}
          title="사진"
          summary={`표지 ${form.coverImage ? '있음' : '없음'} · 갤러리 ${form.gallery.length}장`}
          badge={badgeFor('photos')}
        >
          <PhotosSection
            {...sectionProps}
            env={env}
            serverPhotoCount={() => serverPhotos.current.size}
            onUploaded={onPhotoUploaded}
            onRemoved={onPhotoRemoved}
            onBusyChange={setUploading}
          />
        </SectionCard>

        <SectionCard
          {...card('accounts')}
          title="마음 전하실 곳"
          summary={groomAcc + brideAcc > 0 ? `신랑측 ${groomAcc}개 · 신부측 ${brideAcc}개` : '계좌 안내 (선택)'}
          badge={badgeFor('accounts')}
        >
          <AccountsSection {...sectionProps} />
        </SectionCard>

        <SectionCard {...card('share')} title="공유 문구" summary={share.title} badge={badgeFor('share')}>
          <ShareSection {...sectionProps} />
        </SectionCard>

        <SectionCard {...card('guests')} title="방명록 관리" summary="하객이 남긴 글 보기 · 삭제">
          <GuestsSection env={env} active={open.has('guests')} />
        </SectionCard>

        <SectionCard {...card('settings')} title="설정" summary="비밀번호 변경 · 청첩장 삭제">
          <SettingsSection env={env} onPasswordChanged={onPasswordChanged} onDeleted={onDeleted} />
        </SectionCard>
      </div>

      <div className="ed-savebar" role="region" aria-label="저장">
        <div className="ed-savebar__inner">
          {saveError && <Notice tone="error">{saveError}</Notice>}
          <div className="ed-savebar__row">
            <p
              className={`ed-savebar__status${errorCount > 0 ? ' is-error' : dirty ? ' is-dirty' : ''}`}
              role="status"
              aria-live="polite"
            >
              <span className="ed-savebar__dot" aria-hidden="true" />
              {status}
            </p>
            {dirty || errorCount > 0 || saving ? (
              <button type="button" className="btn btn--primary ed-savebar__save" disabled={saving || uploading} onClick={() => void save()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            ) : (
              <div className="ed-savebar__done">
                <button type="button" className="btn btn--soft btn--sm" onClick={() => void copyLink()}>
                  링크 복사
                </button>
                <Link className="btn btn--leaf btn--sm" to={`/w/${slug}`} target="_blank" rel="noopener">
                  청첩장 보기
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
