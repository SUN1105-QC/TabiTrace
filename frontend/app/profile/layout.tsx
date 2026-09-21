'use client'

import type { ReactNode } from 'react'
import { useRequireSession } from '@/hooks/useRequireSession'

export default function ProfileLayout({ children }: { children: ReactNode }) {
  const ready = useRequireSession(true)
  if (!ready) {
    return <main className="grid min-h-[60vh] place-items-center px-5 text-sm text-black/45">正在确认登录状态…</main>
  }
  return <>{children}</>
}
