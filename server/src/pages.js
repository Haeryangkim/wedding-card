/**
 * 링크 미리보기(카카오톡 등)용 서버 렌더링.
 * 스크레이퍼는 JS 를 실행하지 않으므로 /w/:slug 요청에 프론트 index.html 을 가져와
 * 그 청첩장의 <title> · description · og:* · twitter:* 태그를 넣어 돌려준다.
 *
 * 템플릿(index.html) 출처: INDEX_HTML_PATH(파일) 또는 INDEX_HTML_URL(기본 http://web/index.html).
 * 처음 필요할 때 가져오고 잠깐(기본 60초) 캐시하며, 갱신에 실패하면 예전 사본을 계속 쓴다.
 */
import { readFile } from 'node:fs/promises'

/** @param {string} s */
export function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * @param {{ indexHtmlPath: string | null, indexHtmlUrl: string, indexHtmlTtlMs: number }} config
 * @param {(line: string) => void} log
 */
export function createTemplateSource(config, log) {
  /** @type {string | null} */
  let cached = null
  let fetchedAt = 0
  /** @type {Promise<string | null> | null} */
  let inflight = null

  async function load() {
    if (config.indexHtmlPath) return readFile(config.indexHtmlPath, 'utf8')
    const res = await fetch(config.indexHtmlUrl, { signal: AbortSignal.timeout(3000), redirect: 'error' })
    if (!res.ok) {
      await res.body?.cancel().catch(() => {})
      throw new Error(`status ${res.status}`)
    }
    const html = await res.text()
    if (!/<\/head>/i.test(html)) throw new Error('not an html document')
    return html
  }

  return {
    /** @returns {Promise<string | null>} 한 번도 가져오지 못했으면 null */
    async get() {
      if (cached !== null && Date.now() - fetchedAt < config.indexHtmlTtlMs) return cached
      if (!inflight) {
        inflight = load()
          .then((html) => {
            cached = html
            fetchedAt = Date.now()
            return cached
          })
          .catch((err) => {
            log(
              JSON.stringify({
                t: new Date().toISOString(),
                level: 'warn',
                msg: `index.html template unavailable: ${String(err?.message ?? err)}`,
                stale: cached !== null,
              }),
            )
            // 실패해도 잠깐은 다시 시도하지 않는다(예전 사본이 있으면 그것을 쓴다).
            if (cached !== null) fetchedAt = Date.now() - config.indexHtmlTtlMs + Math.min(5000, config.indexHtmlTtlMs)
            return cached
          })
          .finally(() => {
            inflight = null
          })
      }
      return inflight
    },
  }
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "2027년 5월 15일 토요일 오후 12시 30분" (KST) @param {string} iso */
export function formatKoreanDate(iso) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const k = new Date(t + 9 * 60 * 60 * 1000)
  const h = k.getUTCHours()
  const min = k.getUTCMinutes()
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return (
    `${k.getUTCFullYear()}년 ${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${WEEKDAYS[k.getUTCDay()]}요일 ` +
    `${ampm} ${h12}시${min ? ` ${min}분` : ''}`
  )
}

/**
 * 청첩장 → 미리보기 메타 정보.
 * @param {import('./db.js').WeddingRecord} wedding
 * @param {string} origin 끝에 슬래시 없는 오리진 ('' 이면 상대 경로로 남는다)
 */
export function weddingMeta(wedding, origin) {
  const c = wedding.config
  const title = c.share?.title || `${c.groom.name} ♥ ${c.bride.name} 결혼합니다`
  const description =
    c.share?.description || [formatKoreanDate(c.datetime), c.venue?.name].filter(Boolean).join(' · ')
  const cover = typeof c.coverImage === 'string' && c.coverImage.startsWith('/uploads/') ? c.coverImage : null
  return {
    title,
    description,
    url: `${origin}/w/${wedding.slug}`,
    image: `${origin}${cover ?? '/og.png'}`,
    /** 기본 이미지(og.png)일 때만 크기를 안다 */
    imageSize: cover ? null : { width: 800, height: 400 },
  }
}

