/**
 * "3D 모험가" 그림체의 조합 계산 — DOM 없이 픽셀 배열만 다룬다 (테스트와 art/kaykit 의 미리보기 스크립트가 같이 쓴다).
 *
 * 아틀라스에는 3D 모델을 조각(몸·머리·모자·손에 든 물건)별로 따로 구운 그림이 들어 있다.
 *  - 색 그림(atlas): 피부·머리카락·옷감은 "중립 회색에 음영만" 입혀 구웠다 → 고른 색을 곱해 칠한다.
 *  - 마스크(mask): 픽셀마다 R = 피부, G = 머리카락, B = 옷감이 차지하는 비율.
 *  - 액세서리 조각은 두 장: under(몸·머리 뒤로 가려지는 부분, 먼저 그린다) / over(앞에 보이는 부분, 맨 나중에 그린다).
 * 그리는 순서: 액세서리 under → 몸 → 머리 → 액세서리 over.
 */
import type { KayKitAtlas, KayKitLook } from './assets/atlas'

/** 디코딩한 그림의 RGBA 픽셀 (곱하지 않은 알파) */
export interface Pixels {
  data: ArrayLike<number>
  width: number
}

/** 띠 한 칸의 숫자 개수: [아틀라스 x, y, 너비, 높이, 칸 안 x, 칸 안 y] */
export const CELL_FIELDS = 6

function clampIndex(v: number, n: number): number {
  const i = Number.isFinite(v) ? Math.round(v) : 0
  return i < 0 ? 0 : i > n - 1 ? n - 1 : i
}

/** 번호를 각 목록의 범위 안으로 자른다 (액세서리는 0 = 없음) */
export function clampLook(atlas: KayKitAtlas, a: KayKitLook): KayKitLook {
  return {
    skin: clampIndex(a?.skin, atlas.skins.length),
    hairStyle: clampIndex(a?.hairStyle, atlas.heads.length),
    hairColor: clampIndex(a?.hairColor, atlas.hairColors.length),
    outfit: clampIndex(a?.outfit, atlas.outfits.length),
    outfitColor: clampIndex(a?.outfitColor, atlas.outfitColors.length),
    accessory: clampIndex(a?.accessory, atlas.accs.length + 1),
  }
}

/** 이 외형을 그릴 때 겹치는 띠 번호 (아래 → 위) */
export function drawOrder(atlas: KayKitAtlas, look: KayKitLook): number[] {
  const a = clampLook(atlas, look)
  const pieces = a.accessory > 0 ? atlas.accs[a.accessory - 1].pieces : []
  const order: number[] = []
  for (const [under] of pieces) if (under >= 0) order.push(under)
  order.push(atlas.outfits[a.outfit].strip, atlas.heads[a.hairStyle].strip)
  for (const [, over] of pieces) if (over >= 0) order.push(over)
  return order
}

/** 실제로 칠해지는 옷 색 (0xRRGGBB): "기본"(-1)이면 그 의상의 원래 색 */
export function outfitRgb(atlas: KayKitAtlas, look: KayKitLook): number {
  const a = clampLook(atlas, look)
  const rgb = atlas.outfitColors[a.outfitColor].rgb
  return rgb < 0 ? atlas.outfits[a.outfit].base : rgb
}

/**
 * 색 곱셈 계수 9개: [피부 r g b, 머리 r g b, 옷 r g b] — 중립 밝기를 1 로 본 배율.
 * 마스크 비율 w 인 픽셀의 채널 값은 c * (1 + w * (계수 - 1)) 이 된다.
 */
export function tintFactors(atlas: KayKitAtlas, look: KayKitLook): Float32Array {
  const a = clampLook(atlas, look)
  const rgbs = [atlas.skins[a.skin].rgb, atlas.hairColors[a.hairColor].rgb, outfitRgb(atlas, a)]
  const out = new Float32Array(9)
  rgbs.forEach((rgb, i) => {
    out[i * 3] = ((rgb >> 16) & 255) / atlas.neutral
    out[i * 3 + 1] = ((rgb >> 8) & 255) / atlas.neutral
    out[i * 3 + 2] = (rgb & 255) / atlas.neutral
  })
  return out
}

/** 압축 잡음으로 생긴 아주 작은 마스크 값은 0 으로 본다 */
const MASK_FLOOR = 10

/**
 * 한 프레임을 조합한다 → atlas.w x atlas.h 의 RGBA (곱하지 않은 알파).
 * dirIndex = atlas.dirs 의 순서, frame = 0(정지) · 1 · 2(걷기).
 */
export function compose(atlas: KayKitAtlas, color: Pixels, mask: Pixels, look: KayKitLook, dirIndex: number, frame: number): Uint8ClampedArray {
  const W = atlas.w
  const H = atlas.h
  // 곱해진 알파로 쌓는다
  const acc = new Float32Array(W * H * 4)
  const tint = tintFactors(atlas, look)
  const cell = (clampIndex(dirIndex, atlas.dirs.length) * atlas.frames + clampIndex(frame, atlas.frames)) * CELL_FIELDS
  const src = color.data
  const msk = mask.data
  for (const stripNo of drawOrder(atlas, look)) {
    const strip = atlas.strips[stripNo]
    const sw = strip[cell + 2]
    const sh = strip[cell + 3]
    if (!sw || !sh) continue
    const sx = strip[cell]
    const sy = strip[cell + 1]
    const ox = strip[cell + 4]
    const oy = strip[cell + 5]
    for (let j = 0; j < sh; j++) {
      let s = ((sy + j) * color.width + sx) * 4
      let m = ((sy + j) * mask.width + sx) * 4
      let d = ((oy + j) * W + ox) * 4
      for (let i = 0; i < sw; i++, s += 4, m += 4, d += 4) {
        const sa = src[s + 3]
        if (sa === 0) continue
        let r = src[s]
        let g = src[s + 1]
        let b = src[s + 2]
        const ws = msk[m]
        const wh = msk[m + 1]
        const wo = msk[m + 2]
        if (ws >= MASK_FLOOR || wh >= MASK_FLOOR || wo >= MASK_FLOOR) {
          const fs = ws >= MASK_FLOOR ? ws / 255 : 0
          const fh = wh >= MASK_FLOOR ? wh / 255 : 0
          const fo = wo >= MASK_FLOOR ? wo / 255 : 0
          r *= 1 + fs * (tint[0] - 1) + fh * (tint[3] - 1) + fo * (tint[6] - 1)
          g *= 1 + fs * (tint[1] - 1) + fh * (tint[4] - 1) + fo * (tint[7] - 1)
          b *= 1 + fs * (tint[2] - 1) + fh * (tint[5] - 1) + fo * (tint[8] - 1)
          if (r > 255) r = 255
          if (g > 255) g = 255
          if (b > 255) b = 255
        }
        const fa = sa / 255
        const keep = 1 - fa
        acc[d] = r * fa + acc[d] * keep
        acc[d + 1] = g * fa + acc[d + 1] * keep
        acc[d + 2] = b * fa + acc[d + 2] * keep
        acc[d + 3] = fa + acc[d + 3] * keep
      }
    }
  }
  const out = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < acc.length; i += 4) {
    const a = acc[i + 3]
    if (a <= 0) continue
    out[i] = acc[i] / a
    out[i + 1] = acc[i + 1] / a
    out[i + 2] = acc[i + 2] / a
    out[i + 3] = a * 255
  }
  return out
}
