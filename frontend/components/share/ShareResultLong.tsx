/**
 * 分享成果 · 每日长图（导出 PNG 用）。
 * 封面 → 基础信息 → 这趟旅程 → 旅途剪影 → 按天时间线 → 城市印象，整体宽 760px，便于导出后直接分享。
 */

import type { AchievementView, PhotoView, TimelineDay, TripSummary, TripView } from '@/services/tabitrace-api'
import { coverPhoto, galleryPhotos } from '@/utils/share-long'
import { ShareResultCover } from './ShareResultCover'
import { ShareResultStats } from './ShareResultStats'
import { ShareResultMood } from './ShareResultMood'
import { ShareResultGallery } from './ShareResultGallery'
import { ShareResultTimeline } from './ShareResultTimeline'
import { ShareResultFooter } from './ShareResultFooter'

export function ShareResultLong({ trip, summary, timeline, photos, achievements }: {
  trip: TripView
  summary: TripSummary
  timeline: TimelineDay[]
  photos: PhotoView[]
  achievements: AchievementView[]
}) {
  const cover = coverPhoto(trip, photos)
  const picks = galleryPhotos(photos, 6)
  // 结尾背景尽量不和封面重复
  const ending = picks.find(p => p.imageUrl !== cover)?.imageUrl ?? cover

  return (
    <article className="sl-card">
      <ShareResultCover trip={trip} image={cover} />
      <ShareResultStats trip={trip} summary={summary} photos={photos} achievements={achievements} />
      <ShareResultMood trip={trip} summary={summary} timeline={timeline} achievements={achievements} />
      <ShareResultGallery photos={photos} />
      <ShareResultTimeline timeline={timeline} />
      <ShareResultFooter trip={trip} timeline={timeline} image={ending} />
    </article>
  )
}
