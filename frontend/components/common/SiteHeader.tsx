'use client'

/**
 * 应用外壳：公开页渲染顶部品牌导航，登录后的工作区渲染
 * 左侧 Sidebar + 顶部 Header + 移动端底部导航 + 快速打卡悬浮按钮。
 * 所有页面共用这一份，新首页与既有页面保持同一套导航。
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Brand } from './Brand'
import { AppSidebar } from './AppSidebar'
import { AppHeader } from './AppHeader'
import { GlobalSearch } from './GlobalSearch'
import { MobileTopBar } from '@/components/mobile/MobileTopBar'
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav'
import { buildNotifications, type NotificationItem } from './NotificationCenter'
import { hasSession } from '@/services/api'
import { tripApi, userApi, type TripView, type UserView } from '@/services/tabitrace-api'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'

const APP_PREFIXES = ['/trips', '/explore', '/pricing', '/profile', '/memories']
const ACTIVE_TRIP_KEY = 'tabitrace-live-trip-id'

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { checkinVersion } = useQuickCheckIn()
  const [session, setSession] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [publicMenu, setPublicMenu] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [user, setUser] = useState<UserView | null>(null)
  const [trips, setTrips] = useState<TripView[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  useEffect(() => { setMounted(true); setSession(hasSession()) }, [pathname])

  const isAppRoute = pathname === '/' ? session : APP_PREFIXES.some(p => pathname.startsWith(p))

  const activeTripId = useMemo(() => {
    const stored = typeof window === 'undefined' ? 0 : Number(localStorage.getItem(ACTIVE_TRIP_KEY) || 0)
    if (stored && trips.some(t => t.id === stored)) return stored
    return trips.find(t => t.status !== 'ARCHIVED')?.id ?? trips[0]?.id ?? null
  }, [trips, mounted, checkinVersion])

  // 工作区外壳所需的轻量数据：当前用户 + 旅行列表 + 通知（通知基于当前旅行真实数据推导）
  const load = useCallback(async () => {
    if (!hasSession()) { setUser(null); setTrips([]); setNotifications([]); return }
    try {
      const [me, rows] = await Promise.all([userApi.me().catch(() => null), tripApi.list().catch(() => [] as TripView[])])
      setUser(me); setTrips(rows)
      const stored = Number(localStorage.getItem(ACTIVE_TRIP_KEY) || 0)
      const trip = rows.find(t => t.id === stored) || rows.find(t => t.status !== 'ARCHIVED') || rows[0] || null
      if (!trip) { setNotifications([]); return }
      const [summary, achievements, videos, shares] = await Promise.all([
        tripApi.summary(trip.id).catch(() => null),
        tripApi.achievements(trip.id).catch(() => []),
        tripApi.videos(trip.id).catch(() => []),
        tripApi.shares(trip.id).catch(() => [])
      ])
      setNotifications(buildNotifications({ trip, summary, achievements, videos, shares }))
    } catch { /* 外壳数据失败不阻塞页面本身 */ }
  }, [])

  useEffect(() => { if (mounted && isAppRoute) load() }, [mounted, isAppRoute, pathname, checkinVersion, load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true) }
      if (e.key === 'Escape') { setSearchOpen(false); setDrawer(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const isProtected = pathname.startsWith('/trips') || pathname.startsWith('/profile') || pathname.startsWith('/memories')
    if (isProtected && mounted && !hasSession()) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
  }, [pathname, router, mounted])

  const badges = useMemo(() => ({
    explore: trips.length > 0,
    memories: trips.some(t => t.status === 'COMPLETED' || t.status === 'ARCHIVED')
  }), [trips])

  if (!isAppRoute) {
    const items: [string, string][] = [['/explore', '探索'], ['/trips', '我的旅行'], ['/explore/tokyo', '东京精选'], ['/pricing', 'Pro']]
    return (
      <header className="public-header">
        <div className="public-header-inner">
          <Link href="/" aria-label="旅迹 TabiTrace 首页"><Brand /></Link>
          <nav className="hidden items-center gap-7 md:flex">
            {items.map(([href, label]) => <Link key={href} href={href} className="text-sm text-black/60 transition hover:text-warm">{label}</Link>)}
            <Link href={session ? '/profile' : '/login'} className="text-sm text-black/60">{session ? '我的' : '登录'}</Link>
            <Link href={session ? '/trips/new' : '/login?next=%2Ftrips%2Fnew'} className="warm-button">开始旅行</Link>
          </nav>
          <button onClick={() => setPublicMenu(v => !v)} className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 md:hidden" aria-label="菜单">
            {publicMenu ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
        {publicMenu && (
          <div className="border-t border-black/5 bg-paper px-5 py-4 md:hidden">
            <div className="grid gap-2">
              {items.map(([href, label]) => <Link key={href} href={href} onClick={() => setPublicMenu(false)} className="rounded-xl px-3 py-3 text-sm hover:bg-orangeSoft">{label}</Link>)}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/login" className="rounded-xl border border-black/10 px-3 py-3 text-center text-sm">登录</Link>
                <Link href="/login?next=%2Ftrips%2Fnew" className="rounded-xl bg-warm px-3 py-3 text-center text-sm text-white">开始旅行</Link>
              </div>
            </div>
          </div>
        )}
      </header>
    )
  }

  return (
    <>
      <AppSidebar activeTripId={activeTripId} badges={badges} open={drawer} onClose={() => setDrawer(false)} />
      <AppHeader
        showTitle={pathname !== '/'}
        title={titleFor(pathname)}
        user={user}
        notifications={notifications}
        activeTripId={activeTripId}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenMenu={() => setDrawer(true)}
      />
      <MobileTopBar user={user} notifications={notifications} onOpenSearch={() => setSearchOpen(true)} />
      <MobileBottomNav activeTripId={activeTripId} />
      {searchOpen && <GlobalSearch activeTripId={activeTripId} onClose={() => setSearchOpen(false)} />}
      <div className="workspace-spacer" />
    </>
  )
}

function titleFor(pathname: string) {
  if (pathname === '/') return '首页'
  if (pathname === '/trips') return '我的旅行'
  if (pathname === '/trips/new') return '创建旅行'
  if (pathname.includes('/map')) return '旅行地图与打卡'
  if (pathname.includes('/gallery') || pathname.includes('/photos')) return '照片与精选'
  if (pathname.includes('/achievements')) return '旅行成就'
  if (pathname.includes('/summary')) return '旅行总结'
  if (pathname.includes('/share')) return '分享成果'
  if (pathname.includes('/video')) return 'Travel Story'
  if (pathname.startsWith('/explore/tokyo')) return '东京官方探索'
  if (pathname.startsWith('/explore')) return '官方城市探索'
  if (pathname.startsWith('/memories')) return '旅行回忆'
  if (pathname.startsWith('/pricing')) return 'Trip Pro'
  if (pathname.startsWith('/profile')) return '个人设置'
  return '旅迹 TabiTrace'
}
