/** 中部旅行统计：四组数据、细竖线分隔，数字明显大于说明文字。数据全部来自 PosterData。 */

import { CalendarDays, Compass, Image as ImageIcon, MapPin, Map as MapIcon } from 'lucide-react'
import type { PosterData } from '@/utils/poster-data'

export function PosterStats({ data }: { data: PosterData }) {
  const { days, places, photos, explored } = data.stats
  const items = [
    { icon: CalendarDays, ...days },
    { icon: MapPin, ...places },
    { icon: ImageIcon, ...photos },
    { icon: explored.en === 'AREAS' ? MapIcon : Compass, ...explored }
  ]
  return (
    <section className="cp-stats">
      {items.map(({ icon: Icon, value, en, zh }) => (
        <div key={en} className="cp-stat">
          <Icon size={26} strokeWidth={1.4} aria-hidden="true" />
          <div>
            <b>{value.endsWith('%') ? <>{value.slice(0, -1)}<sup>%</sup></> : value}</b>
            <span><i>{en}</i><small>{zh}</small></span>
          </div>
        </div>
      ))}
    </section>
  )
}
