import { describe, expect, it, vi } from 'vitest'
import { lazyRetry } from './lazyRetry'
import type { LazyRetryEnv } from './lazyRetry'

function fakeEnv(reloaded = false) {
  const state = { reloaded, reloads: 0 }
  const env: LazyRetryEnv = {
    reloaded: () => state.reloaded,
    markReloaded: () => {
      state.reloaded = true
    },
    clearReloaded: () => {
      state.reloaded = false
    },
    reload: () => {
      state.reloads += 1
    },
  }
  return { env, state }
}

describe('lazyRetry', () => {
  it('성공하면 그대로 돌려주고 새로고침 표시를 지운다', async () => {
    const { env, state } = fakeEnv(true)
    const load = vi.fn().mockResolvedValue('mod')
    await expect(lazyRetry(load, env)()).resolves.toBe('mod')
    expect(load).toHaveBeenCalledTimes(1)
    expect(state).toEqual({ reloaded: false, reloads: 0 })
  })

  it('한 번 실패하면 다시 시도한다', async () => {
    const { env, state } = fakeEnv()
    const load = vi.fn().mockRejectedValueOnce(new Error('blip')).mockResolvedValue('mod')
    await expect(lazyRetry(load, env)()).resolves.toBe('mod')
    expect(load).toHaveBeenCalledTimes(2)
    expect(state.reloads).toBe(0)
  })

  it('두 번 다 실패하면 한 번만 새로고침하고, 그동안 결과를 내지 않는다', async () => {
    const { env, state } = fakeEnv()
    const load = vi.fn().mockRejectedValue(new Error('gone'))
    const settled = vi.fn()
    lazyRetry(load, env)().then(settled, settled)
    await new Promise((r) => setTimeout(r, 0))
    expect(load).toHaveBeenCalledTimes(2)
    expect(state).toEqual({ reloaded: true, reloads: 1 })
    expect(settled).not.toHaveBeenCalled()
  })

  it('이미 새로고침했는데도 실패하면 오류를 던진다 (무한 새로고침 방지)', async () => {
    const { env, state } = fakeEnv(true)
    const load = vi.fn().mockRejectedValue(new Error('gone'))
    await expect(lazyRetry(load, env)()).rejects.toThrow('gone')
    expect(state.reloads).toBe(0)
  })
})
