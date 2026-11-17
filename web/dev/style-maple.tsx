/**
 * 개발 전용: "메이플" 스타일 컨택트 시트. vite 실행 후 /dev/style-maple.html
 * ?only=crowd 로 군중 줄만 볼 수 있다.
 */
import {
  getSprite,
  MAPLE_H,
  MAPLE_W,
  PART_DEFS,
  randomAppearance,
  buildBuffer,
  type Appearance,
  type Dir,
  type Frame,
  type SpriteKind,
} from '../src/guestbook/styles/maple'
import { STYLE_INFO } from '../src/guestbook/styles/maple'
import { getSprite as getPixelSprite, randomAppearance as randomPixel, SPRITE_H, SPRITE_W } from '../src/guestbook/character'

const BG = '#efe6d6'
const INK = '#3b332b'
const FONT = "-apple-system, 'Apple SD Gothic Neo', sans-serif"
const PAGE_W = 1400

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const base: Appearance = { skin: 1, hairStyle: 0, hairColor: 1, outfit: 1, outfitColor: 2, accessory: 0 }
const count = (k: keyof Appearance) => PART_DEFS.find((p) => p.key === k)?.options.length ?? 0
const label = (k: keyof Appearance, i: number) => PART_DEFS.find((p) => p.key === k)?.options[i]?.label ?? ''

const canvas = document.getElementById('sheet') as HTMLCanvasElement
canvas.width = PAGE_W
canvas.height = 3300
const g = canvas.getContext('2d')!
g.imageSmoothingEnabled = false
g.fillStyle = BG
g.fillRect(0, 0, canvas.width, canvas.height)

let y = 14

function title(t: string): void {
  g.fillStyle = INK
  g.font = `bold 15px ${FONT}`
  g.textAlign = 'left'
  g.fillText(t, 16, y + 14)
  y += 22
}

function cell(kind: SpriteKind, dir: Dir, frame: Frame, x: number, yy: number, sc: number, text?: string): void {
  g.drawImage(getSprite(kind, dir, frame, sc), x, yy)
  if (text) {
    g.fillStyle = INK
    g.font = `11px ${FONT}`
    g.textAlign = 'center'
    g.fillText(text, x + (MAPLE_W * sc) / 2, yy + MAPLE_H * sc + 11)
  }
}

/** 한 줄로 늘어놓기 */
function strip(items: { kind: SpriteKind; dir?: Dir; frame?: Frame; text?: string }[], sc: number, x0 = 16, gap = 4): void {
  const step = MAPLE_W * sc + gap
  items.forEach((it, i) => cell(it.kind, it.dir ?? 'down', it.frame ?? 0, x0 + i * step, y, sc, it.text))
  y += MAPLE_H * sc + 20
}

const DIRS: Dir[] = ['down', 'right', 'left', 'up']
const DIR_KO: Record<Dir, string> = { down: '정면(down)', right: '오른쪽', left: '왼쪽(반전)', up: '뒷모습(up)' }
const only = new URLSearchParams(location.search).get('only')

/**
 * 군중: 430px 폭 휴대폰 캔버스(DPR 2 로 렌더). 메이플은 권장 크기(원본 1.5배 = CSS 96px 높이),
 * 기본 픽셀 캐릭터는 2.2배로 한 장면에 섞는다. floor: cream = 밝은 크림 바닥 (옷 색 대비 확인용)
 */
