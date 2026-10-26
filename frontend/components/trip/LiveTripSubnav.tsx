'use client'

/**
 * 旅行子页面导航：始终单行，放不下时横向滚动（不再在手机上折成两行）。
 * < 768px 使用短标签；当前页标记 aria-current，并自动滚到可见位置。
 * sticky 仅在旅行详情移动端使用：滚动时 Tabs 吸在顶部。
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useT } from '@/components/common/PreferencesProvider'
import type { MessageKey } from '@/i18n'

const items: [suffix: string, label: MessageKey, short: MessageKey][] = [
  ['', 'tripNav.overview', 'tripNav.overview'], ['/map', 'tripNav.map', 'tripNav.mapShort'], ['/gallery', 'tripNav.photos', 'tripNav.photos'], ['/achievements', 'tripNav.achievements', 'tripNav.achievements'],
  ['/summary', 'tripNav.summary', 'tripNav.summary'], ['/share', 'tripNav.share', 'tripNav.shareShort'], ['/video', 'tripNav.video', 'tripNav.videoShort']
]

export function LiveTripSubnav({ tripId, sticky = false }: { tripId: number; sticky?: boolean }) {
  const pathname = usePathname()
  const t = useT()
  const nav = useRef<HTMLElement | null>(null)
  useEffect(() => { localStorage.setItem('tabitrace-live-trip-id', String(tripId)) }, [tripId])
  useEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>('[aria-current="page"]')
    const box = nav.current
    if (!el || !box || box.scrollWidth <= box.clientWidth) return
    if (el.offsetLeft + el.offsetWidth > box.clientWidth) box.scrollLeft = el.offsetLeft - 16
  }, [pathname])

  return <nav ref={nav} aria-label={t('tripNav.label')} className={`trip-subnav relative mt-7 flex flex-nowrap gap-2 overflow-x-auto pb-2${sticky ? ' is-sticky' : ''}`}>
    {items.map(([suffix, label, short]) => {
      const href = `/trips/${tripId}${suffix}`
      const active = suffix ? pathname.startsWith(href) : pathname === href
      return <Link key={suffix} href={href} aria-current={active ? 'page' : undefined} className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-xs transition sm:px-4 ${active ? 'bg-ink text-white' : 'border border-black/10 bg-white/50 text-black/55 hover:border-vermilion/30'}`}>
        <span className="md:hidden">{t(short)}</span><span className="hidden md:inline">{t(label)}</span>
      </Link>
    })}
  </nav>
}
