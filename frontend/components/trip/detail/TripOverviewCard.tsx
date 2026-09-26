/** 旅行概览：6 项数据放进一张卡片的 2 × 3 网格，替代原来 6 张独立大卡。 */

import { CalendarDays, Camera, CircleCheck, Compass, MapPin, Trophy, type LucideIcon } from 'lucide-react'
import type { TripSummary, TripView } from '@/services/tabitrace-api'
import { formatTripStatus } from '@/utils/trip'

type Item = { key: string; icon: LucideIcon; value: string; label: string; sub?: string }

export function TripOverviewCard({ trip, summary }: { trip: TripView; summary: TripSummary }) {
  const status = formatTripStatus(trip.status)
  // 非官方城市没有“探索度”的分母，显示 — 而不是一个误导的 0%
  const hasOfficial = summary.officialPlacesTotal > 0
  const items: Item[] = [
    { key: 'days', icon: CalendarDays, value: String(summary.days ?? 0), label: '旅行天数' },
    { key: 'places', icon: MapPin, value: String(summary.places ?? 0), label: '地点' },
    { key: 'photos', icon: Camera, value: String(summary.photos ?? 0), label: '照片' },
    { key: 'achievements', icon: Trophy, value: String(summary.achievements ?? 0), label: '成就' },
    { key: 'explore', icon: Compass, value: hasOfficial ? `${summary.explorationRate ?? 0}%` : '—', label: '探索度', sub: hasOfficial ? `${summary.officialPlacesCompleted}/${summary.officialPlacesTotal} 官方地点` : '暂无官方地点' },
    { key: 'status', icon: CircleCheck, value: status.label, label: '旅行状态', sub: status.code }
  ]
  return (
    <section className="td-card td-overview" aria-label="旅行概览">
      <dl>
        {items.map(({ key, icon: Icon, value, label, sub }) => (
          <div key={key} className={`td-ov-item is-${key}`}>
            <dt><Icon size={15} aria-hidden="true" />{label}</dt>
            <dd>{value}{sub && <small>{sub}</small>}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
