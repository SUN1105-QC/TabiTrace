/**
 * 分享成果 · 九宫格（导出 PNG 用）。
 * 3 × 3 等大方格，按「信息 图 图 / 图 数据 图 / 图 图 收尾」的节奏排布：
 * 左上封面、正中数据、右下品牌收尾，其余 6 格是照片；照片不足时用去过的地点补位。
 * options 来自「九宫格素材」面板：默认每天的精选照片，可限定某一天，或自由点选照片。
 */

import type { PhotoView, TimelineDay, TripSummary, TripView } from '@/services/tabitrace-api'
import { DEFAULT_GRID_OPTIONS, dayNumber, gridPhotos, memoPlaces, placeIndex, scopePhotos, scopeTimeline, type GridOptions } from '@/utils/share-grid'
import { cityEn, dotDate, weekdayOf } from '@/utils/share-long'
import { ShareGridTitleTile } from './ShareGridTitleTile'
import { ShareGridImageTile } from './ShareGridImageTile'
import { ShareGridMemoTile, type GridFiller } from './ShareGridMemoTile'
import { ShareGridDataTile } from './ShareGridDataTile'
import { ShareGridFooterTile } from './ShareGridFooterTile'

const IMAGE_SLOTS = 6

/** 单日九宫格用到的当天数据 */
export type GridDay = { date: string; no: number; places: number; photos: number }

export function ShareGridCard({ trip, summary, timeline, photos, options = DEFAULT_GRID_OPTIONS }: {
  trip: TripView
  summary: TripSummary
  timeline: TimelineDay[]
  photos: PhotoView[]
  options?: GridOptions
}) {
  const places = placeIndex(timeline)
  const picked = gridPhotos(photos, timeline, options, IMAGE_SLOTS)
  const memos = memoPlaces(timeline, picked, IMAGE_SLOTS - picked.length, options.day)
  const day: GridDay | undefined = options.day ? {
    date: options.day,
    no: dayNumber(timeline, options.day),
    places: new Set(scopeTimeline(timeline, options.day).flatMap(d => d.items.map(i => i.checkin.placeName))).size,
    photos: scopePhotos(photos, timeline, options.day).length
  } : undefined

  // 照片和地点都用完时的补位：日期 → 足迹路线 → 城市名，依次使用，尽量不重复
  const route = Array.from(new Set(scopeTimeline(timeline, options.day).flatMap(d => d.items.map(i => i.checkin.placeName))))
  const fillers: GridFiller[] = [
    day
      ? { kind: 'date', date: day.date, label: `DAY ${String(day.no).padStart(2, '0')}`, note: `${day.places} 个地点` }
      : { kind: 'date', date: trip.startDate, label: 'ON THE ROAD', note: '出发的那一天' },
    ...(route.length > 1 ? [{ kind: 'route', label: day ? "TODAY'S ROUTE" : 'THE ROUTE', names: route } as GridFiller] : []),
    { kind: 'city' }
  ]

  const slots = Array.from({ length: IMAGE_SLOTS }, (_, i) => {
    const photo = picked[i]
    if (photo) return <ShareGridImageTile key={`p${photo.id}`} photo={photo} place={photo.checkinId != null ? places.get(photo.checkinId) : undefined} />
    const memo = memos[i - picked.length]
    if (memo) return <ShareGridMemoTile key={`m${i}`} place={memo} trip={trip} />
    return <ShareGridMemoTile key={`f${i}`} filler={fillers[(i - picked.length - memos.length) % fillers.length]} trip={trip} />
  })

  return (
    <article className="sg-card">
      <header className="sg-card-head">
        <span>A TRAVEL MEMORY · {cityEn(trip).toUpperCase()} {trip.startDate.slice(0, 4)}</span>
        <span>{day ? `DAY ${String(day.no).padStart(2, '0')} · ${dotDate(day.date)} ${weekdayOf(day.date)}` : `${dotDate(trip.startDate)} — ${dotDate(trip.endDate)}`}</span>
      </header>
      <div className="sg-grid">
        <ShareGridTitleTile trip={trip} summary={summary} day={day} />
        {slots[0]}
        {slots[1]}
        {slots[2]}
        <ShareGridDataTile trip={trip} summary={summary} day={day} />
        {slots[3]}
        {slots[4]}
        {slots[5]}
        <ShareGridFooterTile trip={trip} />
      </div>
    </article>
  )
}
