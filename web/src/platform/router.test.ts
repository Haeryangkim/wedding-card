import { describe, expect, it } from 'vitest'
import { matchRoute } from './router'

describe('matchRoute', () => {
  it('서비스 화면', () => {
    expect(matchRoute('/')).toEqual({ name: 'landing' })
    expect(matchRoute('/new')).toEqual({ name: 'new' })
    expect(matchRoute('/nope')).toEqual({ name: 'notfound' })
  })
  it('청첩장 · 관리 · 픽셀 청첩장', () => {
    expect(matchRoute('/w/kim-park')).toEqual({ name: 'wedding', slug: 'kim-park' })
    expect(matchRoute('/w/kim-park/')).toEqual({ name: 'wedding', slug: 'kim-park' })
    expect(matchRoute('/w/kim-park/edit')).toEqual({ name: 'edit', slug: 'kim-park' })
    expect(matchRoute('/w/kim-park/pixel')).toEqual({ name: 'pixel', slug: 'kim-park' })
    expect(matchRoute('/w/demo/pixel/')).toEqual({ name: 'pixel', slug: 'demo' })
  })
  it('그 밖의 하위 경로는 없는 화면', () => {
    expect(matchRoute('/w/kim-park/pixels')).toEqual({ name: 'notfound' })
    expect(matchRoute('/w/kim-park/pixel/extra')).toEqual({ name: 'notfound' })
    expect(matchRoute('/w/Bad_Slug/pixel')).toEqual({ name: 'notfound' })
  })
})
