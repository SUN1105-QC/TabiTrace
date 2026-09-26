/**
 * 照片不足 6 张时的补位格：不重复用同一张照片，而是写下一个去过的地点，
 * 像纪念册里夹着的一张手写便签。连地点也用完时，依次换成日期、足迹路线、城市名三种便签，避免重复。
 */

import type { TripView } from '@/services/tabitrace-api'
import { timeOfDay } from '@/lib/time'
import type { GridPlace } from '@/utils/share-grid'
import { cityEn, dotDate, weekdayOf } from '@/utils/share-long'
import { cityKanji } from '@/utils/share-poster'
import { ShareGridTile } from './ShareGridTile'

/** 地点用完后的补位内容：日期 / 足迹路线 / 城市名 */
export type GridFiller =
  | { kind: 'date'; date: string; label: string; note: string }
  | { kind: 'route'; label: string; names: string[] }
  | { kind: 'city' }

export function ShareGridMemoTile({ place, filler, trip }: { place?: GridPlace; filler?: GridFiller; trip: TripView }) {
  if (place) {
    const { checkin, day } = place
    return (
      <ShareGridTile variant="memo">
        <span className="sg-memo-day">DAY {String(day).padStart(2, '0')} · {timeOfDay(checkin.checkinTime)}</span>
        <h4>{checkin.placeName}</h4>
        {checkin.area && <em className="sg-memo-area">{checkin.area}</em>}
        {checkin.note?.trim() && <p className="sg-memo-note">{checkin.note.trim()}</p>}
      </ShareGridTile>
    )
  }
  if (filler?.kind === 'date') {
    return (
      <ShareGridTile variant="memo">
        <span className="sg-memo-day">{filler.label}</span>
        <h4 className="sg-memo-big">{dotDate(filler.date).slice(5)}</h4>
        <p className="sg-memo-note">{weekdayOf(filler.date)} · {filler.note}</p>
      </ShareGridTile>
    )
  }
  if (filler?.kind === 'route') {
    return (
      <ShareGridTile variant="memo">
        <span className="sg-memo-day">{filler.label}</span>
        <ol className="sg-memo-route">{filler.names.slice(0, 5).map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}</ol>
      </ShareGridTile>
    )
  }
  return (
    <ShareGridTile variant="memo">
      <span className="sg-memo-day">{cityEn(trip).toUpperCase()}</span>
      <h4 className="sg-memo-city">{cityKanji(trip)}</h4>
    </ShareGridTile>
  )
}
