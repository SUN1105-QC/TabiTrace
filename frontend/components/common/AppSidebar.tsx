'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Compass, Crown, Film, Home, Images, MapPinned, Plus, Settings, Sparkles, Trophy, X
} from 'lucide-react'

export type SidebarBadges = { explore?: boolean; memories?: boolean }

type Item = { href: string; label: string; icon: any; badge?: 'explore' | 'memories' }

export function sidebarItems(activeTripId: number | null): { main: Item[]; secondary: Item[] } {
  const trip = (suffix: string) => (activeTripId ? `/trips/${activeTripId}${suffix}` : '/trips')
  return {
    main: [
      { href: '/', label: '首页', icon: Home },
      { href: '/trips', label: '我的旅行', icon: MapPinned },
      { href: '/trips/new', label: '创建旅行', icon: Plus },
      { href: trip('/map'), label: '地图与打卡', icon: Compass },
      { href: trip('/gallery'), label: '照片与精选', icon: Images },
      { href: trip('/video'), label: 'Travel Story', icon: Film },
      { href: '/explore/tokyo', label: '推荐探索', icon: Sparkles, badge: 'explore' }
    ],
    secondary: [
      { href: '/memories', label: '旅行回忆', icon: Images, badge: 'memories' },
      { href: trip('/achievements'), label: '我的成就', icon: Trophy },
      { href: '/profile', label: '个人设置', icon: Settings }
    ]
  }
}

function SidebarArtwork() {
  return (
    <svg className="sidebar-artwork" viewBox="0 0 220 96" role="img" aria-label="旅行插画">
      <defs>
        <linearGradient id="tt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6DFC9" stopOpacity=".55" />
          <stop offset="100%" stopColor="#F6DFC9" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="220" height="96" fill="url(#tt-sky)" />
      <path d="M0 78 L46 42 L74 66 L104 34 L150 78 Z" fill="#E7C8A8" opacity=".55" />
      <path d="M104 34 L118 46 L110 46 L104 40 L98 46 L90 46 Z" fill="#FFFDF9" opacity=".9" />
      <path d="M120 82 L220 82" stroke="#E2C6AC" strokeWidth="1.5" opacity=".7" />
      <g stroke="#D98552" strokeWidth="3.4" fill="none" opacity=".85">
        <path d="M150 82 L150 52" />
        <path d="M186 82 L186 52" />
        <path d="M142 54 L194 54" />
        <path d="M146 62 L190 62" />
      </g>
      <circle cx="44" cy="24" r="7" fill="#E9A15E" opacity=".5" />
    </svg>
  )
}

export function AppSidebar({ activeTripId, badges, open, onClose }: { activeTripId: number | null; badges: SidebarBadges; open?: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const { main, secondary } = sidebarItems(activeTripId)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/trips') return pathname === '/trips'
    return pathname.startsWith(href.split('?')[0])
  }

  const link = ({ href, label, icon: Icon, badge }: Item) => (
    <Link key={label} href={href} className={isActive(href) ? 'active' : ''} onClick={onClose}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
      {mounted && badge && badges[badge] ? <i className="nav-dot" aria-label="有新内容" /> : null}
    </Link>
  )

  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}
      <aside className={`workspace-sidebar${open ? ' is-open' : ''}`}>
        <div className="sidebar-top">
          <Link href="/" className="workspace-brand" onClick={onClose}>
            <span className="workspace-mark">旅</span>
            <span><b>旅迹</b><small>TabiTrace</small></span>
          </Link>
          {onClose && <button className="sidebar-close" onClick={onClose} aria-label="关闭导航"><X size={18} /></button>}
        </div>

        <nav className="workspace-nav" aria-label="主导航">{main.map(link)}</nav>
        <div className="sidebar-divider" />
        <nav className="workspace-nav" aria-label="次级导航">{secondary.map(link)}</nav>

        <div className="workspace-sidebar-bottom">
          <Link href="/pricing" className="sidebar-pro" onClick={onClose}>
            <span className="sidebar-pro-icon"><Crown size={16} /></span>
            <span><b>升级 Trip Pro</b><small>解锁更多精彩功能</small></span>
          </Link>
          <p className="sidebar-tagline">旅行，<br />让每一次出发都有意义。</p>
          <SidebarArtwork />
        </div>
      </aside>
    </>
  )
}
