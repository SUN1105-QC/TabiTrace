'use client'

import Link from 'next/link'
import { ArrowRight, CalendarDays, Camera, ChevronRight, Film, Images, MapPin, Trophy } from 'lucide-react'
import type { Activity } from '@/hooks/useHomeData'
import { relativeTime } from '@/lib/time'

const ICONS = { checkin: MapPin, photo: Images, itinerary: CalendarDays, video: Film, achievement: Trophy, trip: Camera }

export function RecentActivities({ activities, tripId }: { activities: Activity[]; tripId: number | null }) {
  return (
    <section className="warm-card home-block">
      <div className="panel-head">
        <h3>最近活动</h3>
        <Link href={tripId ? `/trips/${tripId}/map` : '/trips'} className="panel-link">查看全部 <ArrowRight size={12} /></Link>
      </div>

      {activities.length === 0 ? (
        <div className="empty-block">
          <p className="empty-title">还没有旅行记录</p>
          <p className="empty-desc">完成一次打卡后，这里会出现你的旅行动态。</p>
        </div>
      ) : (
        <ul className="activity-list">
          {activities.map((item, index) => {
            const Icon = ICONS[item.kind] || MapPin
            return (
              <li key={item.id}>
                <Link href={item.href}>
                  <span className="activity-thumb">
                    {item.thumbnail
                      ? <img src={item.thumbnail} alt="" loading="lazy" />
                      : <span className="activity-thumb-fallback"><Icon size={18} /></span>}
                    <span className={`activity-icon ${item.kind}`}><Icon size={11} /></span>
                  </span>
                  <span className="activity-body">
                    <b>{item.title}</b>
                    <small>{item.detail}</small>
                  </span>
                  <span className="activity-meta">
                    <time>{relativeTime(item.at)}</time>
                    {index === 0 && <ChevronRight size={14} />}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