// 템플릿에 이미 들어 있는(빌드 시 주입된) 범용 태그 — 청첩장 태그로 "교체" 하기 위해 먼저 지운다.
// 실제 빌드 결과에는 `<!-- <title> · description · og:* 태그는 … -->` 같은 주석이 남아 있다. 주석 안의 글자를
// 태그로 착각하면 주석 끝(-->)과 그 사이의 <script>/<link> 까지 지워 버리므로, 모든 패턴은 "주석 | 태그" 로
// 한 번에 훑으면서 주석은 그대로 통과시킨다.
/** @param {string} source 지울 태그의 정규식 조각 */
const outsideComments = (source) => new RegExp(`<!--[\\s\\S]*?-->|${source}`, 'gi')
/** @param {string} names 정규식 조각 */
const metaSrc = (names) =>
  `[ \\t]*<meta\\b[^>]*\\b(?:name|property)\\s*=\\s*["']?(?:${names})["']?(?=[\\s/>])[^>]*>[ \\t]*\\r?\\n?`
const STRIP_ROBOTS = outsideComments(metaSrc('robots'))
const STRIP = [
  // 제목 안에는 다른 태그가 올 수 없다 → [^<]* 로 두어 여러 태그에 걸쳐 지우는 일이 없게 한다.
  outsideComments('[ \\t]*<title\\b[^>]*>[^<]*<\\/title>[ \\t]*\\r?\\n?'),
  outsideComments(metaSrc('description|og:[\\w:.-]+|twitter:[\\w:.-]+')),
  outsideComments('[ \\t]*<link\\b[^>]*\\brel\\s*=\\s*["\']?canonical["\']?(?=[\\s/>])[^>]*>[ \\t]*\\r?\\n?'),
]
/** 주석은 그대로 두고 태그만 지운다. @param {string} html @param {RegExp} re outsideComments() 로 만든 패턴 */
const strip = (html, re) => html.replace(re, (m) => (m.startsWith('<!--') ? m : ''))

/**
 * 템플릿의 범용 <title>/메타 태그를 지우고 주어진 태그를 </head> 앞에 넣는다.
 * @param {string} template
 * @param {ReturnType<typeof weddingMeta> | null} meta null 이면 템플릿의 범용 태그를 그대로 둔다
 * @param {{ noindex?: boolean }} [opts]
 */
export function renderPage(template, meta, opts = {}) {
  /** @type {string[]} */
  const tags = []
  let html = template
  if (meta) {
    for (const re of STRIP) html = strip(html, re)
    const e = escapeHtml
    tags.push(
      `<title>${e(meta.title)}</title>`,
      `<meta name="description" content="${e(meta.description)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${e(meta.title)}">`,
      `<meta property="og:description" content="${e(meta.description)}">`,
      `<meta property="og:locale" content="ko_KR">`,
      `<meta property="og:url" content="${e(meta.url)}">`,
      `<meta property="og:image" content="${e(meta.image)}">`,
    )
    if (meta.imageSize) {
      tags.push(
        `<meta property="og:image:width" content="${meta.imageSize.width}">`,
        `<meta property="og:image:height" content="${meta.imageSize.height}">`,
      )
    }
    tags.push(
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${e(meta.title)}">`,
      `<meta name="twitter:description" content="${e(meta.description)}">`,
      `<meta name="twitter:image" content="${e(meta.image)}">`,
    )
  }
  if (opts.noindex) {
    html = strip(html, STRIP_ROBOTS)
    tags.push(`<meta name="robots" content="noindex, nofollow">`)
  }
  if (tags.length === 0) return html

  const block = tags.map((t) => `    ${t}\n`).join('')
  const i = html.search(/[ \t]*<\/head>/i)
  // </head> 가 없는 이상한 템플릿이면 맨 앞에 둔다(태그는 여전히 문서 앞부분에서 발견된다).
  return i >= 0 ? html.slice(0, i) + block + html.slice(i) : block + html
}
