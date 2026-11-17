import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { PLATFORM_LIMITS } from '../../platform/contract'
import type { EditorEnv, SectionProps } from '../env'
import { errorStatus, errorText } from '../errors'
import { moveItem, type EditorForm } from '../form'
import { prepareImage } from '../image'
import { Notice } from '../ui'

type JobStatus = 'queued' | 'resizing' | 'uploading' | 'done' | 'error'

interface Job {
  id: number
  name: string
  status: JobStatus
  message?: string
}

const STATUS_TEXT: Record<JobStatus, string> = {
  queued: '기다리는 중',
  resizing: '사진 줄이는 중…',
  uploading: '올리는 중…',
  done: '완료',
  error: '실패',
}

const ACCEPT = 'image/jpeg,image/png,image/webp'

interface Props extends SectionProps {
  env: EditorEnv
  /** 서버에 올라가 있는 이 청첩장의 사진 수(추정) */
  serverPhotoCount: () => number
  /** 업로드가 끝나 서버에 생긴 사진 */
  onUploaded: (url: string) => void
  /** 폼에서 뺀 사진. 저장된 내용이 아직 쓰고 있으면 저장 뒤에, 아니면 바로 서버에서 지운다 */
  onRemoved: (url: string) => void
  onBusyChange: (busy: boolean) => void
}

let jobSeq = 0

