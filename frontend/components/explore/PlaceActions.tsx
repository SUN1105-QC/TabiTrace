'use client'

/** 地点卡上的操作：收藏（心形）、分享、加入当前旅行。状态由页面统一管理。 */

import { Check, Heart, Plus, Share2 } from 'lucide-react'
import type { PlaceView } from '@/services/tabitrace-api'

export type ExploreActions = {
  added: Set<number>
  favorites: Set<number>
  busy: Set<number>
  onAdd: (p: PlaceView) => void
  onFavorite: (p: PlaceView) => void
  onShare: (p: PlaceView) => void
}

export function FavoriteButton({ place, actions, light = false }: { place: PlaceView; actions: ExploreActions; light?: boolean }) {
  const on = actions.favorites.has(place.id)
  return (
    <button type="button" className={`ex-icon-btn${on ? ' is-on' : ''}${light ? ' is-light' : ''}`} onClick={() => actions.onFavorite(place)}
      aria-pressed={on} aria-label={on ? `取消收藏 ${place.name}` : `收藏 ${place.name}`} title={on ? '已收藏' : '收藏'}>
      <Heart size={15} />
    </button>
  )
}

export function ShareButton({ place, actions }: { place: PlaceView; actions: ExploreActions }) {
  return (
    <button type="button" className="ex-icon-btn" onClick={() => actions.onShare(place)} aria-label={`分享 ${place.name}`} title="分享">
      <Share2 size={14} />
    </button>
  )
}

export function AddButton({ place, actions, primary = false }: { place: PlaceView; actions: ExploreActions; primary?: boolean }) {
  const added = actions.added.has(place.id)
  const busy = actions.busy.has(place.id)
  return (
    <button type="button" className={`ex-add${primary ? ' is-primary' : ''}${added ? ' is-added' : ''}`} disabled={added || busy} onClick={() => actions.onAdd(place)}>
      {added ? <><Check size={14} /> 已在旅行中</> : <><Plus size={14} /> {busy ? '加入中…' : '加入当前旅行'}</>}
    </button>
  )
}
