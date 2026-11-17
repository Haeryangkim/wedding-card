/** 프론트에 번들된 데모 청첩장 (/w/demo). 서버 없이 동작하고 방명록은 이 기기에만 저장됩니다. */
import { wedding } from '../config/wedding'
import { DEMO_SLUG } from './contract'
import type { WeddingInstance } from './WeddingContext'

export const demoWedding: WeddingInstance = { slug: DEMO_SLUG, config: wedding, isDemo: true }