function crowd(scale: number, opts: { mixed?: boolean; cream?: boolean; seed?: number } = {}): void {
  const D = 2
  const Wp = 430
  const Hp = 230
  const x0 = 16
  const off = document.createElement('canvas')
  off.width = Wp * D
  off.height = Hp * D
  const c = off.getContext('2d')!
  c.imageSmoothingEnabled = false
  c.scale(D, D)
  const floorY = 70
  c.fillStyle = '#e9d9c0'
  c.fillRect(0, 0, Wp, floorY)
  c.fillStyle = opts.cream ? '#f6efe2' : '#d9b98f'
  c.fillRect(0, floorY, Wp, Hp - floorY)
  c.fillStyle = opts.cream ? '#eadfcb' : '#c9a57a'
  for (let i = 0; i < Wp; i += 24) c.fillRect(i, floorY, 1, Hp - floorY)
  c.fillRect(0, floorY, Wp, 2)
  c.fillStyle = '#b8455a'
  c.fillRect(175, floorY + 2, 80, Hp - floorY - 2) // 버진로드
  const r = rng(opts.seed ?? 77)
  const k = STYLE_INFO.recommendedCssHeight / STYLE_INFO.nominalH
  type P = { maple?: SpriteKind; pixel?: ReturnType<typeof randomPixel>; x: number; y: number; dir: Dir; frame: Frame }
  const people: P[] = []
  for (let i = 0; i < 12; i++) {
    const row = i % 2
    const col = Math.floor(i / 2)
    const left = col < 3 ? 26 + col * 52 : 284 + (col - 3) * 52
    const q: P = {
      x: left + row * 22,
      y: 118 + row * 92 + Math.floor(r() * 8),
      dir: (['down', 'right', 'left', 'down', 'up'] as Dir[])[Math.floor(r() * 5)],
      frame: ([0, 0, 1, 2] as Frame[])[Math.floor(r() * 4)],
    }
    if (opts.cream) {
      // 가장 밝은/어두운 옷 색을 번갈아
      q.maple = { ...randomAppearance(r), outfitColor: [11, 0, 5, 1, 11, 9][i % 6], outfit: [7, 0, 4, 8, 2, 5][i % 6] }
    } else if (opts.mixed && i % 3 === 1) q.pixel = randomPixel(r)
    else q.maple = randomAppearance(r)
    people.push(q)
  }
  people.push({ maple: 'groom', x: 196, y: 160, dir: 'right', frame: 0 })
  people.push({ maple: 'bride', x: 238, y: 160, dir: 'left', frame: 0 })
  people.sort((a, b) => a.y - b.y)
  for (const q of people) {
    c.fillStyle = 'rgba(60,40,30,0.22)'
    c.beginPath()
    c.ellipse(q.x, q.y - 1, 16, 4.5, 0, 0, Math.PI * 2)
    c.fill()
    if (q.maple) {
      const w = MAPLE_W * k
      const h = MAPLE_H * k
      c.drawImage(getSprite(q.maple, q.dir, q.frame), q.x - w / 2, q.y - (STYLE_INFO.footY + 1) * k, w, h)
    } else if (q.pixel) {
      const w = SPRITE_W * 2.2
      const h = SPRITE_H * 2.2
      c.drawImage(getPixelSprite(q.pixel, q.dir, q.frame), q.x - w / 2, q.y - 34 * 2.2, w, h)
    }
  }
  g.drawImage(off, x0, y, (Wp * D * scale) / 2, (Hp * D * scale) / 2)
  y += (Hp * D * scale) / 2 + 14
}

