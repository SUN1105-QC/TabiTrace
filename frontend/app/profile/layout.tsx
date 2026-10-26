import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SessionGate } from '@/components/common/SessionGate'

/** 个人页面：不进入搜索结果；确认登录后才渲染 */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return <SessionGate>{children}</SessionGate>
}
