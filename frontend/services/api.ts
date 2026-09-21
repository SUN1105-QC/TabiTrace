export type ApiEnvelope<T> = {
  success: boolean
  data: T
  code?: string | null
  message?: string | null
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '')
const ACCESS_KEY = 'tabitrace-access-token'
const REFRESH_KEY = 'tabitrace-refresh-token'

export class ApiError extends Error {
  status: number
  code?: string | null
  constructor(message: string, status: number, code?: string | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(REFRESH_KEY)
}

export function hasSession() {
  return Boolean(getAccessToken() || getRefreshToken())
}

export function saveTokens(accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACCESS_KEY, accessToken)
  window.localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACCESS_KEY)
  window.localStorage.removeItem(REFRESH_KEY)
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })
      const envelope = await response.json() as ApiEnvelope<{accessToken:string;refreshToken:string}>
      if (!response.ok || !envelope?.success || !envelope.data?.accessToken) {
        clearTokens()
        return null
      }
      saveTokens(envelope.data.accessToken, envelope.data.refreshToken)
      return envelope.data.accessToken
    } catch {
      clearTokens()
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function request<T>(path: string, init: RequestInit, auth: boolean, allowRefresh: boolean): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData) && !(init.body instanceof Blob)) {
    headers.set('Content-Type', 'application/json')
  }
  if (auth) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch (cause) {
    throw new ApiError(`无法连接后端服务：${API_BASE}`, 0, 'NETWORK_ERROR')
  }
  if (response.status === 401 && auth && allowRefresh) {
    const refreshed = await refreshAccessToken()
    if (refreshed) return request<T>(path, init, auth, false)
    clearTokens()
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
      const next = `${window.location.pathname}${window.location.search}`
      window.location.assign(`/login?next=${encodeURIComponent(next)}`)
      throw new ApiError('登录状态已失效，请重新登录', 401, 'UNAUTHORIZED')
    }
  }

  let envelope: ApiEnvelope<T> | null = null
  try { envelope = await response.json() } catch {}
  if (!response.ok || !envelope?.success) {
    throw new ApiError(envelope?.message || `HTTP ${response.status}`, response.status, envelope?.code)
  }
  return envelope.data
}

export async function api<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  return request<T>(path, init, auth, true)
}

export const jsonBody = (value: unknown) => JSON.stringify(value)
export { API_BASE }
