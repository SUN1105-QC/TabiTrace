'use client'

/** 地图视图：用当前筛选结果在地图上标点（复用 LiveTravelMap），点标点在右侧显示地点卡。 */

import dynamic from 'next/dynamic'
import type { PlaceView } from '@/services/tabitrace-api'
import { PlaceCard } from './PlaceCard'
import type { ExploreActions } from './PlaceActions'

const LiveTravelMap = dynamic(() => import('@/components/map/LiveTravelMap').then(m => m.LiveTravelMap), {
  ssr: false,
  loading: () => <div className="ex-map-loading">正在载入地图…</div>
})

const NO_CHECKINS: never[] = []

export function ExploreMapView({ places, selected, actions, onSelect }: {
  places: PlaceView[]
  selected: PlaceView | null
  actions: ExploreActions
  onSelect: (p: PlaceView) => void
}) {
  return (
    <div className="ex-map">
      <div className="ex-map-canvas"><LiveTravelMap places={places} checkins={NO_CHECKINS} onSelect={onSelect} /></div>
      <div className="ex-map-side">
        {selected ? <PlaceCard place={selected} actions={actions} /> : (
          <div className="ex-map-empty">
            <p>点地图上的标点查看地点</p>
            <small>当前显示 {places.length} 个地点，切换上方分类可以只看某一类。</small>
          </div>
        )}
      </div>
    </div>
  )
}
