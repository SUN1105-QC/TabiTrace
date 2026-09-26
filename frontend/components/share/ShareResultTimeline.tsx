/** 按天分组的旅程时间线，左侧一条细竖线贯穿所有天。 */

import type { TimelineDay } from '@/services/tabitrace-api'
import { ShareResultDaySection } from './ShareResultDaySection'

export function ShareResultTimeline({ timeline }: { timeline: TimelineDay[] }) {
  const days = timeline.filter(d => d.items.length > 0)
  const offsets = days.map((_, i) => days.slice(0, i).reduce((n, d) => n + d.items.filter(it => it.photos.length > 0).length, 0))
  return (
    <section className="sl-section sl-timeline-wrap">
      <div className="sl-heading">
        <span>THE JOURNEY</span>
        <h3>旅程时间线</h3>
      </div>
      {days.length === 0 ? (
        <p className="sl-empty">这趟旅行还没有打卡记录。完成打卡后，每天的足迹会出现在这里。</p>
      ) : (
        <div className="sl-timeline">
          {days.map((day, i) => <ShareResultDaySection key={day.date} day={day} index={i} photoOffset={offsets[i]} />)}
        </div>
      )}
    </section>
  )
}
