/**
 * 공개 엔드포인트: 장소 검색 프록시(/api/geocode)와 서버 렌더링(/w/:slug, /w/:slug/wedding.ics).
 */
import { send, sendRaw, clientIp, requestOrigin } from './http.js'
import { GeocodeError } from './geocode.js'
import { renderPage, weddingMeta } from './pages.js'
import { weddingEvent, buildIcs } from './ics.js'
import { SLUG_PATTERN } from './wedding-config.js'
import { tooMany } from './auth.js'

/** @typedef {import('./app.js').Deps} Deps */
/** @typedef {import('node:http').IncomingMessage} Req */
/** @typedef {import('node:http').ServerResponse} Res */
/** @typedef {Record<string, string>} Cors */

/** 프론트에 번들된 데모 청첩장. 서버에는 데이터가 없고 프론트가 직접 그린다. */
const DEMO_SLUG = 'demo'

const QUERY_MIN = 2
const QUERY_MAX = 80

/** @param {Req} req @param {Res} res @param {Deps} deps @param {Cors} cors @param {URLSearchParams} query */
export async function handleGeocode(req, res, deps, cors, query) {
  const { config, geocoder, geocodeLimiter, log } = deps
  const q = (query.get('q') ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  const n = [...q].length
  if (n < QUERY_MIN) return send(res, 400, { error: `검색어를 ${QUERY_MIN}자 이상 입력해 주세요.` }, cors)
  if (n > QUERY_MAX) return send(res, 400, { error: `검색어는 ${QUERY_MAX}자 이하여야 합니다.` }, cors)

  if (!geocodeLimiter.take(clientIp(req, config.trustProxy))) return tooMany(res, cors)

  try {
    return send(res, 200, await geocoder.search(q), cors)
  } catch (err) {
    if (!(err instanceof GeocodeError)) throw err
    if (err.kind === 'busy') {
      return send(res, 503, { error: '장소 검색이 몰리고 있습니다. 잠시 후 다시 시도해 주세요.' }, { ...cors, 'Retry-After': '5' })
    }
    log(JSON.stringify({ t: new Date().toISOString(), level: 'warn', msg: err.message }))
    return send(res, 502, { error: '장소 검색 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, cors)
  }
}

/** HTML 페이지는 nginx 의 정적 페이지와 같은 프레임/리퍼러 정책을 쓴다. */
const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

/**
 * GET /w/:slug , /w/:slug/edit , /w/:slug/wedding.ics
 * @param {Req} req @param {Res} res @param {Deps} deps @param {Cors} cors
 * @param {string | null} slug @param {string[]} rest slug 뒤의 경로 조각
 */
export async function handlePage(req, res, deps, cors, slug, rest) {
  const { config, db, templates } = deps
  const wedding = slug !== null && SLUG_PATTERN.test(slug) ? db.getWedding(slug) : null
  const origin = requestOrigin(req, config)
  const at = rest.join('/')

  if (at === 'wedding.ics') {
    if (!wedding) return send(res, 404, { error: '청첩장을 찾을 수 없습니다.' }, cors)
    const ics = buildIcs(weddingEvent(wedding.config, origin ? `${origin}/w/${wedding.slug}` : undefined))
    return sendRaw(res, 200, ics, {
      ...cors,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="wedding.ics"',
      'Cache-Control': 'no-cache',
    })
  }

  const template = await templates.get()
  if (template === null) {
    return sendRaw(
      res,
      503,
      '<!doctype html><html lang="ko"><meta charset="utf-8"><title>잠시 후 다시 시도해 주세요</title>' +
        '<p>페이지를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.</p></html>',
      { ...PAGE_HEADERS, 'Cache-Control': 'no-store', 'Retry-After': '5' },
    )
  }

  const isView = at === '' || at === 'edit'
  if (wedding && isView) {
    // 초대받은 사람만 보는 페이지이므로 검색엔진에는 색인하지 않도록 알린다(미리보기 스크레이퍼와는 무관).
    return sendRaw(res, 200, renderPage(template, weddingMeta(wedding, origin), { noindex: true }), PAGE_HEADERS)
  }
  // 데모는 프론트에 번들되어 있어 서버 데이터 없이도 정상 페이지다(템플릿의 범용 태그 그대로).
  if (slug === DEMO_SLUG && isView) return sendRaw(res, 200, template, PAGE_HEADERS)

  // 없는 청첩장: 프론트가 "찾을 수 없음" 화면을 그릴 수 있게 SPA 셸은 주되 상태는 404.
  return sendRaw(res, 404, renderPage(template, null, { noindex: true }), PAGE_HEADERS)
}
