import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { wedding } from './src/config/wedding.ts'
import { buildIcs, weddingEvent } from './src/lib/ics.ts'

/**
 * 환경변수
 *  - VITE_BASE     : 서빙 하위 경로. GitHub Pages 프로젝트 페이지는 "/<repo>/", 도커/자체 도메인은 "/" (기본)
 *  - VITE_SITE_URL : 배포된 청첩장의 절대 URL (예: https://user.github.io/wedding-card/). OG 태그·캘린더 링크에 사용
 *  - VITE_API_URL  : 방명록 API 주소. 비어 있으면 로컬 데모 모드, "/" 면 같은 오리진(/api), 그 외엔 해당 서버
 */
const base = process.env.VITE_BASE ?? '/'
const siteUrl = (process.env.VITE_SITE_URL ?? '').replace(/\/?$/, '/').replace(/^\/$/, '')

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 카카오톡 등 스크레이퍼는 JS 를 실행하지 않으므로 OG 태그를 빌드 시 index.html 에 정적으로 주입 */
function ogTags(): Plugin {
  return {
    name: 'wedding-og-tags',
    transformIndexHtml() {
      const { title, description } = wedding.share
      const meta = (attrs: Record<string, string>) => ({ tag: 'meta', attrs, injectTo: 'head' as const })
      const tags = [
        { tag: 'title', children: esc(title), injectTo: 'head' as const },
        meta({ name: 'description', content: description }),
        meta({ property: 'og:type', content: 'website' }),
        meta({ property: 'og:title', content: title }),
        meta({ property: 'og:description', content: description }),
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

/** 실제 정적 파일로 서빙되는 wedding.ics 생성 (iOS/인앱 브라우저는 Blob 다운로드보다 실파일 이동이 안정적) */
function weddingIcs(): Plugin {
  const ics = () => buildIcs(weddingEvent(wedding, siteUrl || undefined))
  return {
    name: 'wedding-ics',
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

const apiProxy = { '/api': 'http://localhost:8787' }

export default defineConfig({
  base,
  plugins: [react(), ogTags(), weddingIcs()],
  server: { host: true, proxy: apiProxy },
  // `vite preview` (로컬 배포 확인용) 도 같은 프록시 사용
  preview: { host: true, proxy: apiProxy },
})
