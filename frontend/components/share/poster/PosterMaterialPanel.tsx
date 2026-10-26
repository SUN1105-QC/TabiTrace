'use client'

/**
 * 「海报素材」面板（城市海报模式）：日期范围 → 海报标题 → 主照片 → 辅助照片 → 海报文字。
 * 每项改动立即反映到左侧海报；没有指定的项自动挑选（规则见 utils/poster-data）。
 */

import { Download, Loader2 } from 'lucide-react'
import type { PhotoView, TimelineDay, TripView } from '@/services/tabitrace-api'
import { scopePhotos, scopeTimeline } from '@/utils/share-grid'
import { notedCheckins, type PosterOptions, type QuoteChoice } from '@/utils/poster-data'
import { MaterialPanel } from '../MaterialPicker'
import { PosterDateSelector, PosterPhotoSelector, PosterQuoteSelector, PosterTitleEditor } from './PosterSelectors'

export function PosterMaterialPanel({ trip, timeline, photos, value, auto, onChange, onExport, exporting = false }: {
  trip: TripView
  timeline: TimelineDay[]
  photos: PhotoView[]
  value: PosterOptions
  /** 当前海报实际用到的照片（含自动挑选的），用于在缩略图上标出「自动」 */
  auto: { mainId?: number; secondaryIds: number[] }
  onChange: (next: PosterOptions) => void
  /** 手机上素材设置之后再给一个导出入口（顺序：预览 → 素材 → 导出） */
  onExport?: () => void
  exporting?: boolean
}) {
  /** 换日期时，只保留仍在新范围里的照片与文字选择 */
  function pickDay(day?: string) {
    const inScope = new Set(scopePhotos(photos, timeline, day).map(p => p.id))
    const noteIds = new Set(notedCheckins(scopeTimeline(timeline, day)).map(c => c.id))
    const quote: QuoteChoice = value.quote.mode === 'note' && !noteIds.has(value.quote.checkinId) ? { mode: 'auto' } : value.quote
    onChange({
      ...value,
      day,
      mainPhotoId: value.mainPhotoId != null && inScope.has(value.mainPhotoId) ? value.mainPhotoId : undefined,
      secondaryIds: value.secondaryIds.filter(id => inScope.has(id)),
      quote
    })
  }

  return (
    <MaterialPanel eyebrow="POSTER MATERIAL" title="海报素材">
      <PosterDateSelector timeline={timeline} value={value.day} onPick={pickDay} />
      <PosterTitleEditor fallback={trip.title} value={value.title} onChange={title => onChange({ ...value, title })} />
      <PosterPhotoSelector
        mode="main" photos={photos} timeline={timeline} day={value.day}
        selected={value.mainPhotoId != null ? [value.mainPhotoId] : []} autoIds={auto.mainId != null ? [auto.mainId] : []}
        blocked={value.secondaryIds}
        onChange={ids => onChange({ ...value, mainPhotoId: ids[0] })}
      />
      <PosterPhotoSelector
        mode="secondary" photos={photos} timeline={timeline} day={value.day}
        selected={value.secondaryIds} autoIds={auto.secondaryIds}
        blocked={auto.mainId != null ? [auto.mainId] : []}
        onChange={ids => onChange({ ...value, secondaryIds: ids })}
      />
      <PosterQuoteSelector timeline={timeline} day={value.day} value={value.quote} onChange={quote => onChange({ ...value, quote })} />
      {onExport && (
        <button type="button" className="ss-btn is-primary cp-panel-export" onClick={onExport} disabled={exporting}>
          {exporting ? <Loader2 size={16} className="ss-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}{exporting ? '正在导出…' : '导出 PNG'}
        </button>
      )}
    </MaterialPanel>
  )
}
