/**
 * KayKit Adventurers(3D, CC0) → 2D 스프라이트 아틀라스.
 *
 *   node art/kaykit/build.mjs [--modules <node_modules 경로>]
 *
 * 헤드리스 크롬에서 three.js 로 조각(몸·머리·모자·손에 든 물건)을 방향 4 x 프레임 3 으로 따로 굽고,
 * 빈 둘레를 잘라 한 장에 채운 뒤 WebP 로 줄여 web/src/guestbook/styles/kaykit/assets/ 에 쓴다:
 *   atlas.webp (색) · mask.webp (R 피부 / G 머리 / B 옷 비율) · atlas.ts (자리표·목록)
 * 중간 결과(PNG)는 art/kaykit/out/ 에 남는다 (저장소에는 올리지 않는다).
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { HERE, openRenderer, writePng } from './kit.mjs'
import { ACCESSORIES, BODIES, BRIDE, CAMERA, DIRS, GROOM, HAIR_COLORS, HEADS, NEUTRAL, OUTFIT_COLORS, PIECES, SKINS } from './config.mjs'

const OUT = path.join(HERE, 'out')
const ASSETS = path.resolve(HERE, '../../web/src/guestbook/styles/kaykit/assets')
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(ASSETS, { recursive: true })

const { w: W, h: H } = CAMERA
const FRAMES = 3
const CELLS = DIRS.length * FRAMES
const ATLAS_W = 2048
const PAD = 1

const r = await openRenderer()
console.log('renderer ready:', r.info.parts.length, 'meshes')

/** 한 레이어를 12칸으로 굽는다 → [{ color, mask }] (W x H RGBA) */
async function bake(show, occl, paint) {
  const cells = []
  for (const dir of DIRS)
    for (let frame = 0; frame < FRAMES; frame++) {
      const c = await r.cell({ show, occl, paint, dir, frame })
      cells.push({ color: new Uint8Array(c.color), mask: new Uint8Array(c.mask) })
    }
  return cells
}

/** full − front (곱해진 알파에서 뺀다) = 가리개 뒤로 숨는 부분 */
function hiddenPart(full, front) {
  const color = new Uint8Array(W * H * 4)
  const mask = new Uint8Array(W * H * 4)
  for (let i = 0; i < W * H * 4; i += 4) {
    const fa = full.color[i + 3]
    const ga = front.color[i + 3]
    const a = fa - ga
    if (a < 6) continue
    for (let k = 0; k < 3; k++) {
      color[i + k] = Math.max(0, Math.min(255, Math.round((full.color[i + k] * fa - front.color[i + k] * ga) / a)))
      mask[i + k] = Math.max(0, Math.min(255, Math.round((full.mask[i + k] * fa - front.mask[i + k] * ga) / a)))
    }
    color[i + 3] = a
    mask[i + 3] = 255
  }
  return { color, mask }
}

function bbox(cell) {
  let x0 = W
  let y0 = H
  let x1 = -1
  let y1 = -1
  let n = 0
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (cell.color[(y * W + x) * 4 + 3] > 0) {
        n++
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return n === 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n }
}

/** 띠 목록: 띠 = 12칸, 칸 = { cell, box } | null */
const strips = []
function addStrip(name, cells, minPixels = 1) {
  const entries = cells.map((cell) => {
    const box = bbox(cell)
    return box && box.n >= minPixels ? { cell, box } : null
  })
  if (entries.every((e) => e === null)) return -1
  strips.push({ name, entries })
  return strips.length - 1
}

const edge = { left: W, right: 0, top: H, bottom: 0 }
function noteEdges(cells) {
  for (const cell of cells) {
    const b = bbox(cell)
    if (!b) continue
    edge.left = Math.min(edge.left, b.x)
    edge.right = Math.max(edge.right, b.x + b.w)
    edge.top = Math.min(edge.top, b.y)
    edge.bottom = Math.max(edge.bottom, b.y + b.h)
  }
}

const meta = { heads: [], outfits: [], accs: [] }
let headTop = H

