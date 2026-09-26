/** 格子 1：封面信息格。暖黑底 + 白色大标题，像海报封面一样先把「这是哪趟旅行」交代清楚。 */

import type { TripSummary, TripView } from '@/services/tabitrace-api'
import { cityEn, cityOf } from '@/utils/share-long'
import { titleSize } from '@/utils/share-grid'
import { ShareGridTile } from './ShareGridTile'
import type { GridDay } from './ShareGridCard'

export function ShareGridTitleTile({ trip, summary, day }: { trip: TripView; summary: TripSummary; day?: GridDay }) {
  const city = cityOf(trip)
  const en = cityEn(trip)
  return (
    <ShareGridTile variant="title">
      <span className="sg-kicker">TRAVEL JOURNAL</span>
      <div className="sg-title-body">
        <span className="sg-title-city">{city}{en !== city && <i>{en.toUpperCase()}</i>}</span>
        <h2 style={{ fontSize: titleSize(trip.title) }}>{trip.title}</h2>
      </div>
      <div className="sg-title-foot">{day ? `DAY ${String(day.no).padStart(2, '0')} · ${day.places} PLACES` : `${summary.days} DAYS · ${summary.places} PLACES`}</div>
    </ShareGridTile>
  )
}
