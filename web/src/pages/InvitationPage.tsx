import { Reveal } from '../components/Reveal'
import { Cover } from '../sections/Cover'
import { Greeting } from '../sections/Greeting'
import { Calendar } from '../sections/Calendar'
import { Gallery } from '../sections/Gallery'
import { Location } from '../sections/Location'
import { Accounts } from '../sections/Accounts'
import { Guestbook } from '../sections/Guestbook'
import { ShareFooter } from '../sections/ShareFooter'
import { Link } from '../platform/router'
import { WeddingProvider, type WeddingInstance } from '../platform/WeddingContext'
import { CharacterPreview } from '../guestbook/ui/CharacterPreview'
import { shareText } from '../lib/share'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { WeddingGate } from './WeddingGate'
import './InvitationPage.css'

function DemoRibbon() {
  return (
    <aside className="demo-ribbon" aria-label="데모 안내">
      <Link className="demo-ribbon__home" to="/" aria-label="픽셀 청첩장 소개로 이동">
        데모 청첩장입니다
      </Link>
      <Link className="demo-ribbon__cta" to="/new">
        나도 만들기
      </Link>
    </aside>
  )
}

// 미리보기에 세우는 하객 두 명의 고정 외형
const GUEST_A = { skin: 1, hairStyle: 3, hairColor: 1, outfit: 4, outfitColor: 7, accessory: 0 }
const GUEST_B = { skin: 0, hairStyle: 6, hairColor: 2, outfit: 1, outfitColor: 3, accessory: 0 }

/** 맨 아래: 같은 청첩장을 한 화면짜리 "픽셀 청첩장"으로 보는 전환 버튼 (작은 식장 미리보기 포함) */
function PixelModeCta({ slug }: { slug: string }) {
  return (
    <aside className="pixel-cta" aria-label="픽셀 청첩장으로 보기">
      <Link className="pixel-cta__card" to={`/w/${slug}/pixel`}>
        <span className="pixel-cta__scene" aria-hidden="true">
          <span className="pixel-cta__arch" />
          <span className="pixel-cta__floor" />
          <span className="pixel-cta__couple">
            <CharacterPreview kind="groom" scale={2} />
            <CharacterPreview kind="bride" scale={2} />
          </span>
          <CharacterPreview className="pixel-cta__guest pixel-cta__guest--l" kind={GUEST_A} scale={2} dir="right" animate />
          <CharacterPreview className="pixel-cta__guest pixel-cta__guest--r" kind={GUEST_B} scale={2} dir="left" animate />
        </span>
        <span className="pixel-cta__text">
          <span className="pixel-cta__eyebrow">PIXEL MODE</span>
          <span className="pixel-cta__title">픽셀 청첩장으로 보기</span>
          <span className="pixel-cta__desc">예식장을 거니는 캐릭터들과 함께, 한 화면에서 눌러 보는 청첩장</span>
        </span>
        <span className="pixel-cta__go" aria-hidden="true">
          ▶
        </span>
      </Link>
    </aside>
  )
}

function Invitation({ wedding }: { wedding: WeddingInstance }) {
  useDocumentTitle(shareText(wedding.config).title, true)
  return (
    <WeddingProvider value={wedding}>
      {wedding.isDemo && <DemoRibbon />}
      <main className="page">
        <Cover />
        <Reveal>
          <Greeting />
        </Reveal>
        <div className="section-divider" />
        <Reveal>
          <Calendar />
        </Reveal>
        <Reveal>
          <Gallery />
        </Reveal>
        <Reveal>
          <Location />
        </Reveal>
        <Reveal>
          <Accounts />
        </Reveal>
        <Reveal>
          <Guestbook />
        </Reveal>
        <div className="section-divider" />
        <Reveal>
          <ShareFooter />
        </Reveal>
        <PixelModeCta slug={wedding.slug} />
      </main>
    </WeddingProvider>
  )
}

export default function InvitationPage({ slug }: { slug: string }) {
  return (
    <WeddingGate slug={slug}>
      {/* key: 다른 청첩장으로 이동하면 섹션 상태(열린 시트 등)를 새로 시작 */}
      {(wedding) => <Invitation key={wedding.slug} wedding={wedding} />}
    </WeddingGate>
  )
}
