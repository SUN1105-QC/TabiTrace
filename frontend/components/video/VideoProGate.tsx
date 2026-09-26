'use client'

/** 行内的 Pro 提示：不弹窗、不打断操作，只说明限制并给出升级入口。 */

import Link from 'next/link'
import { Crown } from 'lucide-react'

export function VideoProGate({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`ts-gate${compact ? ' is-compact' : ''}`} role="status">
      <Crown size={compact ? 13 : 15} />
      <span>{message}</span>
      <Link href="/pricing" className="ts-gate-link">升级 Pro</Link>
    </div>
  )
}

/** 小号 FREE / PRO 标识 */
export function PlanBadge({ plan }: { plan: 'FREE' | 'PRO' }) {
  return <span className={`ts-plan ${plan === 'PRO' ? 'is-pro' : ''}`}>{plan}</span>
}
