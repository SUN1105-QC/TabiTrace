'use client'

import Link from 'next/link'
import { Camera, ChevronRight, Luggage, MapPin, Trophy } from 'lucide-react'

export type StatsInput = { places: number; placesTotal: number; photos: number; achievements: number; trips: number; activeTripId: number | null }

export function TravelStats({ stats }: { stats: StatsInput }) {
  const trip = (suffix: string) => (stats.activeTripId ? `/trips/${stats.activeTripId}${suffix}` : '/trips')
  const cards = [
    { tone: 'blue', icon: MapPin, value: stats.places, title: '旅行地点', note: stats.placesTotal ? `已打卡 ${stats.places} 个 / 共 ${stats.placesTotal} 个` : '开始记录第一个地点', href: trip('/map') },
    { tone: 'green', icon: Camera, value: stats.photos, title: '旅行照片', note: '记录美好瞬间', href: trip('/gallery') },
    { tone: 'gold', icon: Trophy, value: stats.achievements, title: '旅行成就', note: '开启更多精彩', href: trip('/achievements') },
    { tone: 'plum', icon: Luggage, value: stats.trips, title: '旅行次数', note: stats.trips ? `已记录 ${stats.trips} 次旅行` : '还没有旅行', href: '/trips' }
  ]

  return (
    <div className="stat-row">
      {cards.map(c => (
        <Link key={c.title} href={c.href} className={`stat-card ${c.tone}`}>
          <span className="stat-head">
            <span className="stat-icon"><c.icon size={19} /></span>
            <span className="stat-body">
              <b>{c.value}</b>
              <strong>{c.title}</strong>
            </span>
            <ChevronRight size={16} className="stat-arrow" />
          </span>
          <span className="stat-note">{c.note}</span>
        </Link>
      ))}
    </div>
  )
}
