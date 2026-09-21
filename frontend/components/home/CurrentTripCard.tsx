'use client'

import Link from 'next/link'
import { ArrowRight, CalendarDays, MapPin, Map as MapIcon, Users } from 'lucide-react'
import type { ItineraryView, TripSummary, TripView } from '@/services/tabitrace-api'
import { daysBetween, localDateKey } from '@/lib/time'

const STATUS_TEXT: Record<string, string> = { PLANNING: '准备中', ONGOING: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档' }

export function CurrentTripCard({
  trip, summary, itinerary, note,
  title = '当前旅行', manageHref = '/trips', manageLabel = '管理旅行'
}: {
  trip: TripView | null
  summary: TripSummary | null
  itinerary: ItineraryView[]
  note?: string
  title?: string
  manageHref?: string
  manageLabel?: string
}) {
  if (!trip) {
    return (
      <section className="warm-card home-block">
        <div className="panel-head"><h3>{title}</h3></div>
        <div className="empty-block">
          <p className="empty-title">还没有进行中的旅行</p>
          <p className="empty-desc">创建一段新的旅程，从这里开始记录你的故事。</p>
          <Link href="/trips/new" className="warm-button mt-4">创建旅行</Link>
        </div>
      </section>
    )
  }

  const totalDays = summary?.days ?? daysBetween(trip.startDate, trip.endDate) + 1
  const today = localDateKey(new Date())
  const elapsed = today < trip.startDate ? 0 : today > trip.endDate ? totalDays : daysBetween(trip.startDate, today) + 1
  const doneItinerary = itinerary.filter(i => i.status === 'DONE').length
  // 有行程时按行程完成度，否则按旅行天数推进
  const useItinerary = itinerary.length > 0
  const current = useItinerary ? doneItinerary : elapsed
  const total = useItinerary ? itinerary.length : totalDays
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0

  return (
    <section className="warm-card home-block">
      <div className="panel-head">
        <h3>{title}</h3>
        <Link href={manageHref} className="panel-link">{manageLabel} <ArrowRight size={12} /></Link>
      </div>

      <div className="trip-card">
        <div className="trip-cover">
          <img src={trip.coverImage || '/images/cover.jpg'} alt={`${trip.title} 封面`} loading="lazy" />
          <span className={`trip-status ${trip.status === 'ONGOING' ? 'live' : ''}`}>{STATUS_TEXT[trip.status] || trip.status}</span>
          <span className="trip-plan">{trip.planType}</span>
        </div>

        <div className="trip-body">
          <h4>{trip.title}</h4>
          <p className="trip-dates"><CalendarDays size={13} /> {trip.startDate.replace(/-/g, '.')} - {trip.endDate.replace(/-/g, '.')}</p>

          <div className="trip-facts">
            <span><MapPin size={13} /> {trip.destinationName}</span>
            <span>{totalDays}天{Math.max(totalDays - 1, 0)}晚</span>
            <span>{summary?.places ?? 0} 个地点</span>
            <span><Users size={13} /> {trip.peopleCount} 人</span>
          </div>

          {note && <p className="trip-note">{note}</p>}

          <div className="trip-progress">
            <span className="trip-progress-label">行程进度</span>
            <span className="progress-track"><span className="progress-fill" style={{ width: `${percent}%` }} /></span>
            <b>{useItinerary ? `${doneItinerary} / ${itinerary.length} 个行程` : `${elapsed} / ${totalDays} 天`}</b>
          </div>

          <div className="trip-actions">
            <Link href={`/trips/${trip.id}/map`} className="warm-button">继续记录 <ArrowRight size={14} /></Link>
            <Link href={`/trips/${trip.id}/map`} className="hero-ghost-button"><MapIcon size={14} /> 查看旅行地图</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
