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
canvas.height = 2200
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

function crowd(scale: number): void {
  // 430px 폭 휴대폰 캔버스에서의 실제 크기: 원본 1px = CSS 1px
  const Wp = 430
  const Hp = 150
  const x0 = 16
  const off = document.createElement('canvas')
  off.width = Wp
  off.height = Hp
  const c = off.getContext('2d')!
  c.fillStyle = '#f6efe2'
  c.fillRect(0, 0, Wp, Hp)
  // 벽과 바닥
  c.fillStyle = '#e9d9c0'
  c.fillRect(0, 0, Wp, 62)
  c.fillStyle = '#d9b98f'
  c.fillRect(0, 62, Wp, Hp - 62)
  c.fillStyle = '#c9a57a'
  for (let i = 0; i < Wp; i += 24) c.fillRect(i, 62, 1, Hp - 62)
  c.fillRect(0, 62, Wp, 2)
  c.fillStyle = '#b8455a'
  c.fillRect(175, 64, 80, Hp - 64) // 버진로드
  const r = rng(77)
  const people: { kind: SpriteKind; x: number; y: number; dir: Dir; frame: Frame }[] = []
  for (let i = 0; i < 14; i++) {
    const row = i % 2
    const col = Math.floor(i / 2)
    const left = col < 4 ? 24 + col * 40 : 272 + (col - 4) * 44
    people.push({
      kind: randomAppearance(r),
      x: left + row * 14,
      y: 76 + row * 62 + Math.floor(r() * 6),
      dir: (['down', 'right', 'left', 'down', 'up'] as Dir[])[Math.floor(r() * 5)],
      frame: ([0, 0, 1, 2] as Frame[])[Math.floor(r() * 4)],
    })
  }
  people.push({ kind: 'groom', x: 192, y: 108, dir: 'right', frame: 0 })
  people.push({ kind: 'bride', x: 238, y: 108, dir: 'left', frame: 0 })
  people.sort((a, b) => a.y - b.y)
  for (const q of people) {
    c.fillStyle = 'rgba(60,40,30,0.22)'
    c.beginPath()
    c.ellipse(q.x, q.y - 1, 13, 4, 0, 0, Math.PI * 2)
    c.fill()
    c.drawImage(getSprite(q.kind, q.dir, q.frame), Math.round(q.x - MAPLE_W / 2), q.y - MAPLE_H + 1)
  }
  g.drawImage(off, x0, y, Wp * scale, Hp * scale)
  y += Hp * scale + 14
}

if (only === 'crowd') {
  canvas.width = 430 * 3 + 32
  canvas.height = 150 * 3 + 40
  g.imageSmoothingEnabled = false
  g.fillStyle = BG
  g.fillRect(0, 0, canvas.width, canvas.height)
  crowd(3)
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
  title('6-b) 같은 하객 — 오른쪽 걷기 3프레임 (2배)')
  guests.forEach((a, gi) => {
    for (const f of [0, 1, 2] as Frame[]) g.drawImage(getSprite(a, 'right', f, 2), 16 + gi * 226 + f * 72, y)
  })
  y += MAPLE_H * 2 + 12

  title('7) 군중 — 430px 폭 휴대폰 캔버스 실제 크기(왼쪽, 1배) / 같은 그림 2배(오른쪽)')
  const yc = y
  crowd(1)
  const yAfter = y
  y = yc
  // 2배 버전은 오른쪽에
  g.save()
  g.translate(460, 0)
  crowd(2)
  g.restore()
  y = Math.max(y, yAfter)

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
  if (z > 1) {
    canvas.style.transformOrigin = '0 0'
    canvas.style.transform = `scale(${z}) translate(${-Number(q.get('ox') ?? 0)}px, ${-Number(q.get('oy') ?? 0)}px)`
  }
}
