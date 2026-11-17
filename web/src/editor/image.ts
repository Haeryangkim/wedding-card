/**
 * 사진을 올리기 전에 브라우저에서 줄이고 압축한다.
 * 크기 계산·시도 순서는 순수 함수(테스트 대상)이고, 실제 디코딩/인코딩만 DOM 을 쓴다.
 */
import { PLATFORM_LIMITS } from '../platform/contract'

export const PHOTO_MAX_EDGE = 1600
/** 서버 상한(2MB)보다 여유 있게 잡는 목표 크기 */
export const PHOTO_TARGET_BYTES = Math.floor(PLATFORM_LIMITS.photoBytes * 0.9)

export interface Size {
  width: number
  height: number
}

/** 긴 변이 maxEdge 를 넘지 않도록 비율을 유지해 줄인 크기. 키우지는 않는다 */
export function computeTargetSize(width: number, height: number, maxEdge: number = PHOTO_MAX_EDGE): Size {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 }
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export interface EncodeStep {
  maxEdge: number
  quality: number
}

/** 목표 크기 안에 들어올 때까지 차례로 시도할 (긴 변, JPEG 품질) 목록 — 화질을 먼저, 그다음 크기를 낮춘다 */
export function encodePlan(maxEdge: number = PHOTO_MAX_EDGE): EncodeStep[] {
  const steps: EncodeStep[] = []
  for (const scale of [1, 0.8, 0.64, 0.5]) {
    for (const quality of [0.86, 0.76, 0.64]) {
      steps.push({ maxEdge: Math.round(maxEdge * scale), quality })
    }
  }
  return steps
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}

// ── 여기부터 브라우저 전용 ───────────────────────────────────

interface Decoded {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      // EXIF 회전을 반영해 디코딩 (세로로 찍은 사진이 눕지 않도록)
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      // 옵션을 지원하지 않거나 디코딩 실패 → <img> 로 다시 시도 (요즘 브라우저는 <img> 도 EXIF 를 반영)
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode'))
      img.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} }
  } finally {
    // 디코딩이 끝난 뒤에는 주소가 없어도 그릴 수 있다
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * 사진 파일 → 긴 변 1600px 이하, 서버 상한 이하의 JPEG Blob.
 * 실패하면 사용자에게 그대로 보여 줄 수 있는 한국어 메시지의 Error 를 던진다.
 */
export async function prepareImage(file: Blob): Promise<Blob> {
  let decoded: Decoded
  try {
    decoded = await decode(file)
  } catch {
    throw new Error('이 사진은 열 수 없어요. JPG·PNG·WebP 사진으로 다시 시도해 주세요.')
  }
  try {
    if (!decoded.width || !decoded.height) throw new Error('이 사진은 열 수 없어요.')
    // 작은 사진도 항상 다시 인코딩한다: 원본에 들어 있는 위치 정보(EXIF GPS) 등이 함께 올라가지 않도록.
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('이 기기에서는 사진을 줄일 수 없어요. 다른 브라우저로 시도해 주세요.')
    let drawnEdge = -1
    for (const step of encodePlan()) {
      if (step.maxEdge !== drawnEdge) {
        const size = computeTargetSize(decoded.width, decoded.height, step.maxEdge)
        canvas.width = size.width
        canvas.height = size.height
        // JPEG 에는 투명도가 없으므로 흰 바탕을 깐다
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, size.width, size.height)
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(decoded.source, 0, 0, size.width, size.height)
        drawnEdge = step.maxEdge
      }
      const blob = await toBlob(canvas, step.quality)
      if (blob && blob.type === 'image/jpeg' && blob.size <= PHOTO_TARGET_BYTES) {
        canvas.width = canvas.height = 0 // 메모리 반환
        return blob
      }
    }
    throw new Error('사진을 충분히 줄이지 못했어요. 다른 사진으로 시도해 주세요.')
  } finally {
    decoded.close()
  }
}
