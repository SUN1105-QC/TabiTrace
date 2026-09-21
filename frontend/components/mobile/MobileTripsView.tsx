'use client'

/**
 * 移动端「旅程」页：当前旅程 + 创建新旅程 + 全部旅程。
 * 当前旅程直接复用首页的 CurrentTripCard，保证两处视觉与进度算法一致。
 */

import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'
import { CurrentTripCard } from '@/components/home/CurrentTripCard'
import type { ItineraryView, TripSummary, TripView } from '@/services/tabitrace-api'
import { daysBetween } from '@/lib/time'

const STATUS_TEXT: Record<string, string> = { PLANNING: '准备中', ONGOING: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档' }

export function MobileTripsView({
  trips, summaries, current, itinerary
}: {
  trips: TripView[]
  summaries: Record<number, TripSummary>
  current: TripView | null
  itinerary: ItineraryView[]
}) {
  const ongoing = trips.filter(t => t.status === 'ONGOING' || t.status === 'PLANNING').length

  return (
    <div className="only-mobile m-trips">
      <section className="m-trips-head">
        <h1>我的旅程</h1>
        <p>{trips.length === 0 ? '还没有旅行，先创建一段吧' : `共 ${trips.length} 段旅行 · ${ongoing} 段进行中`}</p>
      </section>

      <Link href="/trips/new" className="m-create-card">
        <span className="m-create-icon"><Plus size={20} /></span>
        <span className="m-create-body">
          <b>创建新旅程</b>
          <small>选择目的地和日期，开始记录</small>
        </span>
        <ChevronRight size={18} className="m-create-arrow" />
      </Link>

      {current && (
        <CurrentTripCard
          title="当前旅程"
          manageHref={`/trips/${current.id}`}
          manageLabel="旅行详情"
          trip={current}
          summary={summaries[current.id] ?? null}
          itinerary={itinerary}
        />
      )}

      <section className="warm-card home-block">
        <div className="panel-head">
          <h3>全部旅程</h3>
          <Link href="/trips/new" className="panel-link">新建 <Plus size={12} /></Link>
        </div>

        {trips.length === 0 ? (
          <div className="empty-block">
            <p className="empty-title">还没有旅行</p>
            <p className="empty-desc">创建第一段旅行后，地图、时间轴和成果都会从这里开始。</p>
            <Link href="/trips/new" className="warm-button mt-4">创建旅程</Link>
          </div>
        ) : (
          <ul className="m-trip-list">
            {trips.map(t => {
              const s = summaries[t.id]
              const days = s?.days ?? daysBetween(t.startDate, t.endDate) + 1
              return (
                <li key={t.id}>
                  <Link href={`/trips/${t.id}`}>
                    <span className="m-trip-thumb"><img src={t.coverImage || '/images/cover.jpg'} alt={t.title} loading="lazy" /></span>
                    <span className="m-trip-body">
                      <b>{t.title}</b>
                      <small>{t.destinationName} · {t.startDate.replace(/-/g, '.')} - {t.endDate.replace(/-/g, '.')}</small>
                      <span className="m-trip-tags">
                        <i className={t.status === 'ONGOING' ? 'live' : ''}>{STATUS_TEXT[t.status] || t.status}</i>
                        <i>{days} 天</i>
                        <i>{s?.places ?? 0} 地点</i>
                        <i>{s?.photos ?? 0} 照片</i>
                      </span>
                    </span>
                    <ChevronRight size={17} className="m-trip-arrow" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