for (const h of HEADS) {
  const cells = await bake(h.meshes, [], h.paint)
  noteEdges(cells)
  headTop = Math.min(headTop, ...cells.map((c) => bbox(c).y))
  meta.heads.push({ label: h.label, strip: addStrip(`head.${h.id}`, cells), ...(h.id === 'hood' ? { hood: true } : {}) })
  console.log('head', h.id)
}
for (const b of BODIES) {
  const cells = await bake(b.meshes, [], b.paint)
  noteEdges(cells)
  let base = 0xffffff
  if (b.base) {
    const [cr, cg, cb] = await r.page.evaluate(([m, k]) => window.kk.blockTop(m, k), b.base)
    base = (cr << 16) | (cg << 8) | cb
  } else if (b.id === 'groom') base = 0x3a3b45
  meta.outfits.push({ label: b.label, strip: addStrip(`body.${b.id}`, cells), base })
  console.log('body', b.id, '#' + base.toString(16).padStart(6, '0'))
}
const pieceStrips = {}
for (const [id, p] of Object.entries(PIECES)) {
  const full = await bake(p.meshes, [], p.paint)
  const front = await bake(p.meshes, p.ref, p.paint)
  noteEdges(full)
  const under = addStrip(`${id}.under`, full.map((f, i) => hiddenPart(f, front[i])), 24)
  const over = addStrip(`${id}.over`, front, 8)
  pieceStrips[id] = [under, over]
  console.log('piece', id, 'under', under >= 0 ? strips[under].entries.map((e) => (e ? e.box.n : 0)).join(',') : '-', '| over', over >= 0 ? strips[over].entries.map((e) => (e ? e.box.n : 0)).join(',') : '-')
}
for (const a of ACCESSORIES) meta.accs.push({ label: a.label, pieces: a.pieces.map((id) => pieceStrips[id]), ...(a.hat ? { hat: true } : {}), ...(a.couple ? { couple: true } : {}) })
await r.close()
console.log('painted extent in the frame box:', edge, `(box ${W}x${H}, foot ${CAMERA.footY})`, 'head top', headTop)

/* ── 채우기 (선반 방식) ───────────────────────────────────── */

const rects = []
for (const [si, s] of strips.entries()) for (const [ci, e] of s.entries.entries()) if (e) rects.push({ si, ci, e })
rects.sort((a, b) => b.e.box.h - a.e.box.h || b.e.box.w - a.e.box.w)
let x = 0
let y = 0
let shelf = 0
for (const rc of rects) {
  const { w, h } = rc.e.box
  if (x + w + PAD > ATLAS_W) {
    x = 0
    y += shelf + PAD
    shelf = 0
  }
  rc.e.at = { x, y }
  x += w + PAD
  shelf = Math.max(shelf, h)
}
const ATLAS_H = y + shelf
const color = new Uint8Array(ATLAS_W * ATLAS_H * 4)
const mask = new Uint8Array(ATLAS_W * ATLAS_H * 4)
for (let i = 3; i < mask.length; i += 4) mask[i] = 255
let painted = 0
for (const { e } of rects) {
  const { box, at, cell } = e
  painted += box.w * box.h
  for (let j = 0; j < box.h; j++) {
    const s = ((box.y + j) * W + box.x) * 4
    const d = ((at.y + j) * ATLAS_W + at.x) * 4
    color.set(cell.color.subarray(s, s + box.w * 4), d)
    for (let i = 0; i < box.w; i++) {
      mask[d + i * 4] = cell.mask[s + i * 4]
      mask[d + i * 4 + 1] = cell.mask[s + i * 4 + 1]
      mask[d + i * 4 + 2] = cell.mask[s + i * 4 + 2]
    }
  }
}
writePng(path.join(OUT, 'atlas.png'), color, ATLAS_W, ATLAS_H)
writePng(path.join(OUT, 'mask.png'), mask, ATLAS_W, ATLAS_H)
console.log(`atlas ${ATLAS_W}x${ATLAS_H}, ${rects.length} cells in ${strips.length} strips, fill ${((painted / (ATLAS_W * ATLAS_H)) * 100).toFixed(0)}%`)

// WebP: 색은 손실(알파는 무손실), 마스크는 평평한 색이라 무손실이 더 작고 정확하다
execFileSync('cwebp', ['-quiet', '-q', '88', '-alpha_q', '100', '-m', '6', '-sharp_yuv', path.join(OUT, 'atlas.png'), '-o', path.join(ASSETS, 'atlas.webp')])
execFileSync('cwebp', ['-quiet', '-lossless', '-z', '9', path.join(OUT, 'mask.png'), '-o', path.join(ASSETS, 'mask.webp')])
const size = (f) => fs.statSync(path.join(ASSETS, f)).size
console.log('atlas.webp', size('atlas.webp'), 'mask.webp', size('mask.webp'))

