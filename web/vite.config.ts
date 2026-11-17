import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { wedding } from './src/config/wedding.ts'
import { buildIcs, weddingEvent } from './src/lib/ics.ts'

/**
 * 환경변수
 *  - VITE_BASE         : 서빙 하위 경로. GitHub Pages 프로젝트 페이지는 "/<repo>/", 도커/자체 도메인은 "/" (기본)
 *  - VITE_SITE_URL     : 배포된 서비스의 절대 URL (예: https://user.github.io/wedding-card/). OG 태그·공유 링크에 사용
 *  - VITE_API_URL      : API 주소. 비어 있으면 서버 없는 데모 빌드, "/" 면 같은 오리진(/api), 그 외엔 해당 서버
 *  - VITE_KAKAO_JS_KEY : (선택) 카카오 JavaScript 키 — 카카오내비 공식 길안내. 없으면 키 없이 동작하는 방식으로 대체
 */
const base = process.env.VITE_BASE ?? '/'
const siteUrl = (process.env.VITE_SITE_URL ?? '').replace(/\/?$/, '/').replace(/^\/$/, '')

/** 셸(index.html)의 범용 서비스 소개. 청첩장별 제목/미리보기는 서버가 /w/<slug> 응답에 넣어 준다 */
const SERVICE = {
  title: '픽셀 청첩장 — 하객이 캐릭터로 찾아오는 모바일 청첩장',
  description:
    '예식 안내, 오시는 길, 사진, 마음 전하실 곳을 한 장에 담고 하객은 픽셀 캐릭터로 축하 인사를 남기는 모바일 청첩장을 만들어 보세요.',
}
const API_TARGET = 'http://localhost:8787'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 스크레이퍼는 JS 를 실행하지 않으므로 서비스 소개 OG 태그를 빌드 시 index.html 에 정적으로 주입 */
function ogTags(): Plugin {
  return {
    name: 'service-og-tags',
    transformIndexHtml() {
      const { title, description } = SERVICE
      const meta = (attrs: Record<string, string>) => ({ tag: 'meta', attrs, injectTo: 'head' as const })
      const tags = [
        { tag: 'title', children: esc(title), injectTo: 'head' as const },
        meta({ name: 'description', content: description }),
        meta({ property: 'og:type', content: 'website' }),
        meta({ property: 'og:title', content: title }),
        meta({ property: 'og:description', content: description }),
        meta({ property: 'og:site_name', content: '픽셀 청첩장' }),
        meta({ property: 'og:locale', content: 'ko_KR' }),
        meta({ name: 'twitter:card', content: 'summary_large_image' }),
      ]
      if (siteUrl) {
        tags.push(
          meta({ property: 'og:url', content: siteUrl }),
          meta({ property: 'og:image', content: `${siteUrl}og.png` }),
          meta({ property: 'og:image:width', content: '800' }),
          meta({ property: 'og:image:height', content: '400' }),
        )
      }
      return tags
    },
  }
}

/**
 * 데모 청첩장(/w/demo)의 정적 wedding.ics 생성 — 서버 없는 배포에서도 일정 등록이 되도록.
 * (iOS/인앱 브라우저는 Blob 다운로드보다 실파일 이동이 안정적. 실제 청첩장은 서버의 /w/<slug>/wedding.ics 사용)
 */
function demoIcs(): Plugin {
  const ics = () => buildIcs(weddingEvent(wedding, siteUrl ? `${siteUrl}w/demo` : undefined))
  return {
    name: 'demo-ics',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'wedding.ics', source: ics() })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== `${base}wedding.ics`) return next()
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
        res.end(ics())
      })
    },
  }
}

/**
 * index.html 의 서비스 소개 메타 태그를 데모 청첩장의 것으로 바꾼다 (순수 문자열 치환).
 * pixel = 같은 데모의 "픽셀 청첩장" 모습(/w/demo/pixel) — 서버(pages.js)·프론트(lib/share.ts)와 같은 문구 규칙.
 */
function demoHtml(html: string, pixel = false): string {
  const title = pixel ? `${wedding.share.title} · 픽셀 청첩장` : wedding.share.title
  const description = pixel
    ? `캐릭터가 되어 축하를 남겨 주세요 · ${wedding.share.description}`
    : wedding.share.description
  const content = (attr: string, key: string, value: string) => (s: string) =>
    s.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), (_m, a: string, b: string) => `${a}${esc(value)}${b}`)
  const steps = [
    (s: string) => s.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`),
    content('name', 'description', description),
    content('property', 'og:title', title),
    content('property', 'og:description', description),
    ...(siteUrl ? [content('property', 'og:url', `${siteUrl}w/demo${pixel ? '/pixel' : ''}`)] : []),
  ]
  return steps.reduce((s, step) => step(s), html)
}

/**
 * GitHub Pages 용 SPA 폴백: 없는 경로(/new 등 딥링크)는 404.html 이 응답되므로,
 * index.html 과 똑같은 404.html 을 함께 내보내 라우터가 주소를 해석하게 한다.
 *
 * 다만 404.html 은 HTTP 404 로 응답되어 링크 미리보기(카카오톡 등)와 검색엔진이 무시한다.
 * 서버 없이 공유되는 유일한 청첩장인 데모(/w/demo, /w/demo/pixel)만큼은 실제 파일(w/demo/index.html 등)로 내보내
 * 200 으로 응답되게 하고, 미리보기 태그도 데모 청첩장의 것으로 바꾼다.
 * (도커 배포에서는 nginx 가 /w/ 를 api 로 넘기므로 이 파일은 쓰이지 않는다)
 */
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const index = resolve(outDir, 'index.html')
      if (!existsSync(index)) return
      copyFileSync(index, resolve(outDir, '404.html'))
      const demoDir = resolve(outDir, 'w/demo')
      mkdirSync(demoDir, { recursive: true })
      const shell = readFileSync(index, 'utf8')
      writeFileSync(resolve(demoDir, 'index.html'), demoHtml(shell))
      // 픽셀 청첩장 데모(/w/demo/pixel)도 공유되는 주소이므로 같은 방식으로 실제 파일을 둔다
      const pixelDir = resolve(demoDir, 'pixel')
      mkdirSync(pixelDir, { recursive: true })
      writeFileSync(resolve(pixelDir, 'index.html'), demoHtml(shell, true))
    },
  }
}

/**
 * 개발/미리보기 프록시. /w/<slug> HTML 은 프록시하지 않는다(Vite 가 SPA 셸을 서빙) —
 * 서버가 만들어 주는 캘린더 파일(/w/<slug>/wedding.ics)만 넘긴다.
 */
const apiProxy = {
  '/api': API_TARGET,
  '/uploads': API_TARGET,
  '^/w/[^/]+/wedding\\.ics$': API_TARGET,
}

export default defineConfig({
  base,
  plugins: [react(), ogTags(), demoIcs(), spaFallback()],
  server: { host: true, proxy: apiProxy },
  // `vite preview` (로컬 배포 확인용) 도 같은 프록시 사용
  preview: { host: true, proxy: apiProxy },
})
