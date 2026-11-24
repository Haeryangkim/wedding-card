/**
 * 구운 아틀라스(WebP)를 실제 실행 코드(web/.../kaykit/compose.ts)로 조합해 확인용 그림을 만든다.
 *
 *   node art/kaykit/proof.mjs [--modules <node_modules>] [--out <폴더>] [--looks '<JSON 배열>'] [--gif]
 *
 * 만드는 것: <out>/walk.png (신랑·신부·하객 6명 x 4방향 x 3프레임, 원본 크기 + 지도 크기), art/kaykit/preview.png,
 * --gif 를 주면 <out>/walk.gif (ffmpeg 필요). dwebp(libwebp) 가 있어야 한다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { HERE, argValue, readPng, writePng, over } from './kit.mjs'

const ASSETS = path.resolve(HERE, '../../web/src/guestbook/styles/kaykit')
const { ATLAS } = await import(path.join(ASSETS, 'assets/atlas.ts'))
const { compose } = await import(path.join(ASSETS, 'compose.ts'))

const OUT = path.join(HERE, 'out')
fs.mkdirSync(OUT, { recursive: true })
const outDir = path.resolve(argValue('--out', OUT))
fs.mkdirSync(outDir, { recursive: true })
for (const n of ['atlas', 'mask']) execFileSync('dwebp', ['-quiet', path.join(ASSETS, `assets/${n}.webp`), '-o', path.join(OUT, `${n}.decoded.png`)])
const colorPng = readPng(path.join(OUT, 'atlas.decoded.png'))
const maskPng = readPng(path.join(OUT, 'mask.decoded.png'))
const color = { data: colorPng.data, width: colorPng.w }
const mask = { data: maskPng.data, width: maskPng.w }

const W = ATLAS.w
const H = ATLAS.h
const BG = [126, 170, 110]

const DEFAULT_LOOKS = [
  ATLAS.groom,
  ATLAS.bride,
  { skin: 0, hairStyle: 3, hairColor: 2, outfit: 8, outfitColor: 0, accessory: 5 },
  { skin: 2, hairStyle: 0, hairColor: 4, outfit: 2, outfitColor: 7, accessory: 2 },
  { skin: 1, hairStyle: 4, hairColor: 8, outfit: 4, outfitColor: 9, accessory: 11 },
  { skin: 3, hairStyle: 2, hairColor: 6, outfit: 10, outfitColor: 1, accessory: 6 },
  { skin: 4, hairStyle: 1, hairColor: 0, outfit: 7, outfitColor: 3, accessory: 7 },
  { skin: 5, hairStyle: 5, hairColor: 3, outfit: 9, outfitColor: 5, accessory: 10 },
]
const looks = process.argv.includes('--looks') ? JSON.parse(argValue('--looks')) : DEFAULT_LOOKS

function canvas(w, h) {
  const d = new Uint8Array(w * h * 4)
  for (let i = 0; i < d.length; i += 4) {
    d[i] = BG[0]
    d[i + 1] = BG[1]
    d[i + 2] = BG[2]
    d[i + 3] = 255
  }
  return d
}

/** 넓이 평균으로 줄인다 (곱해진 알파) — 지도에 그려지는 크기를 흉내 낸다 */
function shrink(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh * 4)
  const fx = sw / dw
  const fy = sh / dh
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let j = Math.floor(y * fy); j < Math.max(Math.floor(y * fy) + 1, Math.floor((y + 1) * fy)); j++)
        for (let i = Math.floor(x * fx); i < Math.max(Math.floor(x * fx) + 1, Math.floor((x + 1) * fx)); i++) {
          const s = (j * sw + i) * 4
          const sa = src[s + 3] / 255
          r += src[s] * sa
          g += src[s + 1] * sa
          b += src[s + 2] * sa
          a += sa
          n++
        }
      const o = (y * dw + x) * 4
      if (a > 0) {
        out[o] = r / a
        out[o + 1] = g / a
        out[o + 2] = b / a
        out[o + 3] = (a / n) * 255
      }
    }
  return out
}

const sprite = (look, d, f) => compose(ATLAS, color, mask, look, d, f)

// 1) 연락 시트: 줄 = 외형, 칸 = 방향 x 프레임. 그 아래에 지도 크기(높이 SMALL px)로 줄인 것
const SMALL = Number(argValue('--small', 96))
const sw = Math.round((W * SMALL) / H)
const cols = ATLAS.dirs.length * ATLAS.frames
const sheetW = cols * W
const sheetH = looks.length * H + looks.length * SMALL
const sheet = canvas(sheetW, sheetH)
looks.forEach((look, li) => {
  for (let d = 0; d < ATLAS.dirs.length; d++)
    for (let f = 0; f < ATLAS.frames; f++) {
      const s = sprite(look, d, f)
      over(sheet, sheetW, s, W, H, (d * ATLAS.frames + f) * W, li * H)
      over(sheet, sheetW, shrink(s, W, H, sw, SMALL), sw, SMALL, (d * ATLAS.frames + f) * sw + li * 0, looks.length * H + li * SMALL)
    }
})
writePng(path.join(outDir, 'walk.png'), sheet, sheetW, sheetH)
console.log('saved', path.join(outDir, 'walk.png'))

// 2) preview.png: 정면 정지 자세 한 줄
if (!process.argv.includes('--looks')) {
  const pv = canvas(looks.length * W, H)
  looks.forEach((look, li) => over(pv, looks.length * W, sprite(look, 0, 0), W, H, li * W, 0))
  writePng(path.join(HERE, 'preview.png'), pv, looks.length * W, H)
  console.log('saved', path.join(HERE, 'preview.png'))
}

// 3) 걷는 GIF: 프레임 순서 1·0·2·0 (장면과 같다), 줄 = 방향
if (process.argv.includes('--gif')) {
  const cycle = [1, 0, 2, 0]
  const gw = looks.length * W
  const gh = ATLAS.dirs.length * H
  cycle.forEach((f, i) => {
    const fr = canvas(gw, gh)
    looks.forEach((look, li) => {
      for (let d = 0; d < ATLAS.dirs.length; d++) over(fr, gw, sprite(look, d, f), W, H, li * W, d * H)
    })
    writePng(path.join(OUT, `gif-${i}.png`), fr, gw, gh)
  })
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '5', '-i', path.join(OUT, 'gif-%d.png'), '-vf', 'scale=iw*0.6:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=255[p];[b][p]paletteuse=dither=none', '-loop', '0', path.join(outDir, 'walk.gif')])
  console.log('saved', path.join(outDir, 'walk.gif'))
}