/* ── atlas.ts ─────────────────────────────────────────────── */

const hex = (c) => parseInt(c.slice(1), 16)
const stripRows = strips.map((s) => s.entries.flatMap((e) => (e ? [e.at.x, e.at.y, e.box.w, e.box.h, e.box.x, e.box.y] : [0, 0, 0, 0, 0, 0])))
const data = {
  w: W,
  h: H,
  footY: CAMERA.footY,
  headTop,
  dirs: DIRS,
  frames: FRAMES,
  neutral: NEUTRAL,
  size: [ATLAS_W, ATLAS_H],
  skins: SKINS.map((c) => ({ label: c.label, swatch: c.color, rgb: hex(c.color) })),
  hairColors: HAIR_COLORS.map((c) => ({ label: c.label, swatch: c.color, rgb: hex(c.color) })),
  outfitColors: OUTFIT_COLORS.map((c) => (c.color ? { label: c.label, swatch: c.color, rgb: hex(c.color) } : { label: c.label, swatch: 'conic-gradient(#e25555, #f0c64a, #3ea35d, #3fa4dc, #7a68b8, #e25555)', rgb: -1 })),
  heads: meta.heads,
  outfits: meta.outfits,
  accs: meta.accs,
  groom: GROOM,
  bride: BRIDE,
}
const json = (v) => JSON.stringify(v)
const lines = (list) => '[\n' + list.map((v) => '    ' + json(v) + ',\n').join('') + '  ]'
const ts = `// art/kaykit/build.mjs 가 만든 파일 — 직접 고치지 말 것
export interface KayKitLook {
  skin: number
  hairStyle: number
  hairColor: number
  outfit: number
  outfitColor: number
  accessory: number
}
export interface KayKitColor {
  label: string
  /** 색상칩 (CSS background) */
  swatch: string
  /** 곱할 색 0xRRGGBB. 의상 색의 -1 = 그 의상의 원래 색 */
  rgb: number
}
export interface KayKitAtlas {
  /** 프레임 상자 */
  w: number
  h: number
  /** 위에서 발바닥 선까지 */
  footY: number
  /** 맨머리의 꼭대기 줄 (모자는 더 위로 올라간다) */
  headTop: number
  dirs: string[]
  frames: number
  /** 색을 바꾸는 영역을 구운 중립 밝기 (0~255) — 고른 색 / neutral 을 곱한다 */
  neutral: number
  /** 아틀라스 그림 크기 */
  size: [number, number]
  /** 띠: 방향 x 프레임 칸마다 [아틀라스 x, y, 너비, 높이, 칸 안 x, 칸 안 y] 를 이어 붙였다 (빈 칸은 너비 0) */
  strips: number[][]
  skins: KayKitColor[]
  hairColors: KayKitColor[]
  outfitColors: KayKitColor[]
  /** hood = 후드를 쓴 머리 (모자와 함께 랜덤으로 주지 않는다) */
  heads: { label: string; strip: number; hood?: boolean }[]
  /** base = 의상 색 "기본" 일 때의 색 */
  outfits: { label: string; strip: number; base: number }[]
  /** pieces: [under 띠, over 띠] (-1 = 없음). hat = 머리에 쓰는 것, couple = 신랑·신부 전용 */
  accs: { label: string; pieces: [number, number][]; hat?: boolean; couple?: boolean }[]
  groom: KayKitLook
  bride: KayKitLook
}
export const ATLAS: KayKitAtlas = {
  w: ${data.w},
  h: ${data.h},
  footY: ${data.footY},
  headTop: ${data.headTop},
  dirs: ${json(data.dirs)},
  frames: ${data.frames},
  neutral: ${data.neutral},
  size: ${json(data.size)},
  strips: ${lines(stripRows)},
  skins: ${lines(data.skins)},
  hairColors: ${lines(data.hairColors)},
  outfitColors: ${lines(data.outfitColors)},
  heads: ${lines(data.heads)},
  outfits: ${lines(data.outfits)},
  accs: ${lines(data.accs)},
  groom: ${json(data.groom)},
  bride: ${json(data.bride)},
}
`
fs.writeFileSync(path.join(ASSETS, 'atlas.ts'), ts)
console.log('wrote', path.join(ASSETS, 'atlas.ts'))
