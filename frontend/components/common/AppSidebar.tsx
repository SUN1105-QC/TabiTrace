'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Compass, Crown, Film, Home, Images, MapPinned, Plus, Settings, Sparkles, Trophy, X
} from 'lucide-react'
import { useT } from '@/components/common/PreferencesProvider'
import { BrandLogo } from '@/components/common/Brand'
import type { MessageKey } from '@/i18n'

export type SidebarBadges = { explore?: boolean; memories?: boolean }

type Item = { href: string; label: MessageKey; icon: any; badge?: 'explore' | 'memories' }

export function sidebarItems(activeTripId: number | null): { main: Item[]; secondary: Item[] } {
  const trip = (suffix: string) => (activeTripId ? `/trips/${activeTripId}${suffix}` : '/trips')
  return {
    main: [
      { href: '/', label: 'nav.home', icon: Home },
      { href: '/trips', label: 'nav.myTrips', icon: MapPinned },
      { href: '/trips/new', label: 'nav.createTrip', icon: Plus },
      { href: trip('/map'), label: 'nav.mapCheckin', icon: Compass },
      { href: trip('/gallery'), label: 'nav.photos', icon: Images },
      { href: trip('/video'), label: 'nav.travelStory', icon: Film },
      { href: '/explore/tokyo', label: 'nav.explore', icon: Sparkles, badge: 'explore' }
    ],
    secondary: [
      { href: '/memories', label: 'nav.memories', icon: Images, badge: 'memories' },
      { href: trip('/achievements'), label: 'nav.achievements', icon: Trophy },
      { href: '/profile', label: 'nav.settings', icon: Settings }
    ]
  }
}

function SidebarArtwork() {
  const t = useT()
  return (
    <svg className="sidebar-artwork" viewBox="0 0 220 96" role="img" aria-label={t('nav.artwork')}>
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
  const t = useT()
  const { main, secondary } = sidebarItems(activeTripId)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isActive = ({ href, label }: Item) => {
    if (href === '/') return pathname === '/'
    // 没有当前旅行时，地图 / 照片 / Travel Story / 成就会回落到旅行列表；这时只高亮“我的旅行”本身
    if (href === '/trips') return label === 'nav.myTrips' && pathname === '/trips'
    return pathname.startsWith(href.split('?')[0])
  }

  const link = (item: Item) => {
    const { href, label, icon: Icon, badge } = item
    return (
    <Link key={label} href={href} className={isActive(item) ? 'active' : ''} onClick={onClose}>
      <Icon aria-hidden="true" />
      <span>{t(label)}</span>
      {mounted && badge && badges[badge] ? <i className="nav-dot" aria-label={t('nav.newContent')} /> : null}
    </Link>
    )
  }

  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}
      <aside className={`workspace-sidebar${open ? ' is-open' : ''}`}>
        <div className="sidebar-top">
          <Link href="/" className="workspace-brand" onClick={onClose}>
            <BrandLogo height={52} className="workspace-logo" />
          </Link>
          {onClose && <button className="sidebar-close" onClick={onClose} aria-label={t('nav.closeNav')}><X size={18} /></button>}
        </div>

        <nav className="workspace-nav" aria-label={t('nav.mainNav')}>{main.map(link)}</nav>
        <div className="sidebar-divider" />
        <nav className="workspace-nav" aria-label={t('nav.secondaryNav')}>{secondary.map(link)}</nav>

        <div className="workspace-sidebar-bottom">
          <Link href="/pricing" className="sidebar-pro" onClick={onClose}>
            <span className="sidebar-pro-icon"><Crown size={16} /></span>
            <span><b>{t('nav.upgradePro')}</b><small>{t('nav.upgradeProSub')}</small></span>
          </Link>
          <p className="sidebar-tagline">{t('nav.taglineTop')}<br />{t('nav.taglineBottom')}</p>
          <SidebarArtwork />
        </div>
      </aside>
    </>
  )
}
