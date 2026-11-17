/** 액세서리 (머리·얼굴·몸 위에 얹는 마지막 층). 0 = 없음. */
import type { View } from './dims'
import { FACE34 } from './body'
import { circle, darken, ellipse, flat, flower, line, quarter, shape, type C } from './draw'
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
  const p = ellipse(x, y, rx, 6.3)
  flat(ctx, p, dark ? '#3a303c' : '#ffffff', dark ? 0.94 : 0.34)
  ctx.strokeStyle = dark ? '#2a222c' : INK
  ctx.lineWidth = dark ? 1.6 : 1.9
  ctx.stroke(p)
  if (dark) line(ctx, [x - rx * 0.55, y - 2.4, x - rx * 0.05, y - 3.6], '#ffffff', 1.4, 0.55)
  else line(ctx, [x - rx * 0.5, y - 2.6, x - rx * 0.15, y - 3.6], '#ffffff', 1.2, 0.8)
}
function glasses(dark: boolean) {
  return (ctx: C, view: View) => {
    const frame = dark ? '#2a222c' : INK
    if (view === 'front') {
      lens(ctx, -11.5, 45.5, 6.8, dark)
      lens(ctx, 11.5, 45.5, 6.8, dark)
      line(ctx, [-4.7, 44.6, 0, 42.8, 4.7, 44.6], frame, 1.8)
      line(ctx, [-18.3, 44.6, -25.6, 43.6], frame, 1.6)
      line(ctx, [18.3, 44.6, 25.6, 43.6], frame, 1.6)
    } else if (view === 'side') {
      // 3/4: 가까운 렌즈는 크게, 먼 렌즈는 좁게 + 귀까지 이어지는 다리
      const { nearEye, farEye, eyeY } = FACE34
      line(ctx, [nearEye - 6.4, eyeY - 0.8, -14.6, eyeY - 0.4], frame, 2)
      lens(ctx, farEye, eyeY, 4.9, dark)
      lens(ctx, nearEye, eyeY, 6.9, dark)
      line(ctx, [nearEye + 6.7, eyeY - 0.9, (nearEye + farEye) / 2 + 1, eyeY - 2.6, farEye - 4.7, eyeY - 0.9], frame, 1.8)
    } else {
      // 뒤: 귀에 걸린 다리 끝만
      line(ctx, [-27.4, 44.4, -29.6, 46.6], frame, 1.8)
      line(ctx, [27.4, 44.4, 29.6, 46.6], frame, 1.8)
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

/** 몸에 다는 것: 3/4 뷰에서는 정면 그림을 몸통 변환에 맞춰 재사용 */
function onBody(ctx: C, view: View, fn: () => void): void {
  if (view === 'back') return
  if (view === 'side') quarter(ctx, fn)
  else fn()
}

export const ACCESSORIES: AccessoryDef[] = [
  { label: '없음', draw() {} },
  { label: '안경', draw: glasses(false) },
  { label: '선글라스', draw: glasses(true) },
  {
    label: '리본',
    draw(ctx, v, a) {
      if (v === 'front') bow(ctx, 17, 17.5, 7.6, 0.35, a)
      else if (v === 'back') bow(ctx, -17, 17.5, 7.6, -0.35, a)
      else bow(ctx, -9, 14, 7.6, -0.3, a)
    },
  },
  {
    label: '꽃핀',
    draw(ctx, v) {
      const leaf = (x: number, y: number, r: number) => flat(ctx, ellipse(x, y, 3.4, 1.9, r), LEAF)
      if (v === 'front') {
        leaf(-23.4, 30.4, 0.9)
        flower(ctx, -20, 27, 5.4, '#fff3ee')
      } else if (v === 'back') {
        leaf(23.4, 30.4, -0.9)
        flower(ctx, 20, 27, 5.4, '#fff3ee')
      } else {
        leaf(-13.6, 30.6, 0.9)
        flower(ctx, -10, 27.4, 5.4, '#fff3ee')
      }
    },
  },
  {
    label: '베레모',
    draw(ctx, v) {
      const c = '#b85662'
      const m = v === 'back' ? -1 : 1
      ctx.save()
      if (v === 'side') ctx.translate(-2.4, 0)
      line(ctx, [m * 4, 2.6, m * 6, -1.4], darken(c, 0.3), 2.2)
      shape(ctx, beretPath(m), c, [-20, 0, 20, 26])
      line(ctx, [m * -22, 20.4, m * -6, 17, m * 12, 19.6], darken(c, 0.3), 1.1, 0.4)
      ctx.restore()
    },
  },
  {
    label: '나비넥타이',
    draw(ctx, v, a) {
      onBody(ctx, v, () => bow(ctx, 0, 68.6, 5.2, 0, a))
    },
  },
  {
    label: '화관',
    draw(ctx, v) {
      const cols = ['#f6a6b4', '#fff3ee', '#f3c36a', '#fff3ee', '#f29a8a']
      const xs = v === 'side' ? [-24.5, -17, -9, -0.5, 8, 16, 22.6] : [-22.5, -15.5, -8, 0, 8, 15.5, 22.5]
      const cx = v === 'side' ? -1 : 0
      const yAt = (x: number) => 15.5 + ((x - cx) / 27) ** 2 * 13
      for (let i = 0; i < xs.length - 1; i++) {
        const mx = (xs[i] + xs[i + 1]) / 2
        flat(ctx, ellipse(mx, yAt(mx) + 0.6, 3, 1.8, 0.4), LEAF)
      }
      xs.forEach((x, i) => flower(ctx, x, yAt(x), 3.6, cols[i % cols.length]))
    },
  },
  {
    label: '코르사주',
    draw(ctx, v) {
      onBody(ctx, v, () => {
        flat(ctx, ellipse(10.6, 75, 3.2, 1.8, 0.7), LEAF)
        flat(ctx, ellipse(5.4, 75.4, 3, 1.7, -0.7), LEAF)
        flower(ctx, 7.8, 72, 4.2, '#f7a9b5')
      })
    },
  },
  {
    label: '진주 목걸이',
    draw(ctx, v) {
      if (v === 'back') {
        // 목 뒤로 지나가는 줄
        for (let i = -3; i <= 3; i++) shape(ctx, circle(i * 2.9, 67.6 - i * i * 0.46, 1.5), CREAM, [-1, 64, 1, 69], { rim: 0.7 })
        return
      }
      onBody(ctx, v, () => {
        for (let i = -3; i <= 3; i++) {
          const x = i * 2.9
          const y = 70.6 - i * i * 0.46
          shape(ctx, circle(x, y, 1.6), CREAM, [x - 1, y - 1, x + 1, y + 1], { rim: 0.75 })
        }
      })
    },
  },
]
