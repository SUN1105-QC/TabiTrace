/**
 * 分享成果 · 旅行成果海报（PosterCanvas，导出 PNG 时只截取这一个节点）。
 * 日系旅行手帐 × Editorial 杂志排版：左上标题与手写笔记、右上主摄影、中部杂志式数据、
 * 下半部分是拍立得 + 线稿路线图的剪贴簿。固定 840 × 1120（3:4）。
 * options 来自「海报素材」面板：可限定某一天、指定照片与文字；不传时整趟旅行自动排版。
 */

import type { PhotoView, TimelineDay, TripSummary, TripView } from '@/services/tabitrace-api'
import { DEFAULT_POSTER_OPTIONS, dayNumber, posterPhotos, posterQuote, scopePhotos, scopeTimeline, type PosterOptions } from '@/utils/share-poster'
import { PosterIntro } from './PosterIntro'
import { PosterHeroPhoto } from './PosterHeroPhoto'
import { PosterStats } from './PosterStats'
import { PosterScrapbook } from './PosterScrapbook'
import { PosterSignature } from './PosterSignature'

export type PosterDay = { date: string; no: number; places: number; photos: number }

export function TravelPoster({ trip, summary, photos, timeline, options = DEFAULT_POSTER_OPTIONS }: {
  trip: TripView
  summary: TripSummary
  photos: PhotoView[]
  timeline: TimelineDay[]
  options?: PosterOptions
}) {
  const scoped = scopeTimeline(timeline, options.day)
  const scopedPhotos = scopePhotos(photos, timeline, options.day)
  const { hero, polaroids } = posterPhotos(trip, scopedPhotos, timeline, options.photoIds, !options.day)
  const quote = posterQuote(scoped, options.quote, timeline)
  // 同一句话已经作为海报主文字时，拍立得上不再重复
  const cards = polaroids.map(p => (p.note && p.note === quote?.text ? { ...p, note: undefined } : p))
  const day: PosterDay | undefined = options.day ? {
    date: options.day,
    no: dayNumber(timeline, options.day),
    places: new Set(scoped.flatMap(d => d.items.map(i => i.checkin.placeName))).size,
    photos: scopedPhotos.length
  } : undefined

  return (
    <article className="tp-canvas">
      <div className="tp-top">
        <PosterIntro trip={trip} quote={quote} day={day} />
        <PosterHeroPhoto trip={trip} photo={hero} />
      </div>
      <PosterStats summary={summary} day={day} />
      <PosterScrapbook trip={trip} polaroids={cards} timeline={scoped} day={day} />
      <PosterSignature trip={trip} />
    </article>
  )
}
