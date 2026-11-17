import { SectionHeading } from '../components/SectionHeading'
import { PixelGuestbook } from '../guestbook/PixelGuestbook'
import './Guestbook.css'

export function Guestbook() {
  return (
    <section className="section section--tight guestbook" aria-labelledby="guestbook-title">
      <div id="guestbook-title">
        <SectionHeading
          eyebrow="GUESTBOOK"
          title="픽셀 방명록"
          subtitle="나만의 캐릭터를 만들어 예식장에 남겨 주세요. 축하의 한마디와 함께 하객분들의 캐릭터가 식장을 거닙니다."
        />
      </div>
      <div className="guestbook__stage">
        <PixelGuestbook />
      </div>
    </section>
  )
}
