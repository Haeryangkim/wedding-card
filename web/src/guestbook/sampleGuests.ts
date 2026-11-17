/**
 * 데모(백엔드 없는 GitHub Pages)용 기본 하객 샘플.
 * id·외형·시간이 모두 결정적(deterministic)이라 어느 기기에서든 동일하게 보입니다.
 * 이 캐릭터들은 삭제할 수 없습니다(LocalStore 에서 보호).
 */
import type { CharacterStyleId, GuestEntry, Side } from './types'
import { sanitizeEntry } from './validate'

interface SampleSeed {
  name: string
  message: string
  side: Side
  /** [피부, 머리 모양, 머리 색, 옷, 옷 색, 액세서리] — 인덱스는 style 의 옵션 목록 기준 */
  appearance: [number, number, number, number, number, number]
  /** 그림체 (생략 = 기본 픽셀). 데모에서 여러 그림체가 섞인 모습을 바로 볼 수 있게 몇 명만 다르게 둔다 */
  style?: CharacterStyleId
}

/** 샘플 타임스탬프 기준점 — 실제 방문자 글(Date.now())보다 항상 앞서도록 과거로 고정 */
const SAMPLE_BASE = Date.UTC(2026, 10, 1, 1, 0, 0) // 2026-11-01
const HOUR = 60 * 60 * 1000

const SEEDS: SampleSeed[] = [
  { name: '민준', message: '두 사람의 앞날을 진심으로 축하해! 언제나 지금처럼 행복하길.', side: 'groom', appearance: [1, 0, 0, 0, 1, 0] },
  { name: '서연', message: '세상에서 제일 잘 어울리는 커플 💕 결혼 축하해요!', side: 'bride', appearance: [0, 3, 1, 4, 7, 4] },
  { name: '도윤', message: '친구야 장가간다니 실감이 안 난다 ㅋㅋ 정말 축하한다!', side: 'groom', appearance: [1, 1, 0, 2, 4, 1], style: 'maple' },
  { name: '지우', message: '예쁜 신부님, 결혼 축하해! 오래오래 사랑하며 살자.', side: 'bride', appearance: [1, 6, 2, 7, 10, 0] },
  { name: '현우', message: '결혼 축하드립니다! 두 분 늘 건강하고 행복하세요.', side: 'groom', appearance: [3, 10, 0, 2, 3, 0] },
  { name: '하은', message: '드디어 결혼이네요! 꽃길만 걷기를 응원할게요 🌸', side: 'bride', appearance: [0, 3, 3, 3, 8, 7], style: 'forest' },
  { name: '시우', message: '백년해로 하세요! 멀리서도 늘 응원하고 있어요.', side: 'groom', appearance: [1, 7, 1, 3, 2, 8] },
  { name: '수아', message: '신부가 세상에서 제일 예뻐요 ✨ 행복하게 잘 살아요!', side: 'bride', appearance: [0, 7, 1, 4, 9, 3], style: 'maple' },
  { name: '주원', message: '좋은 소식 너무 기쁘다! 두 사람 결혼 진심으로 축하해.', side: 'groom', appearance: [2, 1, 0, 2, 1, 0], style: 'forest' },
  { name: '예은', message: '늘 다정한 두 사람, 변함없이 아끼며 지내길 바랄게요.', side: 'bride', appearance: [0, 11, 7, 9, 4, 10] },
  { name: '건우', message: '형, 결혼 축하해요! 제수씨랑 행복하게 사세요 😄', side: 'groom', appearance: [2, 0, 2, 0, 6, 6] },
  { name: '채원', message: '사랑스러운 신부님 결혼 축하해요. 늘 꽃처럼 환하게!', side: 'bride', appearance: [1, 2, 5, 4, 5, 5] },
  { name: '지호', message: '두 분 결혼 축하드려요! 맛있는 밥 먹으러 꼭 갈게요 🍚', side: 'groom', appearance: [1, 9, 0, 0, 2, 0], style: 'maple' },
  { name: '유나', message: '언니 결혼 너무 축하해 🤍 세상에서 제일 행복한 신부가 되길!', side: 'bride', appearance: [0, 5, 4, 6, 6, 4], style: 'forest' },
  { name: '태윤', message: '선배님 결혼 축하드립니다. 늘 웃음 가득한 가정 이루세요.', side: 'groom', appearance: [3, 3, 1, 1, 7, 2] },
  { name: '소율', message: '두 사람 닮은 예쁜 날이네요. 오래오래 행복하세요!', side: 'bride', appearance: [0, 5, 2, 8, 3, 0] },
]

export function buildSampleGuests(): GuestEntry[] {
  const out: GuestEntry[] = []
  SEEDS.forEach((seed, i) => {
    const entry = sanitizeEntry({
      id: `sample-${i + 1}`,
      name: seed.name,
      message: seed.message,
      side: seed.side,
      appearance: {
        skin: seed.appearance[0],
        hairStyle: seed.appearance[1],
        hairColor: seed.appearance[2],
        outfit: seed.appearance[3],
        outfitColor: seed.appearance[4],
        accessory: seed.appearance[5],
        ...(seed.style ? { style: seed.style } : {}),
      },
      createdAt: SAMPLE_BASE + i * HOUR,
    })
    if (entry) out.push(entry)
  })
  return out
}

/** 샘플 하객 id 집합 (삭제 보호 판정용) */
export function sampleIds(): Set<string> {
  return new Set(SEEDS.map((_, i) => `sample-${i + 1}`))
}
