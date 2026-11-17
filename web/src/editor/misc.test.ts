import { describe, expect, it } from 'vitest'
import { PLATFORM_LIMITS } from '../platform/contract'
import { errorStatus, errorText, isUnauthorized } from './errors'
import { computeTargetSize, encodePlan, formatBytes, PHOTO_MAX_EDGE, PHOTO_TARGET_BYTES } from './image'
import { osmEmbedUrl, parseCoords } from './map'

describe('computeTargetSize', () => {
  it('긴 변을 1600 이하로, 비율 유지', () => {
    expect(computeTargetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(computeTargetSize(3000, 4000)).toEqual({ width: 1200, height: 1600 })
    expect(computeTargetSize(6000, 1000, 1600)).toEqual({ width: 1600, height: 267 })
  })
  it('작은 사진은 키우지 않는다', () => {
    expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600 })
    expect(computeTargetSize(1600, 1600)).toEqual({ width: 1600, height: 1600 })
  })
  it('극단적인 비율에서도 최소 1px, 잘못된 크기는 0', () => {
    expect(computeTargetSize(10000, 2, 100)).toEqual({ width: 100, height: 1 })
    expect(computeTargetSize(0, 100)).toEqual({ width: 0, height: 0 })
    expect(computeTargetSize(NaN, 100)).toEqual({ width: 0, height: 0 })
  })
})

describe('encodePlan', () => {
  it('1600px 고화질에서 시작해 화질 → 크기 순으로 낮춘다', () => {
    const plan = encodePlan()
    expect(plan[0]).toEqual({ maxEdge: PHOTO_MAX_EDGE, quality: 0.86 })
    for (let i = 1; i < plan.length; i++) {
      const [a, b] = [plan[i - 1], plan[i]]
      expect(b.maxEdge < a.maxEdge || (b.maxEdge === a.maxEdge && b.quality < a.quality)).toBe(true)
    }
    expect(plan.at(-1)!.maxEdge).toBe(800)
  })
  it('목표 크기는 서버 상한보다 작다', () => {
    expect(PHOTO_TARGET_BYTES).toBeLessThan(PLATFORM_LIMITS.photoBytes)
  })
  it('formatBytes', () => {
    expect(formatBytes(500)).toBe('1KB')
    expect(formatBytes(350 * 1024)).toBe('350KB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5MB')
  })
})

describe('errors', () => {
  it('status 속성을 우선 사용', () => {
    expect(errorStatus(Object.assign(new Error('x'), { status: 409 }))).toBe(409)
    expect(isUnauthorized(Object.assign(new Error('x'), { status: 401 }))).toBe(true)
  })
  it('status 가 없으면 서버의 한국어 메시지로 추정', () => {
    expect(errorStatus(new Error('관리 권한이 없습니다. 관리 비밀번호로 다시 로그인해 주세요.'))).toBe(401)
    expect(errorStatus(new Error('관리 비밀번호가 일치하지 않습니다.'))).toBe(403)
    expect(errorStatus(new Error('요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'))).toBe(429)
    expect(errorStatus(new Error('이미 사용 중인 주소입니다.'))).toBe(409)
    expect(errorStatus(new Error('청첩장을 찾을 수 없습니다.'))).toBe(404)
    expect(errorStatus(new Error('무언가'))).toBeNull()
    expect(errorStatus(null)).toBeNull()
  })
  it('errorText: 한국어 서버 메시지는 그대로, 영어 예외는 기본 문구로', () => {
    expect(errorText(new Error('사진이 너무 큽니다. (장당 최대 2MB)'))).toBe('사진이 너무 큽니다. (장당 최대 2MB)')
    expect(errorText(new TypeError('Failed to fetch'))).toMatch(/연결하지 못했어요/)
    expect(errorText(new Error('Unexpected token < in JSON'), '기본')).toBe('기본')
    expect(errorText(undefined, '기본')).toBe('기본')
    expect(errorText(Object.assign(new Error('x'), { status: 429 }))).toMatch(/너무 잦아요/)
  })
})

describe('map', () => {
  it('osmEmbedUrl: 마커와 bbox(서,남,동,북)', () => {
    const url = osmEmbedUrl(37.5662952, 126.9779451)!
    expect(url).toContain('marker=37.566295%2C126.977945')
    const bbox = decodeURIComponent(/bbox=([^&]+)/.exec(url)![1]).split(',').map(Number)
    expect(bbox[0]).toBeLessThan(126.9779451)
    expect(bbox[2]).toBeGreaterThan(126.9779451)
    expect(bbox[1]).toBeLessThan(37.5662952)
    expect(bbox[3]).toBeGreaterThan(37.5662952)
  })
  it('잘못된 좌표는 null', () => {
    expect(osmEmbedUrl(NaN, 1)).toBeNull()
    expect(osmEmbedUrl(91, 1)).toBeNull()
    expect(parseCoords('', '1')).toBeNull()
    expect(parseCoords('abc', '1')).toBeNull()
    expect(parseCoords('37.5', '181')).toBeNull()
    expect(parseCoords(' 37.5 ', '127')).toEqual({ lat: 37.5, lng: 127 })
  })
})
