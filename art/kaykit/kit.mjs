/**
 * 굽기 공용 도구: 정적 파일 서버 + 헤드리스 크롬 실행 + PNG 쓰기.
 * 의존성(three · puppeteer-core · pngjs)은 저장소에 넣지 않는다 — `--modules <node_modules 경로>` 로 알려 주거나
 * 이 폴더에서 `npm install` 한다.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export const HERE = path.dirname(fileURLToPath(import.meta.url))

export function argValue(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

export const MODULES = path.resolve(argValue('--modules', path.join(HERE, 'node_modules')))
const require = createRequire(path.join(MODULES, '_'))
export const puppeteer = require('puppeteer-core')
export const { PNG } = require('pngjs')

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.png': 'image/png' }

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const file = url.startsWith('/modules/') ? path.join(MODULES, url.slice('/modules/'.length)) : path.join(HERE, url)
    const root = url.startsWith('/modules/') ? MODULES : HERE
    if (!path.resolve(file).startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found')
      return
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

/** 렌더 페이지를 열고 준비될 때까지 기다린다 */
export async function openRenderer() {
  const server = await serve()
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    // 소프트웨어 WebGL(SwiftShader): 기기와 상관없이 같은 그림이 나온다
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run', '--hide-scrollbars'],
  })
  const page = await browser.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') console.error('[page]', m.text())
  })
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  await page.goto(`http://127.0.0.1:${server.address().port}/render.html`)
  await page.waitForFunction('window.kk !== undefined', { timeout: 60000 })
  const info = await page.evaluate(() => window.kk.ready)
  const cell = async (spec) => {
    const r = await page.evaluate((s) => window.kk.renderCell(s), spec)
    return { color: Buffer.from(r.color, 'base64'), mask: r.mask ? Buffer.from(r.mask, 'base64') : null, count: r.count }
  }
  const close = async () => {
    await browser.close()
    server.close()
  }
  return { page, info, cell, close }
}

export function writePng(file, rgba, w, h) {
  const png = new PNG({ width: w, height: h })
  Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength).copy(png.data)
  fs.writeFileSync(file, PNG.sync.write(png))
}

export function readPng(file) {
  const png = PNG.sync.read(fs.readFileSync(file))
  return { data: png.data, w: png.width, h: png.height }
}

/** 곱하지 않은 알파끼리의 over: src(sw x sh) 를 dst 의 (dx,dy) 에 겹친다 */
export function over(dst, dw, src, sw, sh, dx, dy) {
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const s = (y * sw + x) * 4
      const sa = src[s + 3] / 255
      if (sa === 0) continue
      const d = ((dy + y) * dw + dx + x) * 4
      const da = (dst[d + 3] / 255) * (1 - sa)
      const oa = sa + da
      for (let k = 0; k < 3; k++) dst[d + k] = Math.round((src[s + k] * sa + dst[d + k] * da) / oa)
      dst[d + 3] = Math.round(oa * 255)
    }
}
