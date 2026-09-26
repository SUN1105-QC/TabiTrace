/** 长图封面：满版主图 + 底部渐变，叠加刊名、标题、引言、日期与地点。 */

import type { TripView } from '@/services/tabitrace-api'
import { cityEn, dotDate, placeLabel } from '@/utils/share-long'

export function ShareResultCover({ trip, image }: { trip: TripView; image?: string }) {
  return (
    <header className="sl-cover">
      {image ? <img src={image} crossOrigin="anonymous" alt="旅行封面" /> : <div className="sl-cover-blank" />}
      <div className="sl-cover-shade" />
      <div className="sl-cover-top">
        <span>TRAVEL JOURNAL</span>
        <span>{trip.startDate.slice(0, 4)} · {cityEn(trip).toUpperCase()}</span>
      </div>
      <div className="sl-cover-body">
        <p className="sl-cover-kicker">A Journey Through {cityEn(trip)}</p>
        <h2>{trip.title}</h2>
        <p className="sl-cover-lead">把走过的路，收进一段刚刚好的记忆里。</p>
        <div className="sl-cover-meta">
          <span>{dotDate(trip.startDate)} — {dotDate(trip.endDate)}</span>
          <i />
          <span>{placeLabel(trip)}</span>
        </div>
      </div>
    </header>
  )
}
