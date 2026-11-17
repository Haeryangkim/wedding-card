/** 액세서리 (머리·얼굴·몸 위에 얹는 마지막 층). 0 = 없음. */
import type { View } from './dims'
import { circle, darken, ellipse, flat, flower, line, shape, type C } from './draw'
import { CREAM, INK } from './palette'

export interface AccessoryDef {
  label: string
  draw(ctx: C, view: View, accent: string): void
}

const LEAF = '#7fae7a'

export function bow(ctx: C, x: number, y: number, s: number, rot: number, col: string): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  const lobe = (d: number) => {
    const p = new Path2D()
    p.moveTo(0, 0)
    p.bezierCurveTo(d * s * 0.5, -s * 0.9, d * s * 1.25, -s * 0.75, d * s * 1.15, 0)
    p.bezierCurveTo(d * s * 1.25, s * 0.75, d * s * 0.5, s * 0.9, 0, 0)
    p.closePath()
    return p
  }
  shape(ctx, [lobe(-1), lobe(1)], col, [-s, -s, s, s], { rim: 1.1 })
  shape(ctx, circle(0, 0, s * 0.3), darken(col, 0.12), [-1, -1, 1, 1], { rim: 0.8 })
  ctx.restore()
}

function lens(ctx: C, x: number, y: number, rx: number, dark: boolean): void {
  const p = ellipse(x, y, rx, 6.1)
  flat(ctx, p, dark ? '#3f3540' : '#ffffff', dark ? 0.92 : 0.28)
  ctx.strokeStyle = dark ? '#2e2630' : INK
  ctx.lineWidth = 1.5
  ctx.stroke(p)
  if (dark) line(ctx, [x - rx * 0.5, y - 2.6, x - rx * 0.1, y - 3.4], '#ffffff', 1.2, 0.5)
}
function glasses(dark: boolean) {
  return (ctx: C, view: View) => {
    if (view === 'front') {
      lens(ctx, -11.5, 45.5, 6.6, dark)
      lens(ctx, 11.5, 45.5, 6.6, dark)
      line(ctx, [-4.9, 44.6, 0, 43, 4.9, 44.6], INK, 1.4)
    } else if (view === 'side') {
      lens(ctx, 16.5, 45.5, 4.6, dark)
      line(ctx, [12, 44.6, -2, 45.2], INK, 1.4)
    }
  }
}

function beretPath(m: number): Path2D {
  const p = new Path2D()
  p.moveTo(m * -25, 22.5)
  p.bezierCurveTo(m * -30, 5, m * -5, -1.5, m * 11, 2.5)
  p.bezierCurveTo(m * 30, 6, m * 32, 20, m * 25, 25)
  p.bezierCurveTo(m * 10, 18.5, m * -10, 18.5, m * -25, 22.5)
  p.closePath()
  return p
}

export const ACCESSORIES: AccessoryDef[] = [
  { label: '없음', draw() {} },
  { label: '안경', draw: glasses(false) },
  { label: '선글라스', draw: glasses(true) },
  {
    label: '리본',
    draw(ctx, v, a) {
      if (v === 'front') bow(ctx, 17, 17.5, 7.4, 0.35, a)
      else if (v === 'back') bow(ctx, -17, 17.5, 7.4, -0.35, a)
      else bow(ctx, -5, 12.5, 7, -0.15, a)
    },
  },
  {
    label: '꽃핀',
    draw(ctx, v) {
      if (v === 'front') flower(ctx, -20, 27, 5, '#fff3ee')
      else if (v === 'back') flower(ctx, 20, 27, 5, '#fff3ee')
      else flower(ctx, 6, 27, 5, '#fff3ee')
    },
  },
  {
    label: '베레모',
    draw(ctx, v) {
      const c = '#b85662'
      const m = v === 'back' ? -1 : 1
      line(ctx, [m * 4, 2.6, m * 6, -1.2], darken(c, 0.3), 2)
      ctx.save()
      if (v === 'side') ctx.translate(-3, 0)
      shape(ctx, beretPath(m), c, [-20, 0, 20, 26])
      ctx.restore()
    },
  },
  {
    label: '나비넥타이',
    draw(ctx, v, a) {
      if (v === 'front') bow(ctx, 0, 68.6, 4.6, 0, a)
      else if (v === 'side') bow(ctx, 9, 68.6, 3.2, 0, a)
    },
  },
  {
    label: '화관',
    draw(ctx, v) {
      const cols = ['#f6a6b4', '#fff3ee', '#f3c36a', '#fff3ee', '#f29a8a']
      const xs = v === 'side' ? [-24, -16.5, -8.5, 0, 8.5, 16.5, 23] : [-22.5, -15.5, -8, 0, 8, 15.5, 22.5]
      const yAt = (x: number) => 15.5 + (x / 27) ** 2 * 13
      for (let i = 0; i < xs.length - 1; i++) {
        const mx = (xs[i] + xs[i + 1]) / 2
        flat(ctx, ellipse(mx, yAt(mx) + 0.6, 2.8, 1.7, 0.4), LEAF)
      }
      xs.forEach((x, i) => flower(ctx, x, yAt(x), 3.5, cols[i % cols.length]))
    },
  },
  {
    label: '코르사주',
    draw(ctx, v) {
      if (v === 'back') return
      const x = v === 'side' ? 6.5 : 7.6
      flat(ctx, ellipse(x + 2.6, 74.6, 3, 1.7, 0.7), LEAF)
      flower(ctx, x, 72, 3.7, '#f7a9b5')
    },
  },
  {
    label: '진주 목걸이',
    draw(ctx, v) {
      if (v === 'front') {
        for (let i = -3; i <= 3; i++) {
          const x = i * 2.7
          const y = 70.4 - i * i * 0.42
          shape(ctx, circle(x, y, 1.45), CREAM, [x - 1, y - 1, x + 1, y + 1], { rim: 0.7 })
        }
      } else if (v === 'side') {
        for (let i = 0; i < 3; i++) shape(ctx, circle(5 + i * 2.5, 67 + i * 1.3, 1.4), CREAM, [0, 66, 10, 72], { rim: 0.7 })
      }
    },
  },
]
