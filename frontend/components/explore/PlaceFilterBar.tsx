'use client'

/** 「全部地点」的筛选栏：分类胶囊 + 区域 + 排序 + 卡片 / 地图视图。 */

import { LayoutGrid, Map as MapIcon } from 'lucide-react'
import { SORTS, type SortKey } from '@/utils/explore'
import { ExploreCategoryFilter } from './ExploreCategoryFilter'

export function PlaceFilterBar({ category, area, areas, sort, view, counts, onCategory, onArea, onSort, onView }: {
  category: string
  area: string
  areas: string[]
  sort: SortKey
  view: 'grid' | 'map'
  counts: Record<string, number>
  onCategory: (key: string) => void
  onArea: (name: string) => void
  onSort: (key: SortKey) => void
  onView: (v: 'grid' | 'map') => void
}) {
  return (
    <div className="xp-filterbar">
      <ExploreCategoryFilter value={category} onChange={onCategory} counts={counts} />
      <div className="xp-filter-tools">
        <label className="xp-select">
          <span className="sr-only">区域</span>
          <select value={area} onChange={e => onArea(e.target.value)} aria-label="按区域筛选">
            <option value="">全部区域</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="xp-select">
          <span className="sr-only">排序</span>
          <select value={sort} onChange={e => onSort(e.target.value as SortKey)} aria-label="排序方式">
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <div className="xp-view" role="radiogroup" aria-label="显示方式">
          <button type="button" role="radio" aria-checked={view === 'grid'} className={view === 'grid' ? 'is-active' : ''} onClick={() => onView('grid')}><LayoutGrid size={14} /><span>卡片</span></button>
          <button type="button" role="radio" aria-checked={view === 'map'} className={view === 'map' ? 'is-active' : ''} onClick={() => onView('map')}><MapIcon size={14} /><span>地图</span></button>
        </div>
      </div>
    </div>
  )
}
