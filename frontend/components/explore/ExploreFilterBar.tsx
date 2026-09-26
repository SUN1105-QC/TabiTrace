'use client'

/** 粘性筛选栏：主分类胶囊 + 排序 + 卡片 / 地图视图切换。快捷入口带来的隐藏分类会作为一个可清除的胶囊出现。 */

import { LayoutGrid, Map as MapIcon, X } from 'lucide-react'
import { FILTERS, SORTS, filterOf, type SortKey } from '@/utils/explore'

export function ExploreFilterBar({ filter, sort, view, counts, onFilter, onSort, onView }: {
  filter: string
  sort: SortKey
  view: 'grid' | 'map'
  counts: Record<string, number>
  onFilter: (key: string) => void
  onSort: (key: SortKey) => void
  onView: (v: 'grid' | 'map') => void
}) {
  const current = filterOf(filter)
  return (
    <div className="ex-filterbar" id="ex-filterbar">
      <div className="ex-filters" role="tablist" aria-label="地点分类">
        {FILTERS.filter(f => !f.hidden).map(f => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'is-active' : ''} onClick={() => onFilter(f.key)}>
            {f.label}{f.key !== 'ALL' && <small>{counts[f.key] ?? 0}</small>}
          </button>
        ))}
        {current.hidden && (
          <button type="button" role="tab" aria-selected className="is-active is-extra" onClick={() => onFilter('ALL')}>
            {current.label}<small>{counts[current.key] ?? 0}</small><X size={12} />
          </button>
        )}
      </div>
      <div className="ex-filter-tools">
        <label className="ex-sort">
          <span>排序</span>
          <select value={sort} onChange={e => onSort(e.target.value as SortKey)}>
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <div className="ex-view" role="radiogroup" aria-label="视图">
          <button type="button" role="radio" aria-checked={view === 'grid'} className={view === 'grid' ? 'is-active' : ''} onClick={() => onView('grid')} title="卡片视图"><LayoutGrid size={14} /><span>卡片</span></button>
          <button type="button" role="radio" aria-checked={view === 'map'} className={view === 'map' ? 'is-active' : ''} onClick={() => onView('map')} title="地图视图"><MapIcon size={14} /><span>地图</span></button>
        </div>
      </div>
    </div>
  )
}
