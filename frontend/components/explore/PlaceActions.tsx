'use client'

/** 地点上的操作：收藏、加入旅行、分享。状态由页面统一管理（加入 / 收藏都以后端为准）。 */

import { Check, Heart, Plus, Share2 } from 'lucide-react'
import type { PlaceView } from '@/services/tabitrace-api'
import type { ExplorePlace } from '@/utils/explore'

export type ExploreActions = {
  busy: Set<number>
  onOpen: (p: ExplorePlace) => void
  onAdd: (p: PlaceView) => void
  onFavorite: (p: PlaceView) => void
  onShare: (p: PlaceView) => void
}

export function FavoriteButton({ place, actions, iconOnly = false }: { place: ExplorePlace; actions: ExploreActions; iconOnly?: boolean }) {
  const on = place.favorite
  return (
    <button type="button" className={`xp-fav${on ? ' is-on' : ''}${iconOnly ? ' is-icon' : ''}`} onClick={() => actions.onFavorite(place.source)}
      aria-pressed={on} aria-label={on ? `取消收藏 ${place.name}` : `收藏 ${place.name}`}>
      <Heart size={14} />{!iconOnly && <span>{on ? '已收藏' : '收藏'}</span>}
    </button>
  )
}

export function ShareButton({ place, actions }: { place: ExplorePlace; actions: ExploreActions }) {
  return (
    <button type="button" className="xp-fav is-icon" onClick={() => actions.onShare(place.source)} aria-label={`分享 ${place.name}`}>
      <Share2 size={14} />
    </button>
  )
}

/** 已加入的地点显示「✓ 已加入」（不可再点）；加入中禁用，避免重复提交 */
export function AddButton({ place, actions, primary = false }: { place: ExplorePlace; actions: ExploreActions; primary?: boolean }) {
  const busy = actions.busy.has(place.id)
  return (
    <button type="button" className={`xp-add${primary ? ' is-primary' : ''}${place.joined ? ' is-joined' : ''}`} disabled={place.joined || busy}
      onClick={() => actions.onAdd(place.source)} aria-label={place.joined ? `${place.name} 已加入旅行` : `把 ${place.name} 加入旅行`}>
      {place.joined ? <><Check size={14} /> 已加入</> : <><Plus size={14} /> {busy ? '加入中…' : '加入旅行'}</>}
    </button>
  )
}
