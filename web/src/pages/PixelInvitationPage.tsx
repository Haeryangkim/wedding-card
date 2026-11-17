/**
 * 픽셀 청첩장(/w/<slug>/pixel) — 같은 청첩장의 두 번째 모습.
 * 스크롤 없는 한 화면(100dvh)에 결혼식장 장면을 채우고, 눌러서 정보를 여는 방식.
 * 내용(config)과 방명록(store)은 일반 청첩장(/w/<slug>)과 같은 것을 쓴다.
 */
import { WeddingProvider } from '../platform/WeddingContext'
import { PixelStage } from '../pixel/PixelStage'
import { WeddingGate } from './WeddingGate'

export default function PixelInvitationPage({ slug }: { slug: string }) {
  return (
    <WeddingGate slug={slug}>
      {(wedding) => (
        <WeddingProvider value={wedding}>
          {/* key: 다른 청첩장으로 이동하면 열린 팝업·포커스 상태를 새로 시작 */}
          <PixelStage key={wedding.slug} />
        </WeddingProvider>
      )}
    </WeddingGate>
  )
}
