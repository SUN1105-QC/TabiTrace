/**
 * 分享成果 · 九宫格 ·「旅行手帐」（导出 PNG 用，3:4，1080 × 1440 设计尺寸）。
 * 照片来自九宫格素材选择（与标准九宫格共用 gridPhotos），这里只负责排版：
 * 标题区 → 1 张主图 + 最多 8 张错落的照片卡（地点标签、编号）→ 品牌区，装饰在独立的前后两层。
 * 照片不足 9 张时用对应数量的版式，不放假照片、不留空框；一张照片都没有时提示去选择照片。
 */

import type { PhotoView, TimelineDay, TripSummary, TripView } from '@/services/tabitrace-api'
import { DEFAULT_GRID_OPTIONS, dayNumber, gridPhotos, placeIndex, type GridOptions } from '@/utils/share-grid'
import { SB_HEIGHT, SB_MAX_PHOTOS, SB_WIDTH, scrapCover, scrapLabel, scrapPlaceCount, scrapPlacements } from '@/utils/share-scrapbook'
import { ScrapbookPhotoCard } from './ScrapbookPhotoCard'
import { ScrapbookDecorationLayer } from './ScrapbookDecorationLayer'
import { ScrapbookBrandFooter, ScrapbookHeader, type ScrapDay } from './ScrapbookHeader'

export function TravelScrapbookTemplate({ trip, summary, timeline, photos, options = DEFAULT_GRID_OPTIONS, activeSlot = null, onSlot }: {
  trip: TripView
  summary: TripSummary
  timeline: TimelineDay[]
  photos: PhotoView[]
  options?: GridOptions
  /** 编辑中选中的照片（按选择顺序，0 起）；导出时为 null */
  activeSlot?: number | null
  onSlot?: (slot: number) => void
}) {
  const places = placeIndex(timeline)
  const picked = gridPhotos(photos, timeline, options, SB_MAX_PHOTOS)
  const cover = scrapCover(picked, trip, options.coverPhotoId)
  const placed = scrapPlacements(picked, cover, options.layout)
  const day: ScrapDay | undefined = options.day ? { date: options.day, no: dayNumber(timeline, options.day) } : undefined

  return (
    <article className="sb-canvas" style={{ width: SB_WIDTH, height: SB_HEIGHT }}>
      <ScrapbookDecorationLayer layer="back" trip={trip} date={day?.date ?? trip.startDate} slots={[]} />
      <ScrapbookHeader trip={trip} day={day} days={summary.days} photos={picked.length} places={scrapPlaceCount(picked, places)} />
      <div className="sb-board">
        {placed.map(({ slot, photo, no }) => (
          <ScrapbookPhotoCard key={photo.id} slot={slot} photo={photo} no={no} label={scrapLabel(photo, places, trip)}
            active={activeSlot === no - 1} onSelect={onSlot ? () => onSlot(no - 1) : undefined} />
        ))}
        {placed.length === 0 && (
          <div className="sb-empty">
            <b>还没有可用的照片</b>
            <span>在下方「九宫格素材」里选择照片，或先到照片页上传旅行照片。</span>
          </div>
        )}
      </div>
      <ScrapbookDecorationLayer layer="front" trip={trip} date={day?.date ?? trip.startDate} slots={placed.map(p => p.slot)} />
      <ScrapbookBrandFooter />
    </article>
  )
}
