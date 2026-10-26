'use client'

/**
 * 通知中心：后端没有独立通知表，这里由真实业务数据推导（成就解锁、视频渲染、分享访问、
 * 行程日期、免费额度），已读状态存在本地。不使用任何假数据。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Clock3, Film, Share2, Trophy, TriangleAlert } from 'lucide-react'
import { relativeTime, toDate, localDateKey } from '@/lib/time'
import { tr } from '@/i18n'
import { useT } from '@/components/common/PreferencesProvider'
import type { AchievementView, ShareLinkView, TripSummary, TripView, UserView, VideoProjectView } from '@/services/tabitrace-api'

export type NotificationItem = { id: string; icon: 'trophy' | 'film' | 'share' | 'clock' | 'warn'; title: string; body: string; at: string | null; href: string }

export function buildNotifications(input: {
  trip: TripView | null
  summary: TripSummary | null
  achievements: AchievementView[]
  videos: VideoProjectView[]
  shares: ShareLinkView[]
  /** 设置中心“通知”里的分类开关；未设置的分类默认显示 */
  prefs?: Pick<UserView, 'notifyTripReminder' | 'notifyStory' | 'notifyAchievement' | 'notifyShare'> | null
}): NotificationItem[] {
  const { trip, summary, prefs } = input
  const achievements = prefs?.notifyAchievement === false ? [] : input.achievements
  const videos = prefs?.notifyStory === false ? [] : input.videos
  const shares = prefs?.notifyShare === false ? [] : input.shares
  const tripReminder = prefs?.notifyTripReminder !== false
  const items: NotificationItem[] = []
  if (!trip) return items

  achievements.filter(a => a.earned && a.earnedAt).forEach(a => {
    items.push({ id: `ach-${a.id}`, icon: 'trophy', title: tr('notify.achievementTitle', { name: a.name }), body: a.description || tr('notify.achievementBody'), at: a.earnedAt!, href: `/trips/${trip.id}/achievements` })
  })

  videos.forEach(v => {
    if (v.status === 'COMPLETED' && v.completedAt) {
      items.push({ id: `video-${v.id}`, icon: 'film', title: tr('notify.storyDoneTitle'), body: tr('notify.storyDoneBody', { template: v.templateCode, photos: v.photoIds.length }), at: v.completedAt, href: `/trips/${trip.id}/video` })
    }
    if (v.status === 'FAILED') {
      items.push({ id: `video-fail-${v.id}`, icon: 'warn', title: tr('notify.storyFailTitle'), body: v.errorMessage || tr('notify.storyFailBody'), at: v.createdAt, href: `/trips/${trip.id}/video` })
    }
  })

  shares.filter(s => s.status === 'ACTIVE' && s.viewCount > 0).forEach(s => {
    items.push({ id: `share-${s.id}`, icon: 'share', title: tr('notify.shareTitle', { count: s.viewCount }), body: tr('notify.shareBody'), at: s.createdAt, href: `/trips/${trip.id}/share` })
  })

  const today = localDateKey(new Date())
  if (tripReminder && trip.status !== 'ARCHIVED' && trip.status !== 'COMPLETED') {
    if (today < trip.startDate) items.push({ id: `trip-soon-${trip.id}`, icon: 'clock', title: tr('notify.tripSoonTitle', { title: trip.title }), body: tr('notify.tripSoonBody', { date: trip.startDate }), at: trip.createdAt || null, href: `/trips/${trip.id}` })
    else if (today > trip.endDate) items.push({ id: `trip-end-${trip.id}`, icon: 'clock', title: tr('notify.tripEndTitle', { title: trip.title }), body: tr('notify.tripEndBody'), at: trip.createdAt || null, href: `/trips/${trip.id}/summary` })
  }

  // 免费额度提醒不受分类开关影响
  if (trip.planType === 'FREE' && summary) {
    if (summary.places >= 8) items.push({ id: `limit-place-${trip.id}`, icon: 'warn', title: tr('notify.limitPlaceTitle'), body: tr('notify.limitPlaceBody', { count: summary.places }), at: null, href: '/pricing' })
    if (summary.photos >= 8) items.push({ id: `limit-photo-${trip.id}`, icon: 'warn', title: tr('notify.limitPhotoTitle'), body: tr('notify.limitPhotoBody', { count: summary.photos }), at: null, href: '/pricing' })
  }

  return items.sort((a, b) => (toDate(b.at)?.getTime() || 0) - (toDate(a.at)?.getTime() || 0)).slice(0, 12)
}

const READ_KEY = 'tabitrace-notifications-read-at'
const ICONS = { trophy: Trophy, film: Film, share: Share2, clock: Clock3, warn: TriangleAlert }

export function NotificationCenter({ items }: { items: NotificationItem[] }) {
  const router = useRouter()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [readAt, setReadAt] = useState<number>(0)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setReadAt(Number(localStorage.getItem(READ_KEY) || 0)) }, [])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const unread = useMemo(() => items.filter(i => {
    const t = toDate(i.at)?.getTime()
    return t ? t > readAt : readAt === 0
  }).length, [items, readAt])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) { const now = Date.now(); localStorage.setItem(READ_KEY, String(now)); setReadAt(now) }
  }

  return (
    <div className="relative" ref={ref}>
      <button className="icon-button" onClick={toggle} aria-label={unread ? t('notify.buttonUnread', { count: unread }) : t('notify.button')}>
        <Bell size={17} />
        {unread > 0 && <i className="icon-dot" />}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label={t('notify.list')}>
          <div className="popover-head"><b>{t('notify.title')}</b><span>{t('notify.count', { count: items.length })}</span></div>
          {items.length === 0 ? (
            <p className="popover-empty">{t('notify.empty')}</p>
          ) : (
            <div className="popover-list">
              {items.map(item => {
                const Icon = ICONS[item.icon]
                return (
                  <button key={item.id} onClick={() => { setOpen(false); router.push(item.href) }}>
                    <span className={`popover-icon ${item.icon === 'warn' ? 'warn' : ''}`}><Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <b>{item.title}</b>
                      <small>{item.body}</small>
                    </span>
                    <time>{relativeTime(item.at)}</time>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
