/**
 * 데모 청첩장의 "장면 그림체" — 데모에서는 한 맵에 한 그림체만 돌아다니고, 보는 사람이 그림체를 바꿔 볼 수 있다.
 * (실제 청첩장에서는 하객마다 고른 그림체가 그대로 섞여 나온다 — 이 파일은 관여하지 않는다)
 *
 * 선택은 이 기기에만 기억하고, 일반 청첩장의 방명록과 픽셀 청첩장이 같은 값을 쓴다.
 */
import { useMemo, useSyncExternalStore } from 'react'
import type { Appearance, GuestEntry } from './types'
import {
  DEFAULT_STYLE,
  GUEST_EXCLUDED,
  normalizeAnyAppearance,
  randomAppearanceFor,
  styleOf,
  toStyleId,
  type StyleId,
} from './styles/registry'

const KEY = 'wc:demo-scene-style'
const listeners = new Set<() => void>()
let current: StyleId | null = null

function read(): StyleId {
  if (current) return current
  let v: string | null = null
  try {
    // 주소의 ?style=maple 이 우선 (특정 그림체로 데모를 공유할 때)
    v = new URLSearchParams(location.search).get('style') ?? localStorage.getItem(KEY)
  } catch {
    /* 저장소를 쓸 수 없으면 기본값 */
  }
  current = toStyleId(v)
  return current
}

export function setSceneStyle(id: StyleId): void {
  if (id === read()) return
  current = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* 기억만 못 할 뿐 동작에는 지장 없다 */
  }
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 외형 하나에서 늘 같은 난수열이 나오게 한다: 파츠 번호 여섯 개를 섞은 시드로 도는 mulberry32 */
function seededRandom(a: Appearance): () => number {
  let h = 2166136261
  for (const v of [a.skin, a.hairStyle, a.hairColor, a.outfit, a.outfitColor, a.accessory]) {
    h = Math.imul(h ^ (v + 1), 16777619)
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 외형을 다른 그림체로 옮긴다.
 *  - 기본 픽셀·SD 캐릭터·숲속 주민: 파츠 번호는 그대로 두고 그 그림체의 범위로만 자른다.
 *  - 신랑·신부 몫의 옷·장식이 따로 있는 그림체(GUEST_EXCLUDED): 번호의 뜻이 전혀 달라 그대로 옮기면
 *    하객이 턱시도·웨딩드레스를 입게 된다. 그래서 원래 외형을 시드로 그 그림체의 "하객용 랜덤" 을 뽑는다
 *    (같은 하객은 언제나 같은 모습, 신랑·신부 몫은 빠지고, 몸에 맞는 머리 길이 같은 규칙도 그대로 적용된다).
 */
export function restyle(appearance: Appearance, id: StyleId): Appearance {
  if (styleOf(appearance) === id) return appearance
  if (id !== 'doll' && GUEST_EXCLUDED[id]) {
    return randomAppearanceFor(id, seededRandom(appearance))
  }
  if (id === 'doll') {
    // 도트 인형: 하객이 턱시도·웨딩드레스(0·1번)를 입지 않게 하고, 옷은 그림 원래 색으로
    return normalizeAnyAppearance({
      ...appearance,
      outfit: 2 + (appearance.outfit % 10),
      outfitColor: 0,
      hairColor: appearance.hairColor % 5,
      skin: appearance.skin % 3,
      style: id,
    })
  }
  return normalizeAnyAppearance({ ...appearance, style: id })
}

/** 데모면 현재 장면 그림체, 아니면 null (하객이 고른 그대로) */
export function useSceneStyle(isDemo: boolean): StyleId | null {
  const id = useSyncExternalStore(subscribe, read, () => DEFAULT_STYLE)
  return isDemo ? id : null
}

/** 장면 그림체가 있으면 모든 하객을 그 그림체로 보여 준다 */
export function useStyledEntries(entries: GuestEntry[], sceneStyle: StyleId | null): GuestEntry[] {
  return useMemo(
    () =>
      sceneStyle === null
        ? entries
        : entries.map((e) => {
            const a = restyle(e.appearance, sceneStyle)
            return a === e.appearance ? e : { ...e, appearance: a }
          }),
    [entries, sceneStyle],
  )
}
