import { defaultApiBase, loadDevDataAdapter } from '@/lib/env'

export type ApiEnvelope<T> = {
  success: boolean
  data: T
  code?: string | null
  message?: string | null
}

/**
 * API 地址：
 * - 生产环境默认同源 /api/v1（由 Next.js 转发到内网 API，见 next.config.ts），浏览器里不会出现任何本机地址
 * - 开发环境默认直连本机后端；也可以用 NEXT_PUBLIC_API_BASE_URL 指定
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || defaultApiBase()).replace(/\/$/, '')
/** 旧版本把 15 分钟的访问令牌放在 localStorage；现在只放在内存里，读到旧值直接删除 */
const LEGACY_ACCESS_KEY = 'tabitrace-access-token'
/** 只是“这台设备登录过”的标记，不含任何凭证：页面据此决定先尝试刷新登录还是直接跳到登录页 */
const SESSION_KEY = 'tabitrace-session'
/** 旧版本把 30 天的 refresh token 存在 localStorage；现在改由 HttpOnly Cookie 保存，读到旧值只用于一次性迁移 */
const LEGACY_REFRESH_KEY = 'tabitrace-refresh-token'
const REQUEST_TIMEOUT_MS = 20000

export class ApiError extends Error {
  status: number
  code?: string | null
  /** 错误响应里的补充信息（如 retryAfter、remainingAttempts） */
  details?: Record<string, unknown> | null
  constructor(message: string, status: number, code?: string | null, details?: Record<string, unknown> | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const storage = () => {
  if (typeof window === 'undefined') return null
  try { return window.localStorage } catch { return null }
}

/**
 * 访问令牌（15 分钟）只保存在当前页面的内存里：XSS 无法从存储里读到它，关闭标签页即消失。
 * 刷新页面 / 新开标签页时，用 HttpOnly Cookie 里的 refresh token 静默换一个新的，不需要重新登录。
 */
let accessToken: string | null = null

if (typeof window !== 'undefined') {
  // 一次性清理：升级前留在 localStorage 的访问令牌不再使用
  try { window.localStorage.removeItem(LEGACY_ACCESS_KEY) } catch { /* 存储不可用时无需清理 */ }
  // 其他标签页退出登录（移除了会话标记）时，这个标签页内存里的令牌也作废
  window.addEventListener('storage', e => { if (e.key === SESSION_KEY && !e.newValue) accessToken = null })
}

export function getAccessToken() {
  return accessToken
}

export function hasSession() {
  const s = storage()
  return Boolean(accessToken || (s && (s.getItem(SESSION_KEY) || s.getItem(LEGACY_REFRESH_KEY))))
}

/** 登录成功：访问令牌放内存；refresh token 已由后端写入 HttpOnly Cookie；本机只留一个不含凭证的会话标记 */
export function saveTokens(token: string) {
  accessToken = token
  const s = storage()
  if (!s) return
  s.setItem(SESSION_KEY, '1')
  s.removeItem(LEGACY_REFRESH_KEY)
  s.removeItem(LEGACY_ACCESS_KEY)
}

export function clearTokens() {
  accessToken = null
  const s = storage()
  if (!s) return
  s.removeItem(SESSION_KEY)
  s.removeItem(LEGACY_REFRESH_KEY)
  s.removeItem(LEGACY_ACCESS_KEY)
}

let refreshPromise: Promise<string | null> | null = null

/** 用 HttpOnly Cookie 里的 refresh token 换新的访问令牌（旧版本留在本机的 refresh token 会借这次机会迁移进 Cookie） */
async function callRefresh(): Promise<string | null> {
  const legacy = storage()?.getItem(LEGACY_REFRESH_KEY)
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(legacy ? { refreshToken: legacy } : {})
  })
  const envelope = await response.json().catch(() => null) as ApiEnvelope<{ accessToken: string }> | null
  if (!response.ok || !envelope?.success || !envelope.data?.accessToken) return null
  saveTokens(envelope.data.accessToken)
  return envelope.data.accessToken
}

async function refreshAccessToken(): Promise<string | null> {
  if (!hasSession()) return null
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      // 多个标签页可能同时刷新：refresh token 每次使用后轮换，后到的标签页会失败一次；
      // 这时浏览器里已经是新 Cookie，稍等再试一次即可，不必把用户踢回登录页
      let token = await callRefresh().catch(() => null)
      for (const wait of [400, 1000]) {
        if (token || !hasSession()) break
        await new Promise(r => setTimeout(r, wait))
        token = await callRefresh().catch(() => null)
      }
      if (!token) clearTokens()
      return token
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

/**
 * 开发环境：先交给开发数据适配层（Local 模式返回 null，照常请求本地后端；Mock / Empty 由适配层直接作答）。
 * 生产环境 loadDevDataAdapter() 恒为 null，不读取任何开发开关，也不包含适配层代码。
 */
async function devRoute(path: string, init: RequestInit) {
  const loading = loadDevDataAdapter()
  return loading ? (await loading).route(path, init) : null
}

/** 依赖数据源的内存缓存在这里登记；开发数据源切换时统一清空，避免新旧数据混在一起 */
const dataCaches = new Set<() => void>()
export function registerDataCache(clear: () => void) { dataCaches.add(clear) }
export function resetDataCaches() { dataCaches.forEach(clear => clear()) }

/** 开发数据层的虚拟上传地址（Mock 模式）：文件只在当前标签页内存里预览，不会上传到任何存储 */
export const DEV_UPLOAD_SCHEME = 'devmem://'
export async function stageDevUpload(storageKey: string, blob: Blob) {
  const loading = loadDevDataAdapter()
  if (loading) (await loading).stageUpload(storageKey, blob)
}

async function request<T>(path: string, init: RequestInit, auth: boolean, allowRefresh: boolean): Promise<T> {
  const dev = await devRoute(path, init)
  if (dev) return dev.data as T

  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData) && !(init.body instanceof Blob)) {
    headers.set('Content-Type', 'application/json')
  }
  if (auth) {
    // 刚打开页面时内存里还没有令牌：有会话标记就先静默刷新，避免每个请求都先吃一次 401
    if (!accessToken && allowRefresh && hasSession()) await refreshAccessToken()
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  // 超时：调用方没有传 signal 时，20 秒没有响应就报超时，而不是一直转圈
  const signal = init.signal ?? (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined)
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, signal, credentials: 'include' })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'TimeoutError') throw new ApiError('请求超时，请检查网络后重试', 0, 'REQUEST_TIMEOUT')
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError('无法连接服务器，请检查网络后重试', 0, 'NETWORK_ERROR')
  }
  if (response.status === 401 && auth && allowRefresh) {
    const refreshed = await refreshAccessToken()
    if (refreshed) return request<T>(path, init, auth, false)
    clearTokens()
    if (typeof window !== 'undefined' && !/^\/(login|register|forgot-password)(\/|$)/.test(window.location.pathname)) {
      const next = `${window.location.pathname}${window.location.search}`
      window.location.assign(`/login?next=${encodeURIComponent(next)}`)
      throw new ApiError('登录状态已失效，请重新登录', 401, 'UNAUTHORIZED')
    }
  }

  let envelope: ApiEnvelope<T> | null = null
  try { envelope = await response.json() } catch {}
  if (!response.ok || !envelope?.success) {
    throw new ApiError(envelope?.message || `HTTP ${response.status}`, response.status, envelope?.code, (envelope?.data as Record<string, unknown> | null) ?? null)
  }
  return envelope.data
}

export async function api<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  return request<T>(path, init, auth, true)
}

export const jsonBody = (value: unknown) => JSON.stringify(value)
export { API_BASE }
