import { wedding } from '../config/wedding'
import { useToast } from '../components/Toast'
import { copyText } from '../lib/clipboard'
import { canNativeShare, nativeShare, siteUrl } from '../lib/share'
import './ShareFooter.css'

export function ShareFooter() {
  const toast = useToast()
  const url = siteUrl()
  const { groom, bride, share } = wedding

  const copyLink = async () => {
    const ok = await copyText(url)
    toast.show(ok ? '링크가 복사되었습니다' : '복사에 실패했습니다. 주소창을 길게 눌러 복사해 주세요')
  }

  const doShare = async () => {
    const result = await nativeShare({ title: share.title, text: share.description, url })
    if (result === 'unsupported') await copyLink()
    else if (result === 'error') toast.show('공유를 열 수 없습니다')
  }

  return (
    <footer className="share">
      <p className="share__mark" aria-hidden="true">
        ♥
      </p>
      <p className="share__thanks">
        소중한 시간 내어 주셔서 감사합니다.
        <br />
        저희의 시작을 따뜻하게 축복해 주세요.
      </p>

      <div className="share__actions">
        <button type="button" className="btn btn--soft share__btn" onClick={copyLink}>
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <path
              fill="currentColor"
              d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h3V7h-3a5 5 0 0 0 0 10h3v-1.9h-3A3.1 3.1 0 0 1 3.9 12zm4.6 1h7v-2h-7zm5.5-6h-3v1.9h3a3.1 3.1 0 0 1 0 6.2h-3V17h3a5 5 0 0 0 0-10z"
            />
          </svg>
          링크 복사
        </button>
        {canNativeShare() && (
          <button type="button" className="btn btn--primary share__btn" onClick={doShare}>
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
              <path
                fill="currentColor"
                d="M18 16.1c-.8 0-1.5.3-2 .8l-7-4.1c.05-.25.05-.5 0-.75l7-4.1c.5.5 1.2.8 2 .8a3 3 0 1 0-3-3c0 .25.03.5.08.75l-7 4.1a3 3 0 1 0 0 4.5l7 4.1c-.05.25-.08.5-.08.75a3 3 0 1 0 3-3z"
              />
            </svg>
            공유하기
          </button>
        )}
      </div>

      <p className="share__names">
        {groom.name} · {bride.name}
      </p>
      <p className="share__copy">Thank you for celebrating with us</p>
    </footer>
  )
}
