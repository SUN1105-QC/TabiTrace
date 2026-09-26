'use client'

/**
 * 专题路线：官方内容库里按顺序串起的一组地点，不是单个地点。
 * RouteCard 用于「按主题探索东京」三列；RouteBanner 是插在全部地点列表中间的横幅，用来打破重复节奏。
 */

import { ArrowRight, Clock3, Route } from 'lucide-react'
import type { OfficialRouteView, PlaceView } from '@/services/tabitrace-api'

function stops(route: OfficialRouteView, byId: Map<number, PlaceView>) {
  return route.placeIds.map(id => byId.get(id)?.name).filter(Boolean) as string[]
}

export function RouteCard({ route, byId, onOpen }: { route: OfficialRouteView; byId: Map<number, PlaceView>; onOpen: (r: OfficialRouteView) => void }) {
  const names = stops(route, byId)
  return (
    <button type="button" className="ex-card ex-route" onClick={() => onOpen(route)}>
      <span className="ex-route-media">
        {route.coverImage && <img src={route.coverImage} alt="" loading="lazy" />}
        {route.season && <em className="ex-season">{route.season}季限定</em>}
      </span>
      <span className="ex-route-body">
        <small>{route.englishTitle.toUpperCase()}</small>
        <b>{route.title}</b>
        <span className="ex-route-desc">{route.description}</span>
        <span className="ex-route-stops">{names.join(' → ')}</span>
        <span className="ex-route-foot">
          <span><Route size={12} /> {names.length} 个地点{route.durationHint ? ` · ${route.durationHint}` : ''}</span>
          <span className="ex-link">查看专题 <ArrowRight size={12} /></span>
        </span>
      </span>
    </button>
  )
}

export function RouteBanner({ route, byId, onOpen }: { route: OfficialRouteView; byId: Map<number, PlaceView>; onOpen: (r: OfficialRouteView) => void }) {
  const names = stops(route, byId)
  return (
    <button type="button" className="ex-banner" onClick={() => onOpen(route)}>
      {route.coverImage && <img src={route.coverImage} alt="" loading="lazy" />}
      <span className="ex-banner-body">
        <small>THEME ROUTE · {route.englishTitle.toUpperCase()}</small>
        <b>{route.title}</b>
        <span>{route.description}</span>
        <em><Clock3 size={12} /> {names.length} 个地点{route.durationHint ? ` · 约${route.durationHint}` : ''} · {names.slice(0, 4).join(' / ')}</em>
      </span>
      <span className="ex-banner-cta">查看专题 <ArrowRight size={14} /></span>
    </button>
  )
}
