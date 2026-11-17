/**
 * 개발 전용 하네스 (프로덕션 빌드 제외). 전체 스프라이트 시트 + 캐릭터 만들기 UI.
 * 보기: vite 실행 후 /dev/character.html
 */
import type { Appearance } from '../src/guestbook/types'
import { getSprite, PART_DEFS, randomAppearance, SPRITE_H, SPRITE_W } from '../src/guestbook/character'
import type { Dir, SpriteKind } from '../src/guestbook/character'

const S = 4 // 확대 배율
const DIRS: Dir[] = ['down', 'left', 'right', 'up']
const FRAMES = [0, 1, 2] as const

const base: Appearance = {
  skin: 1,
  hairStyle: 0,
  hairColor: 1,
  outfit: 0,
  outfitColor: 1,
  accessory: 0,
}

interface Cell {
  kind: SpriteKind
  dir: Dir
  frame: 0 | 1 | 2
  label: string
}
interface Section {
  title: string
  cells: Cell[]
}

function count(key: keyof Appearance): number {
  return PART_DEFS.find((p) => p.key === key)?.options.length ?? 0
}
function labelOf(key: keyof Appearance, i: number): string {
  return PART_DEFS.find((p) => p.key === key)?.options[i]?.label ?? String(i)
}

const sections: Section[] = []

// 1) 기본 캐릭터 — 4방향 × 3프레임 (정렬/애니 확인)
sections.push({
  title: '기본 — 4방향 × 3프레임 (머리 고정, 발 교차 확인)',
  cells: DIRS.flatMap((dir) =>
    FRAMES.map((frame) => ({ kind: base, dir, frame, label: `${dir} ${frame}` })),
  ),
})

// 2) 머리 모양
sections.push({
  title: '머리 모양 (down / side / up)',
  cells: Array.from({ length: count('hairStyle') }).flatMap((_, i) =>
    (['down', 'right', 'up'] as Dir[]).map((dir) => ({
      kind: { ...base, hairStyle: i },
      dir,
      frame: 0 as const,
      label: dir === 'down' ? labelOf('hairStyle', i) : dir,
    })),
  ),
})

// 3) 의상
sections.push({
  title: '의상',
  cells: Array.from({ length: count('outfit') }).map((_, i) => ({
    kind: { ...base, outfit: i, hairStyle: 2 },
    dir: 'down' as Dir,
    frame: 0 as const,
    label: labelOf('outfit', i),
  })),
})

// 4) 액세서리
sections.push({
  title: '액세서리',
  cells: Array.from({ length: count('accessory') }).map((_, i) => ({
    kind: { ...base, accessory: i },
    dir: 'down' as Dir,
    frame: 0 as const,
    label: labelOf('accessory', i),
  })),
})

// 5) 머리 색
sections.push({
  title: '머리 색',
  cells: Array.from({ length: count('hairColor') }).map((_, i) => ({
    kind: { ...base, hairColor: i, hairStyle: 2 },
    dir: 'down' as Dir,
    frame: 0 as const,
    label: labelOf('hairColor', i),
  })),
})

// 6) 피부 / 의상색
sections.push({
  title: '피부 톤',
  cells: Array.from({ length: count('skin') }).map((_, i) => ({
    kind: { ...base, skin: i },
    dir: 'down' as Dir,
    frame: 0 as const,
    label: labelOf('skin', i),
  })),
})
sections.push({
  title: '의상 색',
  cells: Array.from({ length: count('outfitColor') }).map((_, i) => ({
    kind: { ...base, outfitColor: i },
    dir: 'down' as Dir,
    frame: 0 as const,
    label: labelOf('outfitColor', i),
  })),
})

// 7) 신랑 / 신부
for (const sp of ['groom', 'bride'] as const) {
  sections.push({
    title: sp === 'groom' ? '신랑 (턱시도)' : '신부 (드레스·베일·부케)',
    cells: DIRS.flatMap((dir) =>
      FRAMES.map((frame) => ({ kind: sp, dir, frame, label: `${dir} ${frame}` })),
    ),
  })
}

// 캐릭터 만들기 UI 마운트 (모듈 스코프 — 여러 모드에서 호출)
async function mountCreator() {
  const [{ createRoot }, React, { CharacterCreator }] = await Promise.all([
    import('react-dom/client'),
    import('react'),
    import('../src/guestbook/ui/CharacterCreator'),
  ])
  const mount = document.getElementById('creator-mount')
  if (!mount) return
  const root = createRoot(mount)
  const init: Appearance =
    location.hash === '#creator'
      ? { skin: 2, hairStyle: 2, hairColor: 0, outfit: 1, outfitColor: 2, accessory: 3 }
      : randomAppearance()
  function App() {
    const [value, setValue] = React.useState<Appearance>(init)
    return React.createElement(CharacterCreator, { value, onChange: setValue })
  }
  root.render(React.createElement(App))
}

// 8) 랜덤 조합
let seed = 12345
const rng = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
sections.push({
  title: '랜덤 조합',
  cells: Array.from({ length: 12 }).map(() => ({
    kind: randomAppearance(rng),
    dir: 'down' as Dir,
    frame: 0 as const,
    label: '',
  })),
})

