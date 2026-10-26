'use client'

/**
 * 为你推荐：只放 3 个地点（规则推荐见 utils/explore 的 selectRecommended），
 * 桌面 3 列、平板 2 列、手机横向滑动。地点加载失败时整块隐藏，不影响页面其他部分。
 */

import { ArrowRight } from 'lucide-react'
import type { ExplorePlace } from '@/utils/explore'
import { ExplorePlaceCard, PlaceCardSkeleton } from './ExplorePlaceCard'
import type { ExploreActions } from './PlaceActions'

export function RecommendedPlaces({ places, loading, actions, onViewAll }: { places: ExplorePlace[]; loading: boolean; actions: ExploreActions; onViewAll: () => void }) {
  if (!loading && !places.length) return null
  return (
    <section className="xp-section" id="xp-recommend" aria-labelledby="xp-recommend-title">
      <header className="xp-section-head">
        <div>
          <h2 id="xp-recommend-title">为你推荐</h2>
          <p>第一次来到东京，可以从这些地方开始。</p>
        </div>
        <button type="button" className="xp-link" onClick={onViewAll}>查看全部 <ArrowRight size={13} /></button>
      </header>
      <div className="xp-recommend">
        {loading
          ? [0, 1, 2].map(i => <PlaceCardSkeleton key={i} />)
          : places.map((p, i) => <ExplorePlaceCard key={p.id} place={p} actions={actions} variant="recommend" eager={i === 0} />)}
      </div>
    </section>
  )
}
