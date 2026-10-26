'use client'

/**
 * 全局偏好（语言、时区）的运行时 Provider。
 *
 * - 首屏：使用服务端从 cookie 读到的 initial 值渲染（与服务端 HTML 一致，不会 zh → en 闪烁）
 * - 登录用户：用户资料（userApi.me，或保存设置后广播的 USER_UPDATED_EVENT）到达后，以数据库里的 locale / timezone 为准并立即切换
 * - 未登录：沿用本机偏好（cookie）；没有时用浏览器语言 / 设备时区，最后才是默认值
 * 切换时同步：运行时偏好（供非 React 代码使用）、<html lang>、本机 cookie（下次首屏直接用对的语言）
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { hasSession } from '@/services/api'
import { USER_UPDATED_EVENT, userApi, type UserView } from '@/services/tabitrace-api'
import { translate, type TFunction } from '@/i18n'
import {
  browserLocale, deviceTimeZone, isValidTimeZone, matchLocale, rememberLocalPrefs, setRuntimePrefs, type Locale, type RuntimePrefs
} from '@/lib/preferences'

type Ctx = RuntimePrefs & { t: TFunction }
const PreferencesContext = createContext<Ctx | null>(null)

export function PreferencesProvider({ initial, hasSavedLocal, children }: { initial: RuntimePrefs; hasSavedLocal: boolean; children: ReactNode }) {
  // 只在首次渲染时同步运行时偏好，保证服务端与客户端首屏使用同一份值
  const [prefs, setPrefs] = useState<RuntimePrefs>(() => { setRuntimePrefs(initial); return initial })

  const apply = useCallback((next: RuntimePrefs) => {
    setRuntimePrefs(next)
    setPrefs(p => (p.locale === next.locale && p.timeZone === next.timeZone ? p : next))
    if (document.documentElement.lang !== next.locale) document.documentElement.lang = next.locale
    rememberLocalPrefs(next)
  }, [])

  const fromUser = useCallback((u: UserView | null | undefined) => {
    if (!u) return
    apply({
      locale: matchLocale(u.locale) ?? initial.locale,
      timeZone: isValidTimeZone(u.timezone) ? u.timezone! : initial.timeZone
    })
  }, [apply, initial.locale, initial.timeZone])

  useEffect(() => {
    // 登录用户：数据库偏好优先
    if (hasSession()) { userApi.me().then(fromUser).catch(() => {}) }
    // 未登录且本机从未保存过偏好：用浏览器语言与设备时区
    else if (!hasSavedLocal) apply({ locale: browserLocale() ?? initial.locale, timeZone: deviceTimeZone() ?? initial.timeZone })
    const onUser = (e: Event) => fromUser((e as CustomEvent<UserView>).detail)
    window.addEventListener(USER_UPDATED_EVENT, onUser)
    return () => window.removeEventListener(USER_UPDATED_EVENT, onUser)
  }, [apply, fromUser, hasSavedLocal, initial.locale, initial.timeZone])

  const t = useCallback<TFunction>((key, vars) => translate(prefs.locale, key, vars), [prefs.locale])
  const value = useMemo(() => ({ ...prefs, t }), [prefs, t])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): Ctx {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences 必须在 PreferencesProvider 内使用')
  return ctx
}

export const useT = () => usePreferences().t
export type { Locale }
