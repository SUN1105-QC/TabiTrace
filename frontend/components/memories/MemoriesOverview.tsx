/** 回忆概览：四项数字全部来自当前用户已完成 / 已归档的旅行。 */

import { Camera, Film, Luggage, MapPinned } from 'lucide-react'
import type { MemoryOverview } from '@/services/memories'

export function MemoriesOverview({ overview }: { overview: MemoryOverview }) {
  const items = [
    { icon: Luggage, value: overview.archivedTrips, unit: '段', label: '已归档旅行' },
    { icon: MapPinned, value: overview.cities, unit: '座', label: '走过城市' },
    { icon: Camera, value: overview.photos, unit: '张', label: '旅行照片' },
    { icon: Film, value: overview.creations, unit: '个', label: '回忆作品', hint: 'Travel Story 与分享页' }
  ]
  return (
    <section className="mm-overview" aria-label="回忆概览">
      {items.map(({ icon: Icon, value, unit, label, hint }) => (
        <div key={label} className="mm-stat">
          <span className="mm-stat-icon"><Icon size={17} /></span>
          <div>
            <b>{value}<small>{unit}</small></b>
            <span>{label}</span>
            {hint && <em>{hint}</em>}
          </div>
        </div>
      ))}
    </section>
  )
}
