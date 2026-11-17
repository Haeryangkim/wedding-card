/**
 * 엔트리 포인트: 설정을 읽어 서버를 띄우고, SIGTERM/SIGINT 에 안전하게 종료한다.
 */
import { createApp } from './app.js'

const app = createApp()
const { server, config, close } = app

server.listen(config.port, () => {
  process.stdout.write(
    JSON.stringify({
      t: new Date().toISOString(),
      msg: 'wedding platform api listening',
      port: config.port,
      dbPath: config.dbPath,
      uploadDir: config.uploadDir,
      cors: config.corsOrigin,
      publicOrigin: config.publicOrigin,
      maxWeddings: config.maxWeddings,
      maxGuests: config.maxGuests,
      trustProxy: config.trustProxy,
      admin: Boolean(config.adminToken),
    }) + '\n',
  )
})

let closing = false
/** @param {string} signal */
async function shutdown(signal) {
  if (closing) return
  closing = true
  process.stdout.write(JSON.stringify({ t: new Date().toISOString(), msg: 'shutting down', signal }) + '\n')
  try {
    await close()
  } finally {
    process.exit(0)
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
