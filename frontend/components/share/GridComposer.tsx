'use client'

/**
 * 「九宫格素材」面板（只在九宫格模式出现）：
 * 1. 日期：默认「整趟旅行 · 每天精选」，也可以只用某一天的照片；
 * 2. 照片：自由点选，按顺序填入 6 个照片格（从左到右、从上到下），没选满时其余格子自动补齐。
 */

import type { PhotoView, TimelineDay } from '@/services/tabitrace-api'
import { scopePhotos, type GridOptions } from '@/utils/share-grid'
import { DayPicker, MaterialPanel, PhotoPicker, photoGroups } from './MaterialPicker'

const MAX_PHOTOS = 6

export function GridComposer({ timeline, photos, value, onChange }: {
  timeline: TimelineDay[]
  photos: PhotoView[]
  value: GridOptions
  onChange: (next: GridOptions) => void
}) {
  /** 换日期时，只保留仍在新范围里的已选照片 */
  function pickDay(day?: string) {
    const inScope = new Set(scopePhotos(photos, timeline, day).map(p => p.id))
    onChange({ day, photoIds: value.photoIds.filter(id => inScope.has(id)) })
  }

  return (
    <MaterialPanel eyebrow="GRID MATERIAL" title="九宫格素材">
      <DayPicker timeline={timeline} value={value.day} onPick={pickDay} allLabel="整趟旅行 · 每天精选" />
      <PhotoPicker
        groups={photoGroups(photos, timeline, value.day)}
        selected={value.photoIds}
        max={MAX_PHOTOS}
        roleOf={i => `第 ${i + 1} 格`}
        hint={value.day
          ? '默认用这一天的照片（精选优先）。点选照片可自由指定，按顺序填入 6 个照片格；没选满时其余格子自动补齐。'
          : '默认按天轮流取每天的精选照片（★）。点选照片可自由指定，按顺序填入 6 个照片格；没选满时其余格子自动补齐。'}
        empty="这一天没有照片，照片格会改为写着地点的便签。"
        onChange={photoIds => onChange({ ...value, photoIds })}
      />
    </MaterialPanel>
  )
}
