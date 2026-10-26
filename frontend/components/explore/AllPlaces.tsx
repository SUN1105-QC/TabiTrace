'use client'

/**
 * 全部地点：统一的地点卡网格（列数随宽度自动增加），每次显示 12 个，「加载更多」再追加。
 * 搜索关键词、分类、区域、排序都作用在这里；地图视图沿用原来的地图组件。
 */

import { X } from 'lucide-react'
import type { PlaceView } from '@/services/tabitrace-api'
import type { ExplorePlace, SortKey } from '@/utils/explore'
import { ExplorePlaceCard, PlaceCardSkeleton } from './ExplorePlaceCard'
import { ExploreEmptyState } from './ExploreEmptyState'
import { ExploreMapView } from './ExploreMapView'
import { PlaceFilterBar } from './PlaceFilterBar'
import type { ExploreActions } from './PlaceActions'

export const PLACE_PAGE_SIZE = 12

export function AllPlaces(props: {
  places: ExplorePlace[]
  loading: boolean
  error: string
  onRetry: () => void
  query: string
  category: string
  area: string
  areas: string[]
  sort: SortKey
  view: 'grid' | 'map'
  counts: Record<string, number>
  limit: number
  mapSelected: ExplorePlace | null
  actions: ExploreActions
  distanceOf?: (p: PlaceView) => string | undefined
  onCategory: (key: string) => void
  onArea: (name: string) => void
  onSort: (key: SortKey) => void
  onView: (v: 'grid' | 'map') => void
  onMore: () => void
  onClearQuery: () => void
  onClearAll: () => void
  onMapSelect: (p: PlaceView) => void
}) {
  const { places, loading, error, query, category, area, view, limit, actions } = props
  const filtered = Boolean(query) || category !== 'ALL' || Boolean(area)
  const shown = places.slice(0, limit)

  return (
    <section className="xp-section" id="xp-all" aria-labelledby="xp-all-title">
      <header className="xp-section-head">
        <div>
          <h2 id="xp-all-title">全部地点</h2>
          {query ? (
            <p className="xp-query">搜索「{query}」<button type="button" className="xp-link" onClick={props.onClearQuery} aria-label="清除搜索关键词"><X size={13} /> 清除</button></p>
          ) : <p>官方精选的东京地点，按分类、区域慢慢挑。</p>}
        </div>
        {!loading && !error && <span className="xp-count">{places.length} 个</span>}
      </header>

      <PlaceFilterBar category={category} area={area} areas={props.areas} sort={props.sort} view={view} counts={props.counts}
        onCategory={props.onCategory} onArea={props.onArea} onSort={props.onSort} onView={props.onView} />

      {error ? (
        <ExploreEmptyState kind="error" onAction={props.onRetry} />
      ) : loading ? (
        <div className="xp-grid">{Array.from({ length: 8 }, (_, i) => <PlaceCardSkeleton key={i} />)}</div>
      ) : places.length === 0 ? (
        <ExploreEmptyState kind={area && !query && category === 'ALL' ? 'area' : 'search'} onAction={filtered ? props.onClearAll : undefined} />
      ) : view === 'map' ? (
        <ExploreMapView places={places.map(p => p.source)} selected={props.mapSelected} actions={actions} onSelect={props.onMapSelect} />
      ) : (
        <>
          <div className="xp-grid">
            {shown.map(p => <ExplorePlaceCard key={p.id} place={p} actions={actions} anchor distance={props.distanceOf?.(p.source)} />)}
          </div>
          {places.length > shown.length && (
            <div className="xp-more">
              <button type="button" className="xp-btn" onClick={props.onMore}>加载更多（还有 {places.length - shown.length} 个）</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
