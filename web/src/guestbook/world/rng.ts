/**
 * 시드 기반 결정적 난수. 시뮬레이션 코어가 DOM/전역 Math.random 없이
 * 재현 가능하도록 직접 구현합니다. (world 내부 전용)
 */

/** [0,1) 난수를 돌려주는 함수 */
export type Rand = () => number

/** 문자열 → 32bit 부호없는 해시 (cyrb53 간소화 버전). id → 시드 변환에 사용 */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // 추가 혼합으로 짧은 문자열의 치우침 완화
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  return h >>> 0
}

/** mulberry32 — 빠르고 품질 좋은 32bit 시드 PRNG */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 두 시드를 섞어 새 시드를 만든다 (월드 시드 + id 해시 조합용) */
export function mixSeed(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ b, 2654435761) >>> 0
  h ^= h >>> 16
  return h >>> 0
}

/** [min,max) 실수 */
export function randRange(rand: Rand, min: number, max: number): number {
  return min + rand() * (max - min)
}
