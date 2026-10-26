'use client'

/**
 * 推荐探索里唯一的地点卡（为你推荐、全部地点、地图侧栏共用）：
 * 16:10 封面 → 地点名 → 区域 · 类别 → 一句说明 → 推荐提示或标签 → 收藏 / 加入旅行。
 * 点封面或名称打开地点详情；状态徽标最多一个（已打卡），「已加入」由按钮本身表示。
 */

import { Check } from 'lucide-react'
import { recommendLine, type ExplorePlace } from '@/utils/explore'
import { COVER_SIZES, PlaceCover } from './PlaceCover'
import { AddButton, FavoriteButton, type ExploreActions } from './PlaceActions'

export function ExplorePlaceCard({ place, actions, variant = 'list', eager = false, anchor = false, distance }: {
  place: ExplorePlace
  actions: ExploreActions
  variant?: 'recommend' | 'list'
  eager?: boolean
  /** 只有「全部地点」里的卡片带 #place-{id} 锚点，同一地点在推荐里再出现时不重复 id */
  anchor?: boolean
  distance?: string
}) {
  const hint = variant === 'recommend' ? recommendLine(place.source) : place.tags.join(' · ')
  return (
    <article id={anchor ? `place-${place.id}` : undefined} className={`xp-card${variant === 'recommend' ? ' is-recommend' : ''}`}>
      <button type="button" className="xp-card-media" onClick={() => actions.onOpen(place)} aria-label={`查看 ${place.name} 的详情`}>
        <PlaceCover place={place.source} eager={eager} sizes={variant === 'recommend' ? COVER_SIZES.recommend : COVER_SIZES.grid} />
        {place.checkedIn && <span className="xp-badge"><Check size={12} /> 已打卡</span>}
      </button>
      <div className="xp-card-body">
        <h3><button type="button" onClick={() => actions.onOpen(place)}>{place.name}</button></h3>
        <p className="xp-card-meta">{place.area} · {place.category}{distance ? ` · ${distance}` : ''}</p>
        <p className="xp-card-summary">{place.summary}</p>
        {hint && <p className="xp-card-hint">{hint}</p>}
        <div className="xp-card-actions">
          <FavoriteButton place={place} actions={actions} />
          <AddButton place={place} actions={actions} primary={variant === 'recommend'} />
        </div>
      </div>
    </article>
  )
}

/** 加载中的地点卡占位：与真实卡片同样的比例，加载完成时页面不跳动 */
export function PlaceCardSkeleton() {
  return (
    <div className="xp-card is-skeleton" aria-hidden="true">
      <span className="xp-card-media skeleton" />
      <div className="xp-card-body">
        <span className="skeleton" style={{ height: 18, width: '55%' }} />
        <span className="skeleton" style={{ height: 12, width: '35%' }} />
        <span className="skeleton" style={{ height: 12, width: '90%' }} />
        <span className="skeleton" style={{ height: 32, width: '100%', marginTop: 6 }} />
      </div>
    </div>
  )
}
