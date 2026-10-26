/**
 * 会话与令牌刷新（services/api.ts）：访问令牌只在内存；旧版 localStorage 令牌被清理；
 * 401 时只刷新一次并重试；并发请求共用一次刷新；刷新失败最多 3 次后回到登录页，不会无限刷新。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, String(v)) }
  removeItem(k: string) { this.data.delete(k) }
  clear() { this.data.clear() }
  key(i: number) { return [...this.data.keys()][i] ?? null }
  get length() { return this.data.size }
}

type Reply = { status: number; body: unknown }
const json = (status: number, body: unknown): Reply => ({ status, body })
const ok = (data: unknown) => json(200, { success: true, data })

let storage: MemoryStorage
let listeners: Record<string, ((e: unknown) => void)[]>
let assigned: string[]
let calls: { url: string; auth: string | null }[]
let replies: ((url: string, auth: string | null) => Reply)

async function loadApi() {
  vi.resetModules()
  return import('@/services/api')
}

beforeEach(() => {
  storage = new MemoryStorage()
  listeners = {}
  assigned = []
  calls = []
  vi.stubGlobal('window', {
    localStorage: storage,
    location: { pathname: '/trips/1', search: '?tab=x', assign: (u: string) => { assigned.push(u) } },
    addEventListener: (type: string, fn: (e: unknown) => void) => { (listeners[type] ??= []).push(fn) }
  })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const auth = new Headers(init.headers).get('Authorization')
    calls.push({ url, auth })
    const r = replies(url, auth)
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body } as Response
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('访问令牌只保存在内存', () => {
  it('加载时删除旧版 localStorage 访问令牌，不动其他偏好', async () => {
    storage.setItem('tabitrace-access-token', 'legacy.jwt')
    storage.setItem('tabitrace.dev.dataSource', 'mock')
    storage.setItem('tabitrace-notifications-read-at', '123')
    await loadApi()
    expect(storage.getItem('tabitrace-access-token')).toBeNull()
    expect(storage.getItem('tabitrace.dev.dataSource')).toBe('mock')
    expect(storage.getItem('tabitrace-notifications-read-at')).toBe('123')
  })

  it('登录后令牌只在内存，localStorage 只有不含凭证的会话标记', async () => {
    const api = await loadApi()
    api.saveTokens('access-1')
    expect(api.getAccessToken()).toBe('access-1')
    expect([...storage.data.values()].some(v => v.includes('access-1'))).toBe(false)
    expect(storage.getItem('tabitrace-session')).toBe('1')
    api.clearTokens()
    expect(api.getAccessToken()).toBeNull()
    expect(api.hasSession()).toBe(false)
  })

  it('其他标签页退出（会话标记被删除）时，内存令牌作废', async () => {
    const api = await loadApi()
    api.saveTokens('access-1')
    listeners.storage.forEach(fn => fn({ key: 'tabitrace-session', newValue: null }))
    expect(api.getAccessToken()).toBeNull()
  })
})

describe('刷新流程', () => {
  it('刷新页面后（内存为空但有会话标记）先静默刷新，再带新令牌请求', async () => {
    storage.setItem('tabitrace-session', '1')
    replies = url => (url.endsWith('/auth/refresh') ? ok({ accessToken: 'fresh' }) : ok({ id: 1 }))
    const api = await loadApi()
    await expect(api.api('/users/me')).resolves.toEqual({ id: 1 })
    expect(calls.map(c => c.url.replace(/^.*\/api\/v1/, ''))).toEqual(['/auth/refresh', '/users/me'])
    expect(calls[1].auth).toBe('Bearer fresh')
  })

  it('访问令牌过期（401）：刷新一次并重试成功', async () => {
    const api = await loadApi()
    api.saveTokens('old')
    replies = (url, auth) => url.endsWith('/auth/refresh') ? ok({ accessToken: 'new' }) : auth === 'Bearer new' ? ok('data') : json(401, { success: false, code: 'UNAUTHORIZED' })
    await expect(api.api('/trips')).resolves.toBe('data')
    expect(calls.filter(c => c.url.endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('并发的多个 401 共用同一次刷新', async () => {
    const api = await loadApi()
    api.saveTokens('old')
    replies = (url, auth) => url.endsWith('/auth/refresh') ? ok({ accessToken: 'new' }) : auth === 'Bearer new' ? ok(url) : json(401, { success: false })
    await Promise.all([api.api('/a'), api.api('/b'), api.api('/c')])
    expect(calls.filter(c => c.url.endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('会话失效：最多尝试 3 次刷新，然后清除会话并跳到登录页（带 next），不会无限刷新', async () => {
    const api = await loadApi()
    api.saveTokens('old')
    replies = url => (url.endsWith('/auth/refresh') ? json(401, { success: false, code: 'REFRESH_TOKEN_REVOKED' }) : json(401, { success: false }))
    await expect(api.api('/trips')).rejects.toMatchObject({ status: 401 })
    expect(calls.filter(c => c.url.endsWith('/auth/refresh')).length).toBeLessThanOrEqual(3)
    expect(api.hasSession()).toBe(false)
    expect(assigned).toEqual(['/login?next=%2Ftrips%2F1%3Ftab%3Dx'])
    const before = calls.length
    await expect(api.api('/trips')).rejects.toBeTruthy()
    expect(calls.slice(before).some(c => c.url.endsWith('/auth/refresh'))).toBe(false)
  })
})
