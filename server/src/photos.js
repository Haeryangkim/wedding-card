/**
 * 사진 업로드/삭제/서빙.
 *  - 업로드: 본문 = 이미지 바이트. 스트리밍 중 크기 상한 검사, 헤더가 아니라 매직 바이트로 형식 확인,
 *    파일 이름은 서버가 만든 무작위 32 hex + 확장자 → <UPLOAD_DIR>/<slug>/<file>
 *  - 상한: 청첩장당 장수(409), 서비스 전체 바이트(507). 저장된 내용이 쓰지 않는 오래된 업로드는 자동 정리
 *  - 서빙: slug·파일 이름을 엄격한 정규식으로 대조하고 DB 에 등록된 파일만 내보낸다(경로 탈출 불가)
 */
import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, writeFile, unlink, stat, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { send, readBytes, clientIp, securityHeaders } from './http.js'
import { SLUG_PATTERN, PHOTO_FILE_RE, PLATFORM_LIMITS } from './wedding-config.js'
import { isOwner, unauthorized, tooMany } from './auth.js'

/** @typedef {import('./app.js').Deps} Deps */
/** @typedef {import('node:http').IncomingMessage} Req */
/** @typedef {import('node:http').ServerResponse} Res */
/** @typedef {Record<string, string>} Cors */

/** @type {Record<string, string>} Content-Type → 확장자 */
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
/** @type {Record<string, string>} 확장자 → Content-Type */
const TYPE_BY_EXT = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * 매직 바이트로 이미지 형식을 판별한다.
 * @param {Buffer} buf
 * @returns {'image/jpeg' | 'image/png' | 'image/webp' | null}
 */
export function sniffImage(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG)) return 'image/png'
  if (
    buf.length >= 12 &&
    buf.toString('latin1', 0, 4) === 'RIFF' &&
    buf.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

/**
 * 저장된 내용(coverImage/gallery)이 참조하지 않고 유예 시간보다 오래된 사진을 지운다.
 * 파일 이름은 업로드 응답에서만 알려 주므로, 내용에 저장되지 않은 업로드(편집 중 탭 닫기, 저장 실패,
 * 갤러리에서 뺀 뒤 삭제 요청 누락 등)는 주인도 찾아 지울 수 없다 → 서버가 정리해 사진 수 상한을 돌려준다.
 * 행 삭제는 동기적으로 끝나고(호출 직후 photoCount 에 반영), 파일 삭제만 돌려주는 Promise 에서 진행된다.
 * @param {Deps} deps @param {string} slug
 * @param {any} savedConfig 현재 저장된 청첩장 내용
 * @returns {Promise<number>} 지운 사진 수
 */
export function sweepOrphanPhotos(deps, slug, savedConfig) {
  const { config, db } = deps
  const prefix = `/uploads/${slug}/`
  /** @type {Set<string>} */
  const used = new Set()
  for (const ref of [savedConfig?.coverImage, ...(Array.isArray(savedConfig?.gallery) ? savedConfig.gallery : [])]) {
    if (typeof ref === 'string' && ref.startsWith(prefix)) used.add(ref.slice(prefix.length))
  }
  // 유예: 다른 탭에서 편집 중(올렸지만 아직 저장 전)인 사진은 건드리지 않는다.
  const orphans = db.listStalePhotos(slug, Date.now() - config.photoOrphanGraceMs).filter((f) => !used.has(f))
  for (const file of orphans) db.deletePhoto(slug, file)
  return Promise.all(orphans.map((file) => unlink(join(config.uploadDir, slug, file)).catch(() => {}))).then(
    () => orphans.length,
  )
}

/**
 * 사진 수 상한에 닿았는지 확인한다. 닿았으면 먼저 주인 없는 오래된 업로드를 정리하고 다시 센다.
 * (동기 — 파일 삭제는 뒤에서 진행된다)
 * @param {Deps} deps @param {string} slug
 */
function photosFull(deps, slug) {
  const { config, db } = deps
  if (db.photoCount(slug) < config.maxPhotosPerWedding) return false
  const wedding = db.getWedding(slug)
  if (wedding) void sweepOrphanPhotos(deps, slug, wedding.config)
  return db.photoCount(slug) >= config.maxPhotosPerWedding
}

/** @param {Req} req @param {Res} res @param {Deps} deps @param {Cors} cors @param {string} slug */
export async function handleUploadPhoto(req, res, deps, cors, slug) {
  const { config, db, photoLimiter } = deps
  if (!isOwner(req, deps, slug)) return unauthorized(res, cors)

  const ip = clientIp(req, config.trustProxy)
  if (photoLimiter.isLimited(ip)) return tooMany(res, cors)

  const declared = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  const ext = EXT_BY_TYPE[declared]
  if (!ext) {
    return send(res, 415, { error: '사진은 JPEG·PNG·WebP 형식만 올릴 수 있습니다.' }, cors)
  }

  const full = () =>
    send(res, 409, { error: `사진은 청첩장당 최대 ${config.maxPhotosPerWedding}장까지 올릴 수 있습니다.` }, cors)
  if (photosFull(deps, slug)) return full()

  const limit = PLATFORM_LIMITS.photoBytes
  const tooLarge = () =>
    send(res, 413, { error: `사진이 너무 큽니다. (장당 최대 ${Math.floor(limit / 1024 / 1024)}MB)` }, cors)
  // Content-Length 가 이미 한도를 넘으면 본문을 받지 않고 거절한다. (없거나 거짓이어도 아래 스트리밍 상한이 막는다)
  const declaredLength = Number(req.headers['content-length'])
  if (Number.isFinite(declaredLength) && declaredLength > limit) return tooLarge()

  // 서비스 전체 사진 용량 상한: DB 와 같은 디스크가 가득 차 모든 청첩장의 쓰기가 실패하는 일을 막는다.
  const noSpace = () =>
    send(res, 507, { error: '서비스의 사진 저장 공간이 가득 찼습니다. 운영자에게 문의해 주세요.' }, cors)
  const overQuota = (/** @type {number} */ incoming) => db.photoBytesTotal() + incoming > config.maxUploadBytes
  if (overQuota(Number.isFinite(declaredLength) && declaredLength > 0 ? declaredLength : 1)) return noSpace()

  const body = await readBytes(req, limit)
  if (!body.ok) {
    return body.tooLarge ? tooLarge() : send(res, 400, { error: '요청을 읽지 못했습니다.' }, cors)
  }
  if (body.buffer.length === 0) return send(res, 400, { error: '사진 데이터가 비어 있습니다.' }, cors)
  if (sniffImage(body.buffer) !== declared) {
    return send(res, 400, { error: '이미지 파일이 아니거나 Content-Type 과 실제 형식이 다릅니다.' }, cors)
  }

  // 본문을 받는 사이 상태가 바뀌었을 수 있으므로 전부 다시 확인한다. 여기서 addPhoto 까지는 동기 구간이다.
  //  - 청첩장이 지워졌다 → 404
  //  - 지워진 뒤 같은 주소로 다른 사람이 다시 만들었거나 비밀번호가 바뀌었다 → 예전 토큰은 무효(401)
  //  - 다른 업로드가 자리/용량을 채웠다 → 409 / 507
  if (!db.weddingExists(slug)) return send(res, 404, { error: '청첩장을 찾을 수 없습니다.' }, cors)
  if (!isOwner(req, deps, slug)) return unauthorized(res, cors)
  if (photosFull(deps, slug)) return full()
  if (overQuota(body.buffer.length)) return noSpace()
  if (!photoLimiter.take(ip)) return tooMany(res, cors)

  const file = `${randomBytes(16).toString('hex')}.${ext}`
  const dir = join(config.uploadDir, slug)
  // 행을 먼저 넣어(동기) 동시 업로드가 상한을 넘지 못하게 하고, 파일 쓰기에 실패하면 되돌린다.
  db.addPhoto(slug, file, body.buffer.length)
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, file), body.buffer, { flag: 'wx', mode: 0o644 })
  } catch (err) {
    db.deletePhoto(slug, file)
    throw err
  }
  // 파일을 쓰는 사이 청첩장이 지워졌으면 주인 없는 폴더를 남기지 않는다.
  if (!db.weddingExists(slug)) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    return send(res, 404, { error: '청첩장을 찾을 수 없습니다.' }, cors)
  }
  return send(res, 201, { url: `/uploads/${slug}/${file}` }, cors)
}

