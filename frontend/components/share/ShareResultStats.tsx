/** 旅行基础信息：2 × 3 小模块，图标 + 数字 + 标签，数字突出。 */

import { CalendarDays, Images, MapPin, Navigation, Trophy, Users } from 'lucide-react'
import type { AchievementView, PhotoView, TripSummary, TripView } from '@/services/tabitrace-api'
import { cityOf, daysNights } from '@/utils/share-long'

export function ShareResultStats({ trip, summary, photos, achievements }: {
  trip: TripView
  summary: TripSummary
  photos: PhotoView[]
  achievements: AchievementView[]
}) {
  const featured = photos.filter(p => p.featured).length
  const items = [
    { icon: MapPin, value: cityOf(trip), label: '旅行城市', text: true },
    { icon: CalendarDays, value: daysNights(summary.days), label: '旅行天数', text: true },
    { icon: Users, value: `${trip.peopleCount}`, unit: '人', label: '同行人数' },
    { icon: Navigation, value: `${summary.places}`, unit: '个', label: '打卡地点' },
    featured > 0
      ? { icon: Images, value: `${featured}`, unit: '张', label: '精选照片' }
      : { icon: Images, value: `${summary.photos}`, unit: '张', label: '旅行照片' },
    { icon: Trophy, value: `${achievements.filter(a => a.earned).length}`, unit: '个', label: '旅行成就' }
  ]

  return (
    <section className="sl-section sl-stats">
      {items.map(({ icon: Icon, value, unit, label, text }) => (
        <div key={label} className="sl-stat">
          <span className="sl-stat-icon"><Icon size={15} /></span>
          <b className={text ? 'is-text' : ''}>{value}{unit && <small>{unit}</small>}</b>
          <em>{label}</em>
        </div>
      ))}
    </section>
  )
}
