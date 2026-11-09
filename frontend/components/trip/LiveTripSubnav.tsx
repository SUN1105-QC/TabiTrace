'use client'

/**
 * 旅行子页面导航：始终单行，放不下时横向滚动（不再在手机上折成两行）。
 * < 768px 使用短标签；当前页标记 aria-current，并自动滚到可见位置。
 * sticky 仅在旅行详情移动端使用：滚动时 Tabs 吸在顶部。
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { tripApi, type TripView } from '@/services/tabitrace-api'
import { useT } from '@/components/common/PreferencesProvider'
import type { MessageKey } from '@/i18n'
import { rememberActiveTrip } from '@/lib/active-trip'

const items: [suffix: string, label: MessageKey, short: MessageKey][] = [
  ['/map', 'tripNav.map', 'tripNav.mapShort'], ['/gallery', 'tripNav.photos', 'tripNav.photos'],
  ['/share', 'tripNav.share', 'tripNav.shareShort'], ['/video', 'tripNav.video', 'tripNav.videoShort']
]

export function LiveTripSubnav({ tripId, sticky = false }: { tripId: number; sticky?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()
  const nav = useRef<HTMLElement | null>(null)
  const [trips, setTrips] = useState<TripView[]>([])
  useEffect(() => { let alive = true; tripApi.list().then(rows => { if (alive) setTrips(rows) }).catch(() => {}); return () => { alive = false } }, [])
  const trip = trips.find(row => row.id === tripId)
  useEffect(() => { rememberActiveTrip(tripId) }, [tripId])
  useEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>('[aria-current="page"]')
    const box = nav.current
    if (!el || !box || box.scrollWidth <= box.clientWidth) return
    if (el.offsetLeft + el.offsetWidth > box.clientWidth) box.scrollLeft = el.offsetLeft - 16
  }, [pathname])

  return <div className={`trip-workspace-nav${sticky ? ' is-sticky' : ''}`}>
    <div className="trip-context">
      <label><span>当前旅行</span><select aria-label="切换当前旅行" value={tripId} onChange={e => {
        const id = Number(e.target.value)
        rememberActiveTrip(id)
        const suffix = items.find(([s]) => pathname.includes(s))?.[0] ?? '/map'
        router.push(`/trips/${id}${suffix}`)
      }}>
        {!trip && <option value={tripId}>旅行 #{tripId}</option>}
        {trips.map(row => <option key={row.id} value={row.id}>{row.title}{row.status === 'ARCHIVED' ? ' · 已归档' : ''}</option>)}
      </select></label>
      {trip && <p>{trip.startDate} — {trip.endDate}<span>{trip.status === 'ARCHIVED' ? '已归档 · 只读' : trip.status === 'COMPLETED' ? '已完成' : trip.status === 'ONGOING' ? '进行中' : '准备中'}</span></p>}
    </div>
    <nav ref={nav} aria-label={t('tripNav.label')} className="trip-subnav relative flex flex-nowrap gap-2 overflow-x-auto pb-2">
    {items.map(([suffix, label, short]) => {
      const href = `/trips/${tripId}${suffix}`
      const active = pathname === href || pathname.startsWith(href + '/')
      return <Link key={suffix} href={href} aria-current={active ? 'page' : undefined} className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-xs transition sm:px-4 ${active ? 'bg-ink text-white' : 'border border-black/10 bg-white/50 text-black/55 hover:border-vermilion/30'}`}>
        <span className="md:hidden">{suffix === '/share' ? '导出分享' : t(short)}</span><span className="hidden md:inline">{suffix === '/share' ? '导出与分享' : t(label)}</span>
      </Link>
    })}
  </nav></div>
}
