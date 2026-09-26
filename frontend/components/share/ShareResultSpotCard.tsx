/**
 * 地点卡片。有照片：图文卡，左右交错（reverse）增强节奏；主图 + 最多 4 张缩略图。
 * 没照片：紧凑的文字行，避免出现大块空白。
 */

import type { CheckinView, TimelinePhoto } from '@/services/tabitrace-api'
import { timeOfDay } from '@/lib/time'

export function ShareResultSpotCard({ checkin, photos, reverse }: {
  checkin: CheckinView
  photos: TimelinePhoto[]
  reverse: boolean
}) {
  const time = timeOfDay(checkin.checkinTime)

  if (photos.length === 0) {
    return (
      <article className="sl-spot is-text">
        <span className="sl-spot-dot" />
        <div className="sl-spot-line">
          <time>{time}</time>
          <h4>{checkin.placeName}</h4>
          {checkin.area && <em className="sl-chip">{checkin.area}</em>}
        </div>
        {checkin.note && <p className="sl-spot-note">{checkin.note}</p>}
      </article>
    )
  }

  const [main, ...rest] = photos
  return (
    <article className={`sl-spot is-photo${reverse ? ' is-reverse' : ''}`}>
      <span className="sl-spot-dot" />
      <div className="sl-spot-text">
        <time>{time}</time>
        <h4>{checkin.placeName}</h4>
        {checkin.area && <em className="sl-chip">{checkin.area}</em>}
        {checkin.note && <p className="sl-spot-note">{checkin.note}</p>}
        <span className="sl-spot-count">{photos.length} 张照片</span>
      </div>
      <div className="sl-spot-media">
        <img className="sl-spot-main" src={main.imageUrl} crossOrigin="anonymous" alt={checkin.placeName} />
        {rest.length > 0 && (
          <div className="sl-spot-thumbs">
            {rest.slice(0, 4).map(p => <img key={p.id} src={p.imageUrl} crossOrigin="anonymous" alt={checkin.placeName} />)}
          </div>
        )}
      </div>
    </article>
  )
}
