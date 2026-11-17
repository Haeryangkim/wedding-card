/**
 * 개발 전용 하네스: "동숲풍" 벡터 스타일 콘택트 시트. 보기: vite 실행 후 /dev/style-forest.html
 * 쿼리: ?only=crowd (군중만) · ?only=row (권장 크기 줄만) · ?mag=3&ox=..&oy=.. (부분 확대) · ?bench=1 (150명 성능 측정)
 * 해상도는 devicePixelRatio 를 따른다 (headless: --force-device-scale-factor=2).
 */
import type { Appearance } from '../src/guestbook/types'
import { getSprite as getPixelSprite, randomAppearance as randomPixel, SPRITE_H, SPRITE_W } from '../src/guestbook/character'
import { FOREST_FOOT_Y, FOREST_H, FOREST_W, getSprite, PART_DEFS, randomAppearance, spriteCacheStats, spriteScale, STYLE_INFO } from '../src/guestbook/styles/forest'
import type { Dir, Frame, SpriteKind } from '../src/guestbook/styles/forest'

const q = new URLSearchParams(location.search)
const MAG = Number(q.get('mag') ?? 1)
const DPR = Math.min(window.devicePixelRatio || 1, 2)
/** 시트 좌표 1단위당 기기 픽셀 */
const ZOOM = MAG * DPR
const ONLY = q.get('only')
const W = 1400
const FONT = "-apple-system, 'Apple SD Gothic Neo', sans-serif"
const DIRS: Dir[] = ['down', 'right', 'left', 'up']
const DIR_KO: Record<Dir, string> = { down: '앞', right: '오른쪽', left: '왼쪽', up: '뒤' }

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const count = (k: keyof Appearance) => PART_DEFS.find((p) => p.key === k)?.options.length ?? 0
const opt = (k: keyof Appearance, i: number) => PART_DEFS.find((p) => p.key === k)?.options[i]
const base: Appearance = { skin: 1, hairStyle: 0, hairColor: 1, outfit: 1, outfitColor: 5, accessory: 0 }

const canvas = document.getElementById('sheet') as HTMLCanvasElement
const H = ONLY === 'crowd' ? 300 : ONLY === 'row' ? 470 : 2380
canvas.width = W * ZOOM
canvas.height = H * ZOOM
canvas.style.width = `${W * MAG}px`
canvas.style.height = `${H * MAG}px`
canvas.style.marginTop = `-${Number(q.get('oy') ?? 0) * MAG}px`
canvas.style.marginLeft = `-${Number(q.get('ox') ?? 0) * MAG}px`
const ctx = canvas.getContext('2d')!
ctx.scale(ZOOM, ZOOM)
ctx.fillStyle = '#efe6d6'
ctx.fillRect(0, 0, W, H)

