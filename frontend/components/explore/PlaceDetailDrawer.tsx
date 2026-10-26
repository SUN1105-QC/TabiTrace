'use client'

/**
 * 地点详情：卡片上只放一句话，完整内容都在这里——介绍、推荐理由、地址、最佳时间、建议停留、
 * 所属专题、旅行记录（是否已加入 / 打卡、多少段旅行加入过），以及收藏、分享、在地图上查看、加入旅行。
 * 以抽屉形式打开（地址带 #place-{id}，可以直接分享），不另建页面。
 */

import { useEffect } from 'react'
import { Check, Clock3, Map as MapIcon, MapPin, Route, Sun, X } from 'lucide-react'
import type { OfficialRouteView } from '@/services/tabitrace-api'
import { TAG_LABELS, stayLabel, type ExplorePlace } from '@/utils/explore'
import { ImageCredit } from '@/components/common/ImageCredit'
import { COVER_SIZES, PlaceCover } from './PlaceCover'
import { AddButton, FavoriteButton, ShareButton, type ExploreActions } from './PlaceActions'

export function PlaceDetailDrawer({ place, routes, actions, tripTitle, onOpenRoute, onShowOnMap, onClose }: {
  place: ExplorePlace
  routes: OfficialRouteView[]
  actions: ExploreActions
  tripTitle?: string
  onOpenRoute: (r: OfficialRouteView) => void
  onShowOnMap: (p: ExplorePlace) => void
  onClose: () => void
}) {
  const p = place.source
  const inRoutes = routes.filter(r => r.placeIds.includes(p.id))
  const tags = (p.tags ?? []).map(t => TAG_LABELS[t]).filter(Boolean)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ex-drawer-backdrop" onClick={onClose}>
      <aside className="ex-drawer xp-detail" role="dialog" aria-modal="true" aria-labelledby="xp-detail-title" onClick={e => e.stopPropagation()}>
        <div className="xp-detail-media">
          <PlaceCover place={p} eager sizes={COVER_SIZES.detail} />
          <button type="button" className="ex-drawer-close" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </div>
        <div className="ex-drawer-body">
          <p className="xp-card-meta">{place.area} · {place.category}</p>
          <h2 id="xp-detail-title">{place.name}</h2>
          {(place.joined || place.checkedIn) && (
            <p className="xp-detail-status">
              {place.checkedIn ? <span><Check size={12} /> 已打卡</span> : <span><Check size={12} /> 已加入{tripTitle ? `「${tripTitle}」` : '旅行'}</span>}
            </p>
          )}
          {p.tagline && <p className="xp-detail-lead">{p.tagline}</p>}
          {p.description && p.description !== p.tagline && <p className="xp-detail-desc">{p.description}</p>}
          {p.recommendReason && <p className="xp-detail-reason"><b>推荐理由</b>{p.recommendReason}</p>}

          <dl className="xp-detail-info">
            {p.address && <div><dt><MapPin size={13} /> 地址</dt><dd>{p.address}</dd></div>}
            {p.bestTime && <div><dt><Sun size={13} /> 最佳时间</dt><dd>{p.bestTime}</dd></div>}
            {p.stayMinutes ? <div><dt><Clock3 size={13} /> 建议停留</dt><dd>{stayLabel(p.stayMinutes)}</dd></div> : null}
            {tags.length > 0 && <div><dt>标签</dt><dd>{tags.join(' · ')}</dd></div>}
            {(p.tripCount ?? 0) > 0 && <div><dt>旅行记录</dt><dd>已有 {p.tripCount} 段旅迹旅行加入过这里</dd></div>}
          </dl>

          <ImageCredit url={p.coverImage} />
          {inRoutes.length > 0 && (
            <div className="xp-detail-routes">
              <b><Route size={13} /> 收录在专题</b>
              {inRoutes.map(r => <button key={r.id} type="button" className="xp-link" onClick={() => onOpenRoute(r)}>{r.title}</button>)}
            </div>
          )}
        </div>
        <footer className="ex-drawer-foot xp-detail-foot">
          <FavoriteButton place={place} actions={actions} />
          <ShareButton place={place} actions={actions} />
          <button type="button" className="xp-fav" onClick={() => onShowOnMap(place)}><MapIcon size={14} /><span>地图</span></button>
          <AddButton place={place} actions={actions} primary />
        </footer>
      </aside>
    </div>
  )
}
