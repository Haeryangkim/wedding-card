/** 신랑·신부 전용: 턱시도, 웨딩드레스, 베일, 티아라, 부케. */
import { bow } from './accessories'
import type { View } from './dims'
import { bez, circle, ellipse, flat, flower, line, poly, quarter, shape, type C } from './draw'
import { suitFront, type OutfitDef } from './outfits'
import { CREAM } from './palette'

const SATIN = '#262733'
const LEAF = '#6fa56c'
const LACE = '#c9b3a4'
const SASH = '#f3a9b8'
const GOLD = '#ecc45e'
/** 베일 테두리·주름: 밝은 배경에서도 보이도록 푸른 기를 준다 */
const VEIL_RIM = '#9fb1e2'

export const TUXEDO: OutfitDef = {
  label: '턱시도',
  lower: 'pants',
  sleeve: 'long',
  pal: (c) => ({ top: c, bottom: c, sleeve: c, leg: '#34364a', shoe: '#2c2a33', accent: SATIN }),
  cuff: () => CREAM,
  detail: (ctx, f, p) => suitFront(ctx, f, p, { bow: true, lapel: SATIN, pleated: true }),
  trim(ctx, f) {
    if (f === 'back') return
    bow(ctx, 0, 69.6, 6.4, 0, '#2f3044')
    // 포켓치프 + 부토니에
    flat(ctx, poly([-11.6, 74, -7, 72.8, -7, 75.6, -11.4, 76.4]), CREAM)
    flat(ctx, ellipse(11.4, 73.4, 3, 1.7, 0.7), LEAF)
    flat(ctx, ellipse(7.2, 74.4, 2.6, 1.5, -0.8), LEAF)
    flower(ctx, 9.2, 71.2, 3.9, '#fff6ee')
  },
}

export const GOWN: OutfitDef = {
  label: '웨딩드레스',
  lower: 'long',
  sleeve: 'short',
  sleeveW: 10.4,
  pal: () => ({ top: '#fffaf1', bottom: '#fffaf1', sleeve: '#fffaf1', leg: null, shoe: '#fffaf1', accent: SASH }),
  detail(ctx, f) {
    if (f === 'front') {
      // 하트 네크라인 + 보디스 레이스
      line(ctx, [-9.4, 62.6, -4.6, 67, 0, 64], LACE, 1.5, 0.9)
      line(ctx, [9.4, 62.6, 4.6, 67, 0, 64], LACE, 1.5, 0.9)
      for (const [x, y] of [[-6, 70.4], [0, 69], [6, 70.4], [-3, 72.6], [3, 72.6]]) flat(ctx, circle(x, y, 0.95), LACE, 0.9)
    } else {
      line(ctx, [-9, 63.4, 0, 66.4, 9, 63.4], LACE, 1.5, 0.9)
      for (const y of [68.6, 71.4, 74.2]) flat(ctx, circle(0, y, 1), LACE, 0.9)
    }
    line(ctx, [-30, 76.4, 30, 76.4], SASH, 3.2)
  },
  skirtDetail(ctx, _f, _p, sway) {
    // 두 겹 스커트 + 주름
    bez(ctx, [-30, 85, -12, 91.4, 12, 91.4, 30, 85], LACE, 1.3, 0.75)
    for (const x of [-6.4, 0, 6.4]) bez(ctx, [x, 80, x * 1.2, 86, x * 1.7 + sway * 0.5, 92, x * 1.9 + sway, 97], LACE, 1.1, 0.5)
    // 레이스 단: 스캘럽 + 진주
    for (let i = -5; i <= 5; i++) {
      const x = i * 4.9 + sway
      shape(ctx, circle(x, 102.2, 3.3), '#ffffff', [x - 3, 99, x + 3, 104], { rim: 0, depth: 0 })
      ctx.save()
      ctx.strokeStyle = LACE
      ctx.lineWidth = 1.1
      ctx.stroke(circle(x, 102.2, 3.3))
      ctx.restore()
      flat(ctx, circle(x + 2.45, 96.6, 0.95), GOLD, 0.9)
    }
  },
  trim(ctx, f) {
    const x = f === 'back' ? 0 : 8.6
    if (f === 'back') {
      // 등 뒤 큰 리본과 꼬리
      for (const s of [-1, 1]) {
        line(ctx, [s * 0.8, 77, s * 4.6, 91], '#d98a9b', 4.4)
        line(ctx, [s * 0.8, 77, s * 4.6, 91], SASH, 3)
      }
      bow(ctx, 0, 76.6, 6.6, 0, SASH)
    } else {
      bow(ctx, x, 76.6, 4.4, 0, SASH)
    }
  },
}

/** 베일 한 겹: 본체 + 스캘럽 단을 합쳐 칠하고, 푸른 테두리와 주름을 얹는다 */
function veilShape(ctx: C, main: Path2D, scallops: number[][], folds: number[][], alpha: number, foldAlpha = 0.6, topAlpha = alpha): void {
  const ps = [main, ...scallops.map(([x, y]) => circle(x, y, 3))]
  ctx.save()
  ctx.strokeStyle = VEIL_RIM
  ctx.lineWidth = 2.2
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 0.9
  for (const p of ps) ctx.stroke(p)
  ctx.restore()
  const g = ctx.createLinearGradient(0, 8, 0, 100)
  g.addColorStop(0, `rgba(246,249,255,${topAlpha})`)
  g.addColorStop(0.5, `rgba(240,245,255,${alpha})`)
  g.addColorStop(1, `rgba(226,235,254,${alpha * 0.82})`)
  ctx.fillStyle = g
  for (const p of ps) ctx.fill(p)
  for (const f of folds) bez(ctx, f, VEIL_RIM, 1.1, foldAlpha)
}

