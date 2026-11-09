'use client'

/**
 * 移动端底部导航：首页 / 旅程 / 打卡（中间凸起）/ 探索 / 我的。
 * 中间相机按钮直接唤起拍照（同时打开快速打卡面板，相机不可用或取消时可以在面板里选相册）。
 * 在某段旅行的页面里点，记录到这段旅行；其他页面由快速打卡自己找当前进行中的旅行。
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, Compass, Home, MapPin, UserRound } from 'lucide-react'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'
import { useT } from '@/components/common/PreferencesProvider'

export function MobileBottomNav({ activeTripId, readOnly = false }: { activeTripId: number | null; readOnly?: boolean }) {
  const pathname = usePathname()
  const { openQuickCheckIn } = useQuickCheckIn()
  const t = useT()

  const routeTrip = Number(pathname.match(/^\/trips\/(\d+)/)?.[1]) || undefined
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <nav className="mobile-appbar" aria-label={t('mobileNav.label')}>
      <Link href="/" className={isActive('/') ? 'active' : ''} aria-current={isActive('/') ? 'page' : undefined}>
        <Home aria-hidden="true" /><span>{t('mobileNav.home')}</span>
      </Link>
      <Link href="/trips" className={isActive('/trips') ? 'active' : ''} aria-current={isActive('/trips') ? 'page' : undefined}>
        <MapPin aria-hidden="true" /><span>{t('mobileNav.trips')}</span>
      </Link>

      <button type="button" className="mobile-appbar-fab" aria-label={t('mobileNav.checkinLabel')} onClick={() => openQuickCheckIn(routeTrip ?? activeTripId ?? undefined, undefined, { camera: !readOnly })}>
        <span className="mobile-appbar-fab-ring"><Camera aria-hidden="true" /></span>
        <span>{t('mobileNav.checkin')}</span>
      </button>

      <Link href="/explore" className={isActive('/explore') ? 'active' : ''} aria-current={isActive('/explore') ? 'page' : undefined}>
        <Compass aria-hidden="true" /><span>{t('nav.explore')}</span>
      </Link>
      <Link href="/profile" className={isActive('/profile') ? 'active' : ''} aria-current={isActive('/profile') ? 'page' : undefined}>
        <UserRound aria-hidden="true" /><span>{t('mobileNav.me')}</span>
      </Link>
    </nav>
  )
}
