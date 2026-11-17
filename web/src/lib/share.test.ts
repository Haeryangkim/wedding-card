import { describe, it, expect } from 'vitest'
import { shareText, weddingUrlFor } from './share'
import { wedding } from '../config/wedding'

describe('weddingUrlFor', () => {
  it('VITE_SITE_URL 이 있으면 그 아래 /w/<slug>', () => {
    expect(weddingUrlFor('demo', 'https://user.github.io/wedding-card/', 'https://x', '/')).toBe(
      'https://user.github.io/wedding-card/w/demo',
    )
    expect(weddingUrlFor('abc', 'https://our.site', 'https://x', '/')).toBe('https://our.site/w/abc')
  })
  it('없으면 현재 오리진 + base 경로', () => {
    expect(weddingUrlFor('abc', '', 'https://our.site', '/')).toBe('https://our.site/w/abc')
    expect(weddingUrlFor('abc', '', 'https://u.github.io', '/wedding-card/')).toBe(
      'https://u.github.io/wedding-card/w/abc',
    )
  })
})

describe('shareText', () => {
  it('설정된 문구를 그대로 쓴다', () => {
    expect(shareText(wedding)).toEqual(wedding.share)
  })
  it('비어 있으면 이름·일시·장소로 만든다', () => {
    const t = shareText({ ...wedding, share: { title: ' ', description: '' } })
    expect(t.title).toBe('김신랑 ♥ 박신부 결혼합니다')
    expect(t.description).toContain('2027년 5월 15일')
    expect(t.description).toContain('예시웨딩홀')
  })
})

describe('pixelShareText', () => {
  it('픽셀 청첩장 링크는 제목·설명으로 구분된다', async () => {
    const { pixelShareText } = await import('./share')
    const t = pixelShareText(wedding)
    expect(t.title).toBe(`${wedding.share.title} · 픽셀 청첩장`)
    expect(t.description).toBe(`캐릭터가 되어 축하를 남겨 주세요 · ${wedding.share.description}`)
  })
})