export function veil(ctx: C, view: View, layer: 'under' | 'over'): void {
  const p = new Path2D()
  if (view === 'front' && layer === 'under') {
    p.moveTo(0, 4)
    p.bezierCurveTo(-31, 6, -38, 50, -34, 93)
    p.quadraticCurveTo(0, 98, 34, 93)
    p.bezierCurveTo(38, 50, 31, 6, 0, 4)
    p.closePath()
    const sc = [-31, -25.4, 25.4, 31].map((x) => [x, 94.6 - Math.abs(x) * 0.02])
    veilShape(ctx, p, sc, [[-28, 40, -33, 56, -32, 76, -29, 92], [28, 40, 33, 56, 32, 76, 29, 92]], 0.95)
  } else if (view === 'back' && layer === 'over') {
    p.moveTo(0, 13)
    p.bezierCurveTo(-26, 13, -38, 50, -34, 93)
    p.quadraticCurveTo(0, 99, 34, 93)
    p.bezierCurveTo(38, 50, 26, 13, 0, 13)
    p.closePath()
    const sc = [-30, -24, -18, -12, -6, 0, 6, 12, 18, 24, 30].map((x) => [x, 96.4 - Math.abs(x) * 0.07])
    const folds = [-1, 1].flatMap((s) => [
      [s * 5, 19, s * 12, 40, s * 15, 66, s * 13.6, 93],
      [s * 12, 21, s * 27, 40, s * 30, 66, s * 27.6, 90],
    ])
    veilShape(ctx, p, sc, folds, 0.62, 0.45, 0.26)
  } else if (view === 'side' && layer === 'under') {
    p.moveTo(-3, 5)
    p.bezierCurveTo(-32, 2, -43.5, 50, -37.4, 93.4)
    p.quadraticCurveTo(-25, 98, -11, 93.6)
    p.bezierCurveTo(-9, 60, -7, 30, -3, 5)
    p.closePath()
    const sc = [-34, -28.4, -22.8, -17.2].map((x) => [x, 95.6])
    veilShape(ctx, p, sc, [[-22, 16, -36, 40, -37, 68, -32.6, 92], [-15, 30, -27, 50, -28, 72, -23, 94]], 0.95)
  }
}

export function bouquet(ctx: C, view: View): void {
  if (view === 'back') return
  const draw = () => {
    // 손잡이 리본
    for (const s of [-1, 1]) {
      line(ctx, [0, 85, s * 3.4, 93], '#d98a9b', 3.4)
      line(ctx, [0, 85, s * 3.4, 93], SASH, 2.2)
    }
    for (const [dx, dy, r] of [[-9.4, -2.6, -0.6], [9.4, -2.6, 0.6], [-8, 3.6, 0.5], [8, 3.6, -0.5], [0, -8.6, 1.57], [0, 6.4, 0]]) {
      shape(ctx, ellipse(dx, 79.6 + dy, 4.6, 2.7, r), LEAF, [dx - 4, 76, dx + 4, 84], { rim: 0.9 })
    }
    const cols = ['#f7a9b5', '#fff6ee', '#f6c56a', '#fff6ee', '#f29a8a', '#f7a9b5']
    const pts = [[-5.6, -1.4], [5.6, -1.4], [0, -5.2], [-3.2, 3.4], [3.2, 3.4], [0, -0.6]]
    pts.forEach(([dx, dy], i) => flower(ctx, dx, 79.6 + dy, 3.9, cols[i]))
  }
  if (view === 'side') {
    ctx.save()
    ctx.translate(6.4, 0)
    quarter(ctx, draw)
    ctx.restore()
  } else draw()
}

/** 금빛 티아라 + 양옆 작은 꽃. 뒤에서는 베일을 고정한 꽃 장식 */
export function tiara(ctx: C, view: View): void {
  if (view === 'back') {
    flat(ctx, ellipse(-6.4, 17.6, 3, 1.7, -0.5), LEAF)
    flat(ctx, ellipse(6.4, 17.6, 3, 1.7, 0.5), LEAF)
    flower(ctx, -4.6, 15.4, 3.6, '#fff6ee')
    flower(ctx, 4.6, 15.4, 3.6, '#fff6ee')
    flower(ctx, 0, 13.6, 4, '#f7a9b5')
    return
  }
  const side = view === 'side'
  const ox = side ? 5 : 0
  const w = side ? 9 : 10.4
  const band = [ox - w, 21.4, ox, 18, ox + w, 21.4 + (side ? 1.2 : 0)]
  line(ctx, band, '#a8802e', 3.6)
  line(ctx, band, GOLD, 2.2)
  for (const [dx, dy, r] of [[-0.56, 0.6, 1.9], [0, -1.6, 2.5], [0.56, 0.6, 1.9]]) {
    const x = ox + dx * w
    const y = 17.6 + dy + Math.abs(dx) * 2.4
    line(ctx, [x, y + 2.6, x, y], '#a8802e', 2.6)
    shape(ctx, circle(x, y - 1, r), dx === 0 ? '#bfe3f2' : CREAM, [x - 2, y - 3, x + 2, y + 1], { rim: 0.9 })
  }
  flower(ctx, ox - w - 2.6, 22.6, 3.5, '#f7a9b5')
  if (!side) flower(ctx, ox + w + 2.6, 22.6, 3.5, '#fff6ee')
}
