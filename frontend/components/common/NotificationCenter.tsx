'use client'

/**
 * 通知中心：后端没有独立通知表，这里由真实业务数据推导（成就解锁、视频渲染、分享访问、
 * 行程日期、免费额度），已读状态存在本地。不使用任何假数据。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Clock3, Film, Share2, Trophy, TriangleAlert } from 'lucide-react'
import { relativeTime, toDate, localDateKey } from '@/lib/time'
import type { AchievementView, ShareLinkView, TripSummary, TripView, VideoProjectView } from '@/services/tabitrace-api'

export type NotificationItem = { id: string; icon: 'trophy' | 'film' | 'share' | 'clock' | 'warn'; title: string; body: string; at: string | null; href: string }

export function buildNotifications(input: {
  trip: TripView | null
  summary: TripSummary | null
  achievements: AchievementView[]
  videos: VideoProjectView[]
  shares: ShareLinkView[]
}): NotificationItem[] {
  const { trip, summary, achievements, videos, shares } = input
  const items: NotificationItem[] = []
  if (!trip) return items

  achievements.filter(a => a.earned && a.earnedAt).forEach(a => {
    items.push({ id: `ach-${a.id}`, icon: 'trophy', title: `解锁成就「${a.name}」`, body: a.description || '继续记录可以解锁更多成就', at: a.earnedAt!, href: `/trips/${trip.id}/achievements` })
  })

  videos.forEach(v => {
    if (v.status === 'COMPLETED' && v.completedAt) {
      items.push({ id: `video-${v.id}`, icon: 'film', title: 'Travel Story 生成完成', body: `${v.templateCode} 模板 · ${v.photoIds.length} 张照片`, at: v.completedAt, href: `/trips/${trip.id}/video` })
    }
    if (v.status === 'FAILED') {
      items.push({ id: `video-fail-${v.id}`, icon: 'warn', title: 'Travel Story 生成失败', body: v.errorMessage || '可以在旅行视频页重新生成', at: v.createdAt, href: `/trips/${trip.id}/video` })
    }
  })

  shares.filter(s => s.status === 'ACTIVE' && s.viewCount > 0).forEach(s => {
    items.push({ id: `share-${s.id}`, icon: 'share', title: `分享链接被访问 ${s.viewCount} 次`, body: '有人看过你的旅行故事', at: s.createdAt, href: `/trips/${trip.id}/share` })
  })

  const today = localDateKey(new Date())
  if (trip.status !== 'ARCHIVED' && trip.status !== 'COMPLETED') {
    if (today < trip.startDate) items.push({ id: `trip-soon-${trip.id}`, icon: 'clock', title: `「${trip.title}」即将开始`, body: `出发日期 ${trip.startDate}`, at: trip.createdAt || null, href: `/trips/${trip.id}` })
    else if (today > trip.endDate) items.push({ id: `trip-end-${trip.id}`, icon: 'clock', title: `「${trip.title}」已经结束`, body: '可以标记完成并生成旅行成果', at: trip.createdAt || null, href: `/trips/${trip.id}/summary` })
  }

  if (trip.planType === 'FREE' && summary) {
    if (summary.places >= 8) items.push({ id: `limit-place-${trip.id}`, icon: 'warn', title: '免费打卡额度接近上限', body: `已记录 ${summary.places} 个地点，上限 10 个`, at: null, href: '/pricing' })
    if (summary.photos >= 8) items.push({ id: `limit-photo-${trip.id}`, icon: 'warn', title: '免费照片额度接近上限', body: `已保存 ${summary.photos} 张照片，上限 10 张`, at: null, href: '/pricing' })
  }

  return items.sort((a, b) => (toDate(b.at)?.getTime() || 0) - (toDate(a.at)?.getTime() || 0)).slice(0, 12)
}

const READ_KEY = 'tabitrace-notifications-read-at'
const ICONS = { trophy: Trophy, film: Film, share: Share2, clock: Clock3, warn: TriangleAlert }

export function NotificationCenter({ items }: { items: NotificationItem[] }) {
  const router = useRouter()
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
      <button className="icon-button" onClick={toggle} aria-label={unread ? `通知，${unread} 条未读` : '通知'}>
        <Bell size={17} />
        {unread > 0 && <i className="icon-dot" />}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="通知列表">
          <div className="popover-head"><b>通知</b><span>{items.length} 条</span></div>
          {items.length === 0 ? (
            <p className="popover-empty">还没有新的旅行动态。完成一次打卡后，这里会出现提醒。</p>
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