// ── 줌 검사 모드 (#zoom) ───────────────────────────────────
if (location.hash === '#zoom') {
  const ZS = 12
  const zoomCells: Cell[] = [
    { kind: base, dir: 'down', frame: 0, label: 'down0' },
    { kind: base, dir: 'down', frame: 1, label: 'down1' },
    { kind: base, dir: 'down', frame: 2, label: 'down2' },
    { kind: base, dir: 'right', frame: 0, label: 'right0' },
    { kind: base, dir: 'right', frame: 1, label: 'right1' },
    { kind: base, dir: 'left', frame: 0, label: 'left0' },
    { kind: base, dir: 'up', frame: 0, label: 'up0' },
    { kind: 'groom', dir: 'down', frame: 0, label: 'groom' },
    { kind: 'bride', dir: 'down', frame: 0, label: 'bride' },
    { kind: 'bride', dir: 'up', frame: 0, label: 'bride up' },
    { kind: { ...base, hairStyle: 0 }, dir: 'down', frame: 0, label: labelOf('hairStyle', 0) },
    { kind: { ...base, hairStyle: 1 }, dir: 'down', frame: 0, label: labelOf('hairStyle', 1) },
    { kind: { ...base, hairStyle: 6 }, dir: 'down', frame: 0, label: labelOf('hairStyle', 6) },
    { kind: { ...base, hairStyle: 3 }, dir: 'down', frame: 0, label: labelOf('hairStyle', 3) },
  ]
  const cw = SPRITE_W * ZS + 14
  const ch = SPRITE_H * ZS + 22
  const cols = 7
  const rows = Math.ceil(zoomCells.length / cols)
  const cv = document.getElementById('sheet') as HTMLCanvasElement
  cv.width = cols * cw + 20
  cv.height = rows * ch + 20
  const cctx = cv.getContext('2d')!
  cctx.imageSmoothingEnabled = false
  cctx.fillStyle = '#d8c3a4'
  cctx.fillRect(0, 0, cv.width, cv.height)
  zoomCells.forEach((cell, i) => {
    const x = 10 + (i % cols) * cw
    const yy = 10 + Math.floor(i / cols) * ch
    cctx.imageSmoothingEnabled = false
    cctx.drawImage(getSprite(cell.kind, cell.dir, cell.frame), x, yy, SPRITE_W * ZS, SPRITE_H * ZS)
    cctx.fillStyle = '#2a2330'
    cctx.font = '12px sans-serif'
    cctx.textAlign = 'center'
    cctx.fillText(cell.label, x + (SPRITE_W * ZS) / 2, yy + SPRITE_H * ZS + 14)
  })
  const mount = document.getElementById('creator-mount')
  if (mount) mount.remove()
} else if (location.hash === '#creator') {
  // 캐릭터 만들기 단독 보기 (바텀시트 폭)
  const cv = document.getElementById('sheet')
  if (cv) cv.remove()
  document.querySelectorAll('h2').forEach((h) => h.remove())
  document.body.style.background = '#efe6d7'
  mountCreator().catch((e) => console.error(e))
} else {

// ── 레이아웃 계산 & 렌더 ───────────────────────────────────
const COLS = 12
const CELL_W = SPRITE_W * S + 12
const CELL_H = SPRITE_H * S + 22
const HEADER_H = 26
const PAD = 16

let totalH = PAD
for (const sec of sections) {
  const rows = Math.ceil(sec.cells.length / COLS)
  totalH += HEADER_H + rows * CELL_H + 10
}
const totalW = PAD * 2 + COLS * CELL_W

const canvas = document.getElementById('sheet') as HTMLCanvasElement
const dpr = Math.min(window.devicePixelRatio || 1, 2)
canvas.width = totalW * dpr
canvas.height = totalH * dpr
canvas.style.width = totalW + 'px'
canvas.style.height = totalH + 'px'
const ctx = canvas.getContext('2d')!
ctx.scale(dpr, dpr)
ctx.imageSmoothingEnabled = false

// 바닥 그라데이션(따뜻한 조명)
const grad = ctx.createLinearGradient(0, 0, 0, totalH)
grad.addColorStop(0, '#e6d4b8')
grad.addColorStop(1, '#cdb79a')
ctx.fillStyle = grad
ctx.fillRect(0, 0, totalW, totalH)

let y = PAD
for (const sec of sections) {
  ctx.fillStyle = '#3b332b'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(sec.title, PAD, y + 16)
  y += HEADER_H
  sec.cells.forEach((cell, idx) => {
    const col = idx % COLS
    const row = Math.floor(idx / COLS)
    const cx = PAD + col * CELL_W
    const cy = y + row * CELL_H
    // 셀 바닥 타원 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.beginPath()
    ctx.ellipse(cx + (SPRITE_W * S) / 2, cy + SPRITE_H * S - 6, SPRITE_W * S * 0.32, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    const spr = getSprite(cell.kind, cell.dir, cell.frame)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(spr, cx, cy, SPRITE_W * S, SPRITE_H * S)
    if (cell.label) {
      ctx.fillStyle = '#4a4036'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(cell.label, cx + (SPRITE_W * S) / 2, cy + SPRITE_H * S + 12)
    }
  })
  y += Math.ceil(sec.cells.length / COLS) * CELL_H + 10
}

// ── 캐릭터 만들기 UI 마운트 ─────────────────────────────────
mountCreator().catch((e) => console.error(e))
}