if (only === 'crowd') {
  canvas.width = 430 * 3 + 32
  canvas.height = (230 * 3 + 14) * 2 + 40
  g.imageSmoothingEnabled = false
  g.fillStyle = BG
  g.fillRect(0, 0, canvas.width, canvas.height)
  crowd(3, { mixed: true })
  crowd(3, { cream: true, seed: 5 })
} else {
  title(`메이플 스타일 — 원본 ${MAPLE_W}×${MAPLE_H}px 도트, 코드로 그린 오리지널 (아래는 2배 확대)`)

  title('1) 머리 모양 — 정면')
  strip(
    Array.from({ length: count('hairStyle') }, (_, i) => ({
      kind: { ...base, hairStyle: i, hairColor: [1, 0, 2, 0, 3, 7, 1, 8, 4, 0, 5, 11][i % 12] },
      text: label('hairStyle', i),
    })),
    2,
  )
  title('1-b) 머리 모양 — 측면 / 뒷모습')
  strip(
    Array.from({ length: count('hairStyle') }, (_, i) => ({
      kind: { ...base, hairStyle: i, hairColor: [1, 0, 2, 0, 3, 7, 1, 8, 4, 0, 5, 11][i % 12] },
      dir: 'right' as Dir,
    })),
    2,
  )
  y -= 14
  strip(
    Array.from({ length: count('hairStyle') }, (_, i) => ({
      kind: { ...base, hairStyle: i, hairColor: [1, 0, 2, 0, 3, 7, 1, 8, 4, 0, 5, 11][i % 12] },
      dir: 'up' as Dir,
    })),
    2,
  )

  title('2) 옷 — 정면 (아랫줄: 측면)')
  const outfitKinds = Array.from({ length: count('outfit') }, (_, i) => ({
    kind: {
      ...base,
      outfit: i,
      outfitColor: [1, 2, 8, 3, 7, 10, 9, 8, 1, 0, 5][i % 11],
      hairStyle: [1, 0, 2, 0, 3, 4, 11, 6, 9, 1, 7][i % 11],
    },
    text: label('outfit', i),
  }))
  strip(outfitKinds, 2)
  y -= 6
  strip(
    outfitKinds.map((o) => ({ kind: o.kind, dir: 'right' as Dir })),
    2,
  )

  title('3) 액세서리')
  strip(
    Array.from({ length: count('accessory') }, (_, i) => ({
      kind: { ...base, accessory: i, hairStyle: i % 2 ? 2 : 0, outfit: 0, outfitColor: 1 },
      text: label('accessory', i),
    })),
    2,
  )

  const y4 = y
  title('4) 피부 톤 · 머리 색 · 옷 색')
  strip(
    Array.from({ length: count('skin') }, (_, i) => ({ kind: { ...base, skin: i, hairColor: 0 }, text: label('skin', i) })),
    1,
    16,
    10,
  )
  strip(
    Array.from({ length: count('hairColor') }, (_, i) => ({
      kind: { ...base, hairColor: i, hairStyle: 3 },
      text: label('hairColor', i),
    })),
    1,
    16,
    10,
  )
  strip(
    Array.from({ length: count('outfitColor') }, (_, i) => ({
      kind: { ...base, outfitColor: i, outfit: 4, hairStyle: 2 },
      text: label('outfitColor', i),
    })),
    1,
    16,
    10,
  )
  const y4end = y

  // 5) 신랑 신부 — 4번 오른쪽에 배치
  y = y4
  g.fillStyle = INK
  g.font = `bold 15px ${FONT}`
  g.fillText('5) 신랑 · 신부 — 4방향 (left 는 right 의 좌우 반전)', 740, y + 14)
  y += 22
  for (const [k, kind] of (['groom', 'bride'] as const).entries()) {
    DIRS.forEach((d, i) => {
      g.drawImage(getSprite(kind, d, 0, 2), 740 + i * 80, y + k * 142)
      g.fillStyle = INK
      g.font = `11px ${FONT}`
      g.textAlign = 'center'
      g.fillText(DIR_KO[d], 740 + i * 80 + 48, y + k * 142 + 139)
    })
  }
  g.textAlign = 'left'
  y = Math.max(y4end, y4 + 22 + 290)

  title('6) 무작위 하객 6명 — 방향별 정지 · 걷기1 · 걷기2 (정면 / 오른쪽 / 왼쪽 / 뒷모습)')
  const r6 = rng(20261117)
  const guests = Array.from({ length: 6 }, () => randomAppearance(r6))
  guests.forEach((a, gi) => {
    const gx = 16 + (gi % 2) * 690
    const gy = y + Math.floor(gi / 2) * (MAPLE_H + 8)
    let i = 0
    for (const d of DIRS)
      for (const f of [0, 1, 2] as Frame[]) {
        g.drawImage(getSprite(a, d, f, 1), gx + i * 52 + Math.floor(i / 3) * 14, gy)
        i++
      }
  })
  y += 3 * (MAPLE_H + 8) + 6
  title('6-b) 걷기 순환 1 → 0 → 2 → 0 (오른쪽, 3배) — 정장 · 원피스 · 한복 · 남자 한복 · 신랑 · 신부')
  const walkers: SpriteKind[] = [
    { ...base, outfit: 0, outfitColor: 1, hairStyle: 1 },
    { ...base, outfit: 4, outfitColor: 7, hairStyle: 3, hairColor: 0 },
    { ...base, outfit: 7, outfitColor: 8, hairStyle: 6 },
    { ...base, outfit: 8, outfitColor: 1, hairStyle: 9, hairColor: 0 },
    'groom',
    'bride',
  ]
  const CYC: Frame[] = [1, 0, 2, 0]
  walkers.forEach((a, gi) => {
    const gx = 16 + (gi % 3) * 460
    const gy = y + Math.floor(gi / 3) * (MAPLE_H * 3 + 6)
    CYC.forEach((f, i) => g.drawImage(getSprite(a, 'right', f, 3), gx + i * 108, gy))
  })
  y += 2 * (MAPLE_H * 3 + 6) + 6
  title('6-c) 정면 · 뒷모습 걷기 (1 → 0 → 2), 2배')
  walkers.forEach((a, gi) => {
    ;([1, 0, 2] as Frame[]).forEach((f, i) => {
      g.drawImage(getSprite(a, 'down', f, 2), 16 + gi * 226 + i * 72, y)
      g.drawImage(getSprite(a, 'up', f, 2), 16 + gi * 226 + i * 72, y + MAPLE_H * 2 + 4)
    })
  })
  y += MAPLE_H * 4 + 16

  title('6-d) 어두운 피부의 눈 (3배) · 긴 머리/베일 뒷모습 (3배)')
  ;[3, 4, 5].forEach((sk, i) => {
    g.drawImage(getSprite({ ...base, skin: sk, hairColor: 0, hairStyle: i }, 'down', 0, 3), 16 + i * 280, y)
    g.drawImage(getSprite({ ...base, skin: sk, hairColor: 0, hairStyle: i }, 'right', 0, 3), 16 + i * 280 + 130, y)
  })
  ;[2, 3, 4, 11, 5].forEach((hs, i) =>
    g.drawImage(getSprite({ ...base, hairStyle: hs, hairColor: [2, 0, 3, 11, 7][i] }, 'up', 0, 3), 860 + i * 104, y),
  )
  y += MAPLE_H * 3 + 6
  ;(['down', 'right', 'up'] as Dir[]).forEach((d, i) => {
    g.drawImage(getSprite('bride', d, 0, 3), 16 + i * 150, y)
    g.drawImage(getSprite('groom', d, 0, 3), 480 + i * 150, y)
  })
  ;[0, 1, 2, 3].forEach((i) => g.drawImage(getSprite({ ...base, outfit: [7, 8, 7, 8][i], outfitColor: [7, 9, 3, 11][i], hairStyle: [6, 9, 6, 1][i] }, i < 2 ? 'down' : 'up', 0, 3), 940 + i * 110, y))
  y += MAPLE_H * 3 + 12

  title('7) 군중 — 430px 폭 휴대폰(2배 확대). 메이플 권장 크기 + 기본 픽셀 캐릭터 2.2배 혼합 / 크림 바닥에 가장 밝고 어두운 옷')
  const yc = y
  crowd(1.55, { mixed: true })
  y = yc
  g.save()
  g.translate(690, 0)
  crowd(1.55, { cream: true, seed: 5 })
  g.restore()

  // 성능 측정
  const rp = rng(5)
  const t0 = performance.now()
  let n = 0
  for (let i = 0; i < 150; i++) {
    const a = randomAppearance(rp)
    for (const d of DIRS) for (const f of [0, 1, 2] as Frame[]) {
      buildBuffer(a, d, f)
      n++
    }
  }
  const ms = performance.now() - t0
  // (헤드리스 캡처의 가상 시간에서는 0 으로 나오므로 측정됐을 때만 표시)
  if (ms > 0) {
    g.fillStyle = INK
    g.font = `12px ${FONT}`
    g.fillText(
      `성능: 스프라이트 ${n}장(150명 × 4방향 × 3프레임) 생성 ${ms.toFixed(0)}ms → 장당 ${(ms / n).toFixed(3)}ms (캐시 전 1회 비용)`,
      16,
      y + 12,
    )
  }
  document.title = `done ${ms.toFixed(0)}ms`
}

// 확대 보기: ?z=3&ox=0&oy=500 → (ox,oy) 부터 z배로
{
  const q = new URLSearchParams(location.search)
  const z = Number(q.get('z') ?? 1)
  if (z > 1 || q.has('oy') || q.has('ox')) {
    canvas.style.transformOrigin = '0 0'
    canvas.style.transform = `scale(${z}) translate(${-Number(q.get('ox') ?? 0)}px, ${-Number(q.get('oy') ?? 0)}px)`
  }
}