/**
 * 사진 파일과 행을 지운다. config(coverImage/gallery)에서 경로를 빼는 것은 호출 측(프론트)의 일이다.
 * @param {Req} req @param {Res} res @param {Deps} deps @param {Cors} cors @param {string} slug @param {string | null} file
 */
export async function handleDeletePhoto(req, res, deps, cors, slug, file) {
  const { config, db } = deps
  if (!isOwner(req, deps, slug)) return unauthorized(res, cors)
  if (file === null || !PHOTO_FILE_RE.test(file) || !db.hasPhoto(slug, file)) {
    return send(res, 404, { error: '사진을 찾을 수 없습니다.' }, cors)
  }
  db.deletePhoto(slug, file)
  await unlink(join(config.uploadDir, slug, file)).catch(() => {})
  return send(res, 204, null, cors)
}

/**
 * GET /uploads/:slug/:file
 * @param {Req} req @param {Res} res @param {Deps} deps @param {Cors} cors
 * @param {string | null} slug @param {string | null} file
 */
export async function handleServeUpload(req, res, deps, cors, slug, file) {
  const { config, db } = deps
  const missing = () => send(res, 404, { error: '찾을 수 없습니다.' }, cors)
  // 두 정규식 모두 '/', '\\', '.', '..', NUL 을 허용하지 않으므로 join 결과는 항상 uploadDir/<slug>/<file> 이다.
  if (slug === null || file === null || !SLUG_PATTERN.test(slug) || !PHOTO_FILE_RE.test(file)) return missing()
  if (!db.hasPhoto(slug, file)) return missing()

  const path = join(config.uploadDir, slug, file)
  let info
  try {
    info = await stat(path)
  } catch {
    return missing()
  }
  if (!info.isFile()) return missing()

  res.writeHead(200, {
    ...securityHeaders,
    ...cors,
    'Content-Type': TYPE_BY_EXT[file.slice(file.lastIndexOf('.') + 1)],
    'Content-Length': info.size,
    // 파일 이름이 무작위라 내용이 바뀌면 주소도 바뀐다 → 영구 캐시
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Security-Policy': "default-src 'none'",
    'Cross-Origin-Resource-Policy': 'cross-origin',
  })
  if (req.method === 'HEAD') return res.end()
  const stream = createReadStream(path)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
}
