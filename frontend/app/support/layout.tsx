import type { Metadata } from 'next'
import { SessionGate } from '@/components/common/SessionGate'
export const metadata: Metadata = { title: '联系管理员 · 旅迹', robots: { index: false, follow: false } }
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return <SessionGate>{children}</SessionGate>
}
