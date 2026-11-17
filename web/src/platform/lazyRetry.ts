/**
 * 지연 로딩 청크 불러오기 실패 대비.
 *
 * 새 버전이 배포되면 해시가 붙은 예전 청크 파일이 사라져, 열어 둔 화면에서 "청첩장 만들기" 같은
 * 지연 로딩 화면으로 넘어갈 때 import 가 실패한다. 한 번 더 시도해 보고(일시적인 네트워크 문제),
 * 그래도 안 되면 페이지를 새로 받아 최신 버전으로 맞춘다. 새로고침은 탭마다 한 번만 한다(무한 반복 방지).
 * 그 뒤에도 실패하면 오류를 그대로 던져 화면의 오류 안내(ErrorBoundary)가 보이게 한다.
 */

const RELOAD_FLAG = 'wedding-chunk-reload'

export interface LazyRetryEnv {
  /** 새로고침을 이미 한 번 했는가 */
  reloaded: () => boolean
  markReloaded: () => void
  clearReloaded: () => void
  reload: () => void
}

function browserEnv(): LazyRetryEnv {
  return {
    reloaded: () => {
      try {
        return sessionStorage.getItem(RELOAD_FLAG) === '1'
      } catch {
        return true // 저장소를 못 쓰면 반복 여부를 알 수 없으니 새로고침하지 않는다
      }
    },
    markReloaded: () => {
      try {
        sessionStorage.setItem(RELOAD_FLAG, '1')
      } catch {
        /* 무시 */
      }
    },
    clearReloaded: () => {
      try {
        sessionStorage.removeItem(RELOAD_FLAG)
      } catch {
        /* 무시 */
      }
    },
    reload: () => window.location.reload(),
  }
}

/** React.lazy 에 넘길 importer 를 감싼다: 실패 → 한 번 재시도 → (탭당 한 번) 새로고침 → 오류 */
export function lazyRetry<T>(load: () => Promise<T>, env: LazyRetryEnv = browserEnv()): () => Promise<T> {
  return async () => {
    try {
      const mod = await load().catch(() => load())
      env.clearReloaded()
      return mod
    } catch (err) {
      if (env.reloaded()) throw err
      env.markReloaded()
      env.reload()
      // 새로고침이 진행되는 동안 오류 화면이 번쩍이지 않도록 끝나지 않는 약속을 돌려준다
      return new Promise<T>(() => {})
    }
  }
}
