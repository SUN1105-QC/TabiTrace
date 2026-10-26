'use client'

import type { ReactNode } from 'react'
import { useRequireSession } from '@/hooks/useRequireSession'

/** 需要登录的页面：确认登录状态之前不渲染任何个人数据，未登录直接跳到登录页 */
export function SessionGate({ children }: { children: ReactNode }) {
  const ready = useRequireSession(true)
  if (!ready) {
    return <main className="grid min-h-[60vh] place-items-center px-5 text-sm text-black/45">正在确认登录状态…</main>
  }
  return <>{children}</>
}
