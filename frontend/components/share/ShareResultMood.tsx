/** 这趟旅程：一句概述 + 关键词标签，让长图从「流水账」变成「故事总结」。 */

import type { AchievementView, TimelineDay, TripSummary, TripView } from '@/services/tabitrace-api'
import { journeyKeywords, journeySummary } from '@/utils/share-long'

export function ShareResultMood({ trip, summary, timeline, achievements }: {
  trip: TripView
  summary: TripSummary
  timeline: TimelineDay[]
  achievements: AchievementView[]
}) {
  const words = journeyKeywords(trip, timeline, achievements)
  return (
    <section className="sl-section sl-mood">
      <div className="sl-heading">
        <span>IN A FEW WORDS</span>
        <h3>这趟旅程</h3>
      </div>
      <p className="sl-mood-text">{journeySummary(trip, summary, timeline)}</p>
      {words.length > 0 && (
        <ul className="sl-tags">
          {words.map((w, i) => <li key={w} className={i === 0 ? 'is-accent' : ''}># {w}</li>)}
        </ul>
      )}
    </section>
  )
}