let y = 14
function title(t: string): void {
  ctx.fillStyle = '#5a4636'
  ctx.font = `700 17px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText(t, 24, y + 18)
  y += 30
}
/** scale = 명목 1단위당 CSS px. 실제 캔버스는 ZOOM 배 해상도로 구워 선명도 확인 */
function put(kind: SpriteKind, dir: Dir, frame: Frame, x: number, top: number, scale: number, label?: string): void {
  const c = getSprite(kind, dir, frame, scale * ZOOM)
  ctx.drawImage(c, x, top, FOREST_W * scale, FOREST_H * scale)
  if (label) {
    ctx.fillStyle = '#6b5646'
    ctx.font = `500 12px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(label, x + (FOREST_W * scale) / 2, top + FOREST_H * scale + 13)
  }
}
function row(cells: { kind: SpriteKind; dir?: Dir; frame?: Frame; label?: string }[], scale: number, gap = 6): void {
  const cw = FOREST_W * scale + gap
  cells.forEach((c, i) => put(c.kind, c.dir ?? 'down', c.frame ?? 0, 24 + i * cw, y, scale, c.label))
  y += FOREST_H * scale + 26
}
function swatches(k: keyof Appearance, x0: number): void {
  for (let i = 0; i < count(k); i++) {
    const o = opt(k, i)
    ctx.fillStyle = o?.swatch ?? '#000'
    ctx.beginPath()
    ctx.arc(x0 + i * 30, y + 10, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(90,70,54,0.35)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

/** 권장 인앱 크기(높이 80 CSS px)로, 기존 픽셀 캐릭터와 섞어서 */
function recommended(): void {
  const hCss = STYLE_INFO.recommendedCssHeight
  const k = hCss / FOREST_H
  title(`0) 권장 인앱 크기 — 높이 ${hCss} CSS px @DPR ${DPR} (spriteScale = ${spriteScale(k, DPR)}), 픽셀 캐릭터(20x36 @2.2x)와 혼합`)
  const r = rng(4242)
  const pr = rng(99)
  const bands: [string, string][] = [['#f7efe2', '#e3cfae'], ['#fdfbf6', '#f3ece0'], ['#cfe3c2', '#a9cf9a'], ['#59606f', '#474d5a']]
  const guests = Array.from({ length: 6 }, () => randomAppearance(r))
  const bw = (W - 48) / 2
  bands.forEach(([sky, floor], bi) => {
    const x0 = 24 + (bi % 2) * bw
    const top = y + Math.floor(bi / 2) * 196
    ctx.fillStyle = sky
    ctx.fillRect(x0, top, bw, 186)
    ctx.fillStyle = floor
    ctx.fillRect(x0, top + 60, bw, 126)
    const cells: { kind: SpriteKind | 'pixel'; dir: Dir; frame: Frame }[] = []
    if (bi === 0) {
      cells.push({ kind: 'groom', dir: 'down', frame: 0 }, { kind: 'bride', dir: 'down', frame: 0 }, { kind: 'pixel', dir: 'down', frame: 0 })
      cells.push({ kind: guests[0], dir: 'down', frame: 0 }, { kind: guests[1], dir: 'right', frame: 1 }, { kind: 'pixel', dir: 'right', frame: 1 })
      cells.push({ kind: guests[2], dir: 'left', frame: 2 }, { kind: guests[3], dir: 'up', frame: 0 }, { kind: 'pixel', dir: 'up', frame: 0 }, { kind: guests[4], dir: 'down', frame: 1 }, { kind: guests[5], dir: 'right', frame: 0 })
    } else if (bi === 1) {
      for (const d of DIRS) cells.push({ kind: 'bride', dir: d, frame: 0 })
      for (const d of DIRS) cells.push({ kind: 'groom', dir: d, frame: d === 'down' ? 0 : 1 })
      cells.push({ kind: 'bride', dir: 'right', frame: 1 }, { kind: 'bride', dir: 'right', frame: 2 }, { kind: 'pixel', dir: 'down', frame: 0 })
    } else if (bi === 2) {
      for (const d of ['right', 'down', 'up'] as Dir[]) for (const f of [0, 1, 2] as Frame[]) cells.push({ kind: guests[d === 'right' ? 1 : d === 'down' ? 2 : 4], dir: d, frame: f })
      cells.push({ kind: 'pixel', dir: 'left', frame: 1 }, { kind: guests[5], dir: 'left', frame: 1 })
    } else {
      cells.push({ kind: 'bride', dir: 'down', frame: 0 }, { kind: 'groom', dir: 'down', frame: 0 }, { kind: 'bride', dir: 'left', frame: 1 }, { kind: 'bride', dir: 'up', frame: 0 })
      guests.slice(0, 5).forEach((g, i) => cells.push({ kind: g, dir: DIRS[i % 4], frame: (i % 3) as Frame }))
      cells.push({ kind: 'pixel', dir: 'down', frame: 0 }, { kind: 'pixel', dir: 'right', frame: 0 })
    }
    cells.forEach((c, i) => {
      const fx = x0 + 36 + i * ((bw - 72) / 10)
      const fy = top + 150 + (i % 2) * 14
      if (c.kind === 'pixel') {
        const sp = getPixelSprite(randomPixel(pr), c.dir, c.frame)
        const ps = hCss / SPRITE_H
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(sp, Math.round(fx - (SPRITE_W * ps) / 2), Math.round(fy - SPRITE_H * ps), SPRITE_W * ps, SPRITE_H * ps)
        ctx.imageSmoothingEnabled = true
      } else {
        const sp = getSprite(c.kind, c.dir, c.frame, spriteScale(k * MAG, DPR))
        ctx.drawImage(sp, fx - (FOREST_W * k) / 2, fy - FOREST_FOOT_Y * k, FOREST_W * k, FOREST_H * k)
      }
    })
  })
  y += 402
}

function crowd(): void {
  title('7) 군중 — 430px 폰 화면에서의 실제 크기 (하객 14명 + 신랑·신부)')
  // 앱: 논리 너비 192 → 430px. 캐릭터 높이 36 논리px
  const k = 430 / 192
  const pw = 430
  let x0 = 24
  for (let panel = 0; panel < 3; panel++) {
    const r = rng(77 + panel * 13)
    const top = y
    const ph = 236
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, top, pw, ph)
    ctx.clip()
    ctx.fillStyle = '#f7efe2'
    ctx.fillRect(x0, top, pw, ph)
    // 바닥 띠
    ctx.fillStyle = '#e3cfae'
    ctx.fillRect(x0, top + 52, pw, ph - 60)
    ctx.fillStyle = '#d9c29c'
    for (let i = 0; i < 12; i++) ctx.fillRect(x0 + i * 40 - 6, top + 52, 2, ph - 60)
    ctx.fillStyle = '#c9ad84'
    ctx.fillRect(x0, top + 52, pw, 3)
    const people: { kind: SpriteKind; dir: Dir; frame: Frame; fx: number; fy: number }[] = []
    people.push({ kind: 'groom', dir: 'down', frame: 0, fx: pw / 2 - 31, fy: 86 })
    people.push({ kind: 'bride', dir: 'down', frame: 0, fx: pw / 2 + 31, fy: 86 })
    for (let i = 0; i < 14; i++) {
      const rowI = i < 7 ? 0 : 1
      const col = i % 7
      people.push({
        kind: randomAppearance(r),
        dir: DIRS[Math.floor(r() * 4)],
        frame: Math.floor(r() * 3) as Frame,
        fx: 30 + col * 60 + (rowI ? 14 : 0) + r() * 8,
        fy: 150 + rowI * 62 + r() * 8,
      })
    }
    people.sort((a, b) => a.fy - b.fy)
    for (const p of people) {
      const c = getSprite(p.kind, p.dir, p.frame, k * ZOOM)
      ctx.drawImage(c, x0 + p.fx - (FOREST_W * k) / 2, top + p.fy - FOREST_FOOT_Y * k, FOREST_W * k, FOREST_H * k)
    }
    ctx.restore()
    ctx.strokeStyle = 'rgba(90,70,54,0.4)'
    ctx.strokeRect(x0 + 0.5, top + 0.5, pw - 1, ph - 1)
    x0 += pw + 16
  }
  y += 246
}

if (ONLY === 'crowd') {
  crowd()
} else if (ONLY === 'row') {
  recommended()
} else {
  recommended()
  title('1) 머리 모양 (앞)')
  row(Array.from({ length: count('hairStyle') }, (_, i) => ({ kind: { ...base, hairStyle: i, hairColor: i % 5 }, label: opt('hairStyle', i)?.label })), 3.5, 20)
  title('   머리 모양 — 옆 / 뒤')
  row(Array.from({ length: count('hairStyle') }, (_, i) => ({ kind: { ...base, hairStyle: i, hairColor: i % 5 }, dir: 'right' as Dir })), 2.4, 2)
  y -= 20
  row(Array.from({ length: count('hairStyle') }, (_, i) => ({ kind: { ...base, hairStyle: i, hairColor: i % 5 }, dir: 'up' as Dir })), 2.4, 2)
  y -= 10

  title('2) 의상 (앞)')
  row(Array.from({ length: count('outfit') }, (_, i) => ({ kind: { ...base, hairStyle: [0, 1, 10, 2, 4, 5, 6, 8, 3, 7][i] ?? 0, outfit: i, outfitColor: [0, 5, 4, 6, 3, 7, 9, 0, 8, 10][i] ?? i }, label: opt('outfit', i)?.label })), 3.5, 20)

  title('   의상 — 옆 / 뒤')
  const outfitKinds = Array.from({ length: count('outfit') }, (_, i) => ({ ...base, hairStyle: [0, 1, 10, 2, 4, 5, 6, 8, 3, 7][i] ?? 0, outfit: i, outfitColor: [0, 5, 4, 6, 3, 7, 9, 0, 8, 10][i] ?? i }))
  row(outfitKinds.flatMap((k) => [{ kind: k, dir: 'right' as Dir }, { kind: k, dir: 'up' as Dir }]), 2.4, 0)
  y -= 14
  title('   액세서리 — 옆 / 뒤')
  row(Array.from({ length: count('accessory') - 1 }, (_, i) => ({ ...base, hairStyle: 2, hairColor: 2, outfit: 3, outfitColor: 10, accessory: i + 1 })).flatMap((k) => [{ kind: k, dir: 'right' as Dir }, { kind: k, dir: 'up' as Dir }]), 2.4, 0)
  y -= 14

  title('3) 액세서리')
  row(Array.from({ length: count('accessory') }, (_, i) => ({ kind: { ...base, hairStyle: 2, hairColor: 2, outfit: 3, outfitColor: 10, accessory: i }, label: opt('accessory', i)?.label })), 3.5, 20)

  title('4) 피부 톤 · 머리 색 · 의상 색')
  const sy = y
  row(Array.from({ length: count('skin') }, (_, i) => ({ kind: { ...base, skin: i, hairStyle: i % 2 ? 1 : 5, hairColor: 0, outfit: 9, outfitColor: 8 + (i % 3) }, label: opt('skin', i)?.label })), 3, 14)
  const keep = y
  y = sy + 20
  ctx.fillStyle = '#6b5646'
  ctx.font = `500 12px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('머리 색', 660, y + 14)
  swatches('hairColor', 730)
  y += 40
  ctx.fillStyle = '#6b5646'
  ctx.fillText('의상 색', 660, y + 14)
  swatches('outfitColor', 730)
  y = keep

  title('5) 신랑 · 신부 — 4방향 (앞 / 오른쪽 / 왼쪽 / 뒤)')
  row(
    (['groom', 'bride'] as const).flatMap((k) => DIRS.map((d) => ({ kind: k as SpriteKind, dir: d, label: `${k === 'groom' ? '신랑' : '신부'} ${DIR_KO[d]}` }))),
    3.5,
    24,
  )

  title('6) 랜덤 하객 6명 — 4방향 x (정지 · 걷기1 · 걷기2)')
  const r = rng(20261117)
  for (let g = 0; g < 6; g++) {
    const a = randomAppearance(r)
    const colX = 24 + (g % 2) * 690
    if (g % 2 === 0 && g > 0) y += FOREST_H * 1.95 + 8
    DIRS.forEach((d, di) =>
      ([0, 1, 2] as Frame[]).forEach((f, fi) => {
        put(a, d, f, colX + (di * 3 + fi) * 55 + di * 6, y, 1.95)
      }),
    )
  }
  y += FOREST_H * 1.95 + 14

  crowd()
}

if (q.get('bench')) {
  const r = rng(5)
  const k = (430 / 192) * 3
  const t0 = performance.now()
  for (let i = 0; i < 150; i++) {
    const a = randomAppearance(r)
    for (const d of DIRS) for (const f of [0, 1, 2] as Frame[]) getSprite(a, d, f, k)
  }
  const t1 = performance.now()
  const guests = Array.from({ length: 150 }, () => randomAppearance(rng(Math.random() * 1e9)))
  const sprites = guests.map((a) => getSprite(a, 'down', 0, k))
  const t2 = performance.now()
  const off = document.createElement('canvas')
  off.width = 1290
  off.height = 2400
  const o = off.getContext('2d')!
  const t3 = performance.now()
  for (let n = 0; n < 60; n++) for (let i = 0; i < 150; i++) o.drawImage(sprites[i], (i % 15) * 80, Math.floor(i / 15) * 200)
  o.getImageData(0, 0, 1, 1)
  const t4 = performance.now()
  const st = spriteCacheStats()
  const msg = `cache ${st.entries} sprites / ${(st.pixels * 4 / 1048576).toFixed(0)}MB | bake 150x12 sprites @${k.toFixed(2)}: ${(t1 - t0).toFixed(0)}ms (${((t1 - t0) / 1800).toFixed(2)}ms/sprite) | first-visible 150: ${(t2 - t1).toFixed(0)}ms | blit 150 x60 frames: ${((t4 - t3) / 60).toFixed(2)}ms/frame`
  ctx.fillStyle = '#000'
  ctx.font = `14px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText(msg, 24, H - 10)
  document.title = msg
}
