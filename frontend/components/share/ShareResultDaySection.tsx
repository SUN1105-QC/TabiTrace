/** 每天一个模块：左侧 DAY 标识 + 时间轴节点，右侧当天地点；末尾是「今日足迹」小结。 */

import type { TimelineDay } from '@/services/tabitrace-api'
import { dotDate, weekdayOf } from '@/utils/share-long'
import { ShareResultSpotCard } from './ShareResultSpotCard'

/** photoOffset：前面各天已出现的图文卡数量，让左右交错贯穿整条时间线（而不是每天从头开始） */
export function ShareResultDaySection({ day, index, photoOffset }: { day: TimelineDay; index: number; photoOffset: number }) {
  let photoCards = photoOffset
  const photoCount = day.items.reduce((n, i) => n + i.photos.length, 0)
  const route = Array.from(new Set(day.items.map(i => i.checkin.placeName)))

  return (
    <section className="sl-day">
      <div className="sl-day-head">
        <span className="sl-day-node" />
        <div className="sl-day-no"><small>DAY</small><b>{String(index + 1).padStart(2, '0')}</b></div>
        <div className="sl-day-date">
          <b>{dotDate(day.date)} · {weekdayOf(day.date)}</b>
          <span>{day.items.length} 个地点{photoCount ? ` · ${photoCount} 张照片` : ''}</span>
        </div>
      </div>

      <div className="sl-day-body">
        {day.items.map(item => {
          const reverse = item.photos.length > 0 && photoCards++ % 2 === 1
          return <ShareResultSpotCard key={item.checkin.id} checkin={item.checkin} photos={item.photos} reverse={reverse} />
        })}
        {route.length > 1 && (
          <p className="sl-day-summary"><span>今日足迹</span>{route.join(' → ')}</p>
        )}
      </div>
    </section>
  )
}
