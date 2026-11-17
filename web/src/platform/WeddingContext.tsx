import { createContext, useContext } from 'react'
import type { WeddingConfig } from '../config/wedding'

export interface WeddingInstance {
  slug: string
  config: WeddingConfig
  /** 번들된 데모 청첩장 여부 (서버 없이 동작, 방명록은 이 기기에만 저장) */
  isDemo: boolean
}

const Ctx = createContext<WeddingInstance | null>(null)
export const WeddingProvider = Ctx.Provider

/** 현재 보고 있는 청첩장 인스턴스. 청첩장 화면(sections/, guestbook/) 안에서만 호출 */
export function useWedding(): WeddingInstance {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWedding must be used inside <WeddingProvider>')
  return v
}
