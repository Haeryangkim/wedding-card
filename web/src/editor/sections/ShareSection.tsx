import type { SectionProps } from '../env'
import { effectiveShare, type EditorForm } from '../form'
import { TextField } from '../ui'

/** 자동 문구: 직접 쓴 값을 비운 상태의 결과 */
function autoShare(form: EditorForm) {
  return effectiveShare({ ...form, shareTitle: '', shareDescription: '' })
}

export function ShareSection({ form, update, errors }: SectionProps) {
  const auto = autoShare(form)
  const shown = effectiveShare(form)
  const custom = form.shareTitle.trim() !== '' || form.shareDescription.trim() !== ''
  return (
    <>
      <p className="ed-help">
        카카오톡·문자로 링크를 보냈을 때 미리보기에 나오는 문구예요. 비워 두면 이름·날짜·장소로 자동으로 만들어져요.
      </p>
      <div className="ed-share-preview" aria-label="공유 미리보기">
        <p className="ed-share-preview__title">{shown.title}</p>
        <p className="ed-share-preview__desc">{shown.description || ' '}</p>
      </div>
      <TextField
        path="shareTitle"
        label="제목"
        optional
        value={form.shareTitle}
        onChange={(shareTitle) => update((f) => ({ ...f, shareTitle }))}
        error={errors.shareTitle}
        placeholder={auto.title}
      />
      <TextField
        path="shareDescription"
        label="설명"
        optional
        value={form.shareDescription}
        onChange={(shareDescription) => update((f) => ({ ...f, shareDescription }))}
        error={errors.shareDescription}
        placeholder={auto.description}
      />
      {custom && (
        <button
          type="button"
          className="btn btn--soft btn--sm"
          onClick={() => update((f) => ({ ...f, shareTitle: '', shareDescription: '' }))}
        >
          자동 문구로 되돌리기
        </button>
      )}
    </>
  )
}
