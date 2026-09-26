'use client'

/** 移动端底部导航：首页 / 旅程 / 打卡（中间凸起）/ 分享 / 我的。 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, Home, MapPin, Share2, UserRound } from 'lucide-react'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'

export function MobileBottomNav({ activeTripId }: { activeTripId: number | null }) {
  const pathname = usePathname()
  const { openQuickCheckIn } = useQuickCheckIn()

  const shareHref = activeTripId ? `/trips/${activeTripId}/share` : '/trips'
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <nav className="mobile-appbar" aria-label="移动端导航">
      <Link href="/" className={isActive('/') ? 'active' : ''} aria-current={isActive('/') ? 'page' : undefined}>
        <Home aria-hidden="true" /><span>首页</span>
      </Link>
      <Link href="/trips" className={isActive('/trips') && !pathname.includes('/share') ? 'active' : ''} aria-current={isActive('/trips') && !pathname.includes('/share') ? 'page' : undefined}>
        <MapPin aria-hidden="true" /><span>旅程</span>
      </Link>

      <button type="button" className="mobile-appbar-fab" aria-label="快速打卡" onClick={() => openQuickCheckIn(activeTripId ?? undefined)}>
        <span className="mobile-appbar-fab-ring"><Camera aria-hidden="true" /></span>
        <span>打卡</span>
      </button>

      <Link href={shareHref} className={pathname.includes('/share') ? 'active' : ''} aria-current={pathname.includes('/share') ? 'page' : undefined}>
        <Share2 aria-hidden="true" /><span>分享</span>
      </Link>
      <Link href="/profile" className={isActive('/profile') ? 'active' : ''} aria-current={isActive('/profile') ? 'page' : undefined}>
        <UserRound aria-hidden="true" /><span>我的</span>
      </Link>
    </nav>
  )
}
