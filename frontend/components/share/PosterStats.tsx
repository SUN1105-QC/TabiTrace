/**
 * 杂志式数据带：无卡片、无底色，四项数据用极细竖线分隔，线性单色图标。
 * 单日海报的前三项换成当天的数据（第几天 / 当天地点 / 当天照片），探索进度仍是整趟旅行的。
 */

import { CalendarDays, Compass, Image as ImageIcon, MapPin } from 'lucide-react'
import type { TripSummary } from '@/services/tabitrace-api'
import type { PosterDay } from './TravelPoster'

export function PosterStats({ summary, day }: { summary: TripSummary; day?: PosterDay }) {
  const items = [
    day
      ? { icon: CalendarDays, value: String(day.no).padStart(2, '0'), en: 'DAY', zh: `第 ${day.no} 天` }
      : { icon: CalendarDays, value: String(summary.days), en: 'DAYS', zh: '旅行天数' },
    { icon: MapPin, value: String(day ? day.places : summary.places), en: 'PLACES', zh: day ? '当天地点' : '打卡地点' },
    { icon: ImageIcon, value: String(day ? day.photos : summary.photos), en: 'PHOTOS', zh: day ? '当天照片' : '旅行照片' },
    { icon: Compass, value: `${summary.explorationRate}%`, en: 'EXPLORED', zh: '探索进度' }
  ]
  return (
    <section className="tp-stats">
      {items.map(({ icon: Icon, value, en, zh }) => (
        <div key={en} className="tp-stat">
          <Icon size={15} strokeWidth={1.25} />
          <b>{value}</b>
          <span>{en}</span>
          <small>{zh}</small>
        </div>
      ))}
    </section>
  )
}