export function PhotosSection({ form, update, errors, env, serverPhotoCount, onUploaded, onRemoved, onBusyChange }: Props) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)
  // 업로드 루프(비동기)가 항상 최신 폼을 보도록
  const formRef = useRef<EditorForm>(form)
  useLayoutEffect(() => {
    formRef.current = form
  }, [form])
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const galleryMax = PLATFORM_LIMITS.galleryMax
  const patchJob = (id: number, patch: Partial<Job>) =>
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)))

  const run = async (files: File[], target: 'cover' | 'gallery') => {
    setNote('')
    let list = files
    if (target === 'gallery') {
      const room = galleryMax - formRef.current.gallery.length
      if (room <= 0) return setNote(`갤러리 사진은 ${galleryMax}장까지 넣을 수 있어요. 사진을 빼고 다시 시도해 주세요.`)
      if (list.length > room) {
        setNote(`갤러리는 ${galleryMax}장까지라서 앞의 ${room}장만 올릴게요.`)
        list = list.slice(0, room)
      }
    } else {
      list = list.slice(0, 1)
    }
    const queue: Job[] = list.map((f) => ({ id: ++jobSeq, name: f.name || '사진', status: 'queued' }))
    setJobs((js) => [...js.filter((j) => j.status !== 'done' && j.status !== 'error'), ...queue])
    setBusy(true)
    onBusyChange(true)
    let stopReason = ''
    try {
      for (let i = 0; i < list.length; i++) {
        const job = queue[i]
        if (stopReason) {
          patchJob(job.id, { status: 'error', message: stopReason })
          continue
        }
        if (serverPhotoCount() >= PLATFORM_LIMITS.photosPerWedding) {
          stopReason = `사진은 청첩장당 ${PLATFORM_LIMITS.photosPerWedding}장까지 올릴 수 있어요. 저장한 뒤 다시 시도해 주세요.`
          patchJob(job.id, { status: 'error', message: stopReason })
          continue
        }
        try {
          patchJob(job.id, { status: 'resizing' })
          const blob = await prepareImage(list[i])
          patchJob(job.id, { status: 'uploading' })
          const { url } = await env.authed((token) => env.api.uploadPhoto(env.slug, token, blob))
          onUploaded(url)
          if (target === 'cover') {
            const prev = formRef.current.coverImage
            update((f) => ({ ...f, coverImage: url }))
            if (prev && !formRef.current.gallery.includes(prev)) onRemoved(prev)
          } else {
            update((f) => (f.gallery.includes(url) ? f : { ...f, gallery: [...f.gallery, url] }))
          }
          patchJob(job.id, { status: 'done' })
        } catch (err) {
          const status = errorStatus(err)
          // 409: 서버가 센 사진 수가 상한에 닿았다. 화면에 보이는 수와 다를 수 있으므로(저장하지 않고 남은 업로드) 이유를 알려 준다
          const message =
            status === 409
              ? `사진은 청첩장당 ${PLATFORM_LIMITS.photosPerWedding}장까지 올릴 수 있어요. 저장하지 않은 이전 업로드가 남아 있을 수 있어요. 약 1시간 뒤 자동으로 정리되니 잠시 후 다시 시도해 주세요.`
              : errorText(err, '사진을 올리지 못했어요.')
          patchJob(job.id, { status: 'error', message })
          // 로그인 만료·횟수 제한·장수/용량 상한은 남은 사진도 같은 이유로 실패한다
          if (status === 401 || status === 429 || status === 409 || status === 507 || status === 404) stopReason = message
        }
      }
    } finally {
      onBusyChange(false)
      if (alive.current) {
        setBusy(false)
        setJobs((js) => js.filter((j) => j.status !== 'done'))
      }
    }
  }

  const onPick = (target: 'cover' | 'gallery') => (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // 같은 파일을 다시 고를 수 있게
    if (files.length > 0) void run(files, target)
  }

  const removeCover = () => {
    const url = form.coverImage
    if (!url) return
    update((f) => ({ ...f, coverImage: '' }))
    onRemoved(url)
  }

  const removeFromGallery = (url: string) => {
    update((f) => ({ ...f, gallery: f.gallery.filter((u) => u !== url) }))
    if (form.coverImage !== url) onRemoved(url)
    setSelected(null)
  }

  /** 갤러리 사진을 표지로. 원래 표지는 (자리가 있으면) 갤러리의 그 자리로 간다 */
  const makeCover = (url: string) => {
    update((f) => {
      const i = f.gallery.indexOf(url)
      if (i < 0) return f
      const gallery = [...f.gallery]
      if (f.coverImage) gallery.splice(i, 1, f.coverImage)
      else gallery.splice(i, 1)
      return { ...f, coverImage: url, gallery }
    })
    setSelected(null)
    env.toast('표지 사진으로 정했어요')
  }

  const selIndex = selected ? form.gallery.indexOf(selected) : -1
  const move = (delta: number) => update((f) => ({ ...f, gallery: moveItem(f.gallery, f.gallery.indexOf(selected ?? ''), delta) }))

  return (
    <>
      <Notice tone="info">
        사진은 올리면서 자동으로 알맞은 크기로 줄여요. 올린 뒤에는 아래 <strong>저장</strong>을 눌러야 청첩장에 반영돼요.
      </Notice>

      <div className="ed-group">
        <h3 className="ed-group__legend">표지 사진</h3>
        <div className="ed-cover">
          <div className="ed-cover__frame">
            {form.coverImage ? (
              <img src={env.api.assetUrl(form.coverImage)} alt="표지 사진 미리보기" />
            ) : (
              <span className="ed-cover__empty">
                표지 사진 없음
                <small>넣지 않으면 기본 그림이 보여요</small>
              </span>
            )}
          </div>
          <div className="ed-cover__actions">
            <input ref={coverInput} type="file" accept={ACCEPT} hidden onChange={onPick('cover')} />
            <button type="button" className="btn btn--soft" disabled={busy} onClick={() => coverInput.current?.click()}>
              {form.coverImage ? '표지 사진 바꾸기' : '표지 사진 고르기'}
            </button>
            {form.coverImage && (
              <button type="button" className="btn btn--soft" disabled={busy} onClick={removeCover}>
                표지 사진 빼기
              </button>
            )}
            <p className="ed-field__hint">세로로 긴 사진이 잘 어울려요. 카카오톡 미리보기에도 이 사진이 쓰여요.</p>
          </div>
        </div>
      </div>

      <div className="ed-group">
        <h3 className="ed-group__legend">
          갤러리 <span className="ed-count">{form.gallery.length}/{galleryMax}</span>
        </h3>
        {errors.gallery && (
          <p className="ed-field__error" role="alert" id="f-gallery">
            {errors.gallery}
          </p>
        )}
        {form.gallery.length === 0 ? (
          <p className="ed-empty">아직 갤러리 사진이 없어요. 여러 장을 한 번에 고를 수 있어요.</p>
        ) : (
          <>
            <ul className="ed-gallery">
              {form.gallery.map((url, i) => (
                <li key={url}>
                  <button
                    type="button"
                    className="ed-gallery__thumb"
                    aria-pressed={selected === url}
                    aria-label={`${i + 1}번째 사진 ${selected === url ? '선택됨' : '선택'}`}
                    onClick={() => setSelected(selected === url ? null : url)}
                  >
                    <img src={env.api.assetUrl(url)} alt="" loading="lazy" />
                    <span className="ed-gallery__no" aria-hidden="true">
                      {i + 1}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {selected && selIndex >= 0 ? (
              <div className="ed-gallery__tools" role="group" aria-label={`${selIndex + 1}번째 사진`}>
                <span className="ed-gallery__tools-label">{selIndex + 1}번째 사진</span>
                <button type="button" className="btn btn--soft btn--sm" disabled={selIndex === 0} onClick={() => move(-1)}>
                  ← 앞으로
                </button>
                <button
                  type="button"
                  className="btn btn--soft btn--sm"
                  disabled={selIndex === form.gallery.length - 1}
                  onClick={() => move(1)}
                >
                  뒤로 →
                </button>
                <button type="button" className="btn btn--soft btn--sm" onClick={() => makeCover(selected)}>
                  표지로 쓰기
                </button>
                <button type="button" className="btn btn--sm ed-btn-danger" onClick={() => removeFromGallery(selected)}>
                  빼기
                </button>
              </div>
            ) : (
              <p className="ed-field__hint">사진을 누르면 순서를 바꾸거나 뺄 수 있어요.</p>
            )}
          </>
        )}
        <input ref={galleryInput} type="file" accept={ACCEPT} multiple hidden onChange={onPick('gallery')} />
        <button
          type="button"
          className="btn btn--soft"
          disabled={busy || form.gallery.length >= galleryMax}
          onClick={() => galleryInput.current?.click()}
        >
          {busy ? '사진 올리는 중…' : '+ 갤러리 사진 추가'}
        </button>
      </div>

      <div aria-live="polite">
        {note && <p className="ed-field__hint">{note}</p>}
        {jobs.length > 0 && (
          <ul className="ed-jobs">
            {jobs.map((j) => (
              <li key={j.id} className={`ed-job ed-job--${j.status}`}>
                <span className="ed-job__name">{j.name}</span>
                <span className="ed-job__status">
                  {j.status === 'error' ? (j.message ?? STATUS_TEXT.error) : STATUS_TEXT[j.status]}
                </span>
                {(j.status === 'resizing' || j.status === 'uploading') && (
                  <span className="ed-job__bar" aria-hidden="true">
                    <span style={{ width: j.status === 'resizing' ? '35%' : '80%' }} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
