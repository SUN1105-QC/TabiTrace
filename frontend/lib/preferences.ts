/**
 * 运行时偏好：界面语言与时区的唯一来源（Single Source of Truth 在运行时的镜像）。
 *
 * 优先级
 *   登录用户：数据库里保存的 user.locale / user.timezone（由 PreferencesProvider 在用户资料加载或更新后写入）
 *   未登录：本机保存的偏好（cookie，同时用于服务端首屏渲染）→ 浏览器语言 / 设备时区 → 默认值
 *
 * 非 React 代码（日期格式化、导出图片等）通过 runtimePrefs() 读取；React 组件用 usePreferences()，切换后会重新渲染。
 */

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US', 'ja-JP'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'zh-CN'
export const DEFAULT_TIMEZONE = 'Asia/Tokyo'

export const LOCALE_COOKIE = 'tabitrace-locale'
export const TIMEZONE_COOKIE = 'tabitrace-tz'

export type RuntimePrefs = { locale: Locale; timeZone: string }

let current: RuntimePrefs = { locale: DEFAULT_LOCALE, timeZone: DEFAULT_TIMEZONE }

export const runtimePrefs = () => current
export function setRuntimePrefs(next: Partial<RuntimePrefs>) { current = { ...current, ...next } }

export const isSupportedLocale = (v: unknown): v is Locale => typeof v === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(v)

/** zh / zh-TW / zh-Hans-CN → zh-CN，ja → ja-JP，en-GB → en-US；不支持的语言返回 null */
export function matchLocale(tag?: string | null): Locale | null {
  if (!tag) return null
  if (isSupportedLocale(tag)) return tag
  const base = tag.toLowerCase().split(/[-_]/)[0]
  return base === 'zh' ? 'zh-CN' : base === 'ja' ? 'ja-JP' : base === 'en' ? 'en-US' : null
}

export function isValidTimeZone(tz?: string | null): tz is string {
  if (!tz) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

/** 浏览器语言（只在没有任何保存偏好时使用） */
export function browserLocale(): Locale | null {
  if (typeof navigator === 'undefined') return null
  for (const tag of navigator.languages ?? [navigator.language]) { const m = matchLocale(tag); if (m) return m }
  return null
}

export function deviceTimeZone(): string | null {
  try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; return isValidTimeZone(tz) ? tz : null } catch { return null }
}

/** 本机保存的偏好：写入 cookie，服务端首屏也能用同一语言渲染，避免 zh → en 闪烁 */
export function rememberLocalPrefs(p: RuntimePrefs) {
  if (typeof document === 'undefined') return
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(p.locale)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
  document.cookie = `${TIMEZONE_COOKIE}=${encodeURIComponent(p.timeZone)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
}
