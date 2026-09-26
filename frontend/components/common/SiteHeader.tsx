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
import { USER_UPDATED_EVENT, tripApi, userApi, type TripView, type UserView } from '@/services/tabitrace-api'
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
  const [scrolled, setScrolled] = useState(false)
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
      setNotifications(buildNotifications({ trip, summary, achievements, videos, shares, prefs: me }))
    } catch { /* 外壳数据失败不阻塞页面本身 */ }
  }, [])

  useEffect(() => { if (mounted && isAppRoute) load() }, [mounted, isAppRoute, pathname, checkinVersion, load])

  // 设置中心保存资料、头像或通知偏好后，立即刷新外壳（头像、昵称、通知分类），不整页刷新
  useEffect(() => {
    const onUser = (e: Event) => { const u = (e as CustomEvent<UserView>).detail; if (u) setUser(u); void load() }
    window.addEventListener(USER_UPDATED_EVENT, onUser)
    return () => window.removeEventListener(USER_UPDATED_EVENT, onUser)
  }, [load])

  // 公共页面：滚动后头部加一点背景与模糊
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
    // 公共导航：未登录不出现“我的旅行”（受保护页面）；开始旅行进入注册，注册后直接创建旅行
    const items: [string, string][] = [['/explore', '探索'], ['/#features', '功能'], ['/explore/tokyo', '东京精选'], ['/pricing', 'Trip Pro']]
    const actions: [string, string, boolean][] = session
      ? [['/trips', '我的旅行', false], ['/', '进入旅迹', true]]
      : [['/login', '登录', false], ['/register', '开始旅行', true]]
    return (
      <header className={`public-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="public-header-inner">
          <Link href="/" aria-label="旅迹 TabiTrace 首页" className="flex min-h-11 items-center"><Brand /></Link>
          <nav className="hidden items-center gap-7 md:flex">
            {items.map(([href, label]) => <Link key={href} href={href} className="text-sm text-black/60 transition hover:text-warm">{label}</Link>)}
            <span className="h-5 w-px bg-black/10" aria-hidden="true" />
            {actions.map(([href, label, primary]) => <Link key={href} href={href} className={primary ? 'warm-button' : 'text-sm font-semibold text-black/70 hover:text-warm'}>{label}</Link>)}
          </nav>
          <button onClick={() => setPublicMenu(v => !v)} className="public-menu-btn grid h-11 w-11 place-items-center rounded-xl border border-black/10 md:hidden" aria-label={publicMenu ? '关闭菜单' : '打开菜单'} aria-expanded={publicMenu}>
            {publicMenu ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
        {publicMenu && (
          <div className="public-menu-panel border-t border-black/5 bg-paper px-5 py-4 md:hidden">
            <div className="grid gap-2">
              {items.map(([href, label]) => <Link key={href} href={href} onClick={() => setPublicMenu(false)} className="rounded-xl px-3 py-3 text-sm hover:bg-orangeSoft">{label}</Link>)}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {actions.map(([href, label, primary]) => <Link key={href} href={href} onClick={() => setPublicMenu(false)} className={primary ? 'rounded-xl bg-warm px-3 py-3 text-center text-sm font-semibold text-white' : 'rounded-xl border border-black/10 px-3 py-3 text-center text-sm'}>{label}</Link>)}
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
      {/* 旅行详情及其子页面在手机上使用紧凑顶栏，把首屏留给旅行本身 */}
      <MobileTopBar user={user} notifications={notifications} onOpenSearch={() => setSearchOpen(true)} compact={/^\/trips\/\d+(\/|$)/.test(pathname)} />
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
