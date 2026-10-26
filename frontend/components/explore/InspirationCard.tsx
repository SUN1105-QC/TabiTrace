'use client'

/** 旅行灵感卡：16:9 图片背景，只放专题名、一句说明和入口；途经地点在专题详情里看，首页不展开。 */

import { ArrowRight } from 'lucide-react'
import type { OfficialRouteView } from '@/services/tabitrace-api'
import { PlaceImage } from '@/components/common/PlaceImage'

export function InspirationCard({ route, season, onOpen }: { route: OfficialRouteView; season: string; onOpen: (r: OfficialRouteView) => void }) {
  return (
    <button type="button" className="xp-inspire" onClick={() => onOpen(route)} aria-label={`查看专题：${route.title}`}>
      {route.coverImage && <PlaceImage src={route.coverImage} alt={route.title} sizes="(max-width: 767px) 78vw, (max-width: 1023px) 50vw, 25vw" />}
      <span className="xp-inspire-shade" />
      {route.season === season && <em className="xp-inspire-season">当季</em>}
      <span className="xp-inspire-body">
        <b>{route.title}</b>
        <span>{route.description}</span>
        <small>查看专题 <ArrowRight size={12} /></small>
      </span>
    </button>
  )
}
