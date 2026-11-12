'use client'

import Link from 'next/link'
import { Briefcase, CalendarDays, ChevronRight, Film, Image as ImageIcon, MapPin } from 'lucide-react'
import type { Activity } from '@/hooks/useHomeData'
import { relativeTime } from '@/lib/time'

const ICONS = { checkin: MapPin, photo: ImageIcon, itinerary: CalendarDays, video: Film, trip: Briefcase }

export function RecentActivities({ activities, tripId }: { activities: Activity[]; tripId: number | null }) {
  return (
    <section className="hw-section hw-activities">
      <header>
        <h2>最近活动</h2>
        <Link href={tripId ? `/trips/${tripId}/map` : '/trips'}>查看全部<ChevronRight size={14} /></Link>
      </header>

      {activities.length === 0 ? (
        <div className="hw-activity-empty">
          <b>还没有旅行记录</b>
          <p>完成一次打卡后，这里会出现你的旅行动态。</p>
        </div>
      ) : (
        <ul>
          {activities.map(item => {
            const Icon = ICONS[item.kind] || MapPin
            return (
              <li key={item.id}>
                <Link href={item.href}>
                  <span className="hw-tile"><Icon size={18} /></span>
                  <span className="hw-activity-body">
                    <b title={item.title}>{item.title}</b>
                    {item.detail && <small>{item.detail}</small>}
                  </span>
                  <time>{relativeTime(item.at)}</time>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
