'use client'

/**
 * 标准地点卡：封面、类别、名称、一句介绍、区域、建议停留与最佳时间。
 * 主按钮是轻量的「加入当前旅行」，收藏与分享是次级图标——像旅行推荐卡，不像商品卡。
 */

import { Clock3, MapPin, Sun } from 'lucide-react'
import type { PlaceView } from '@/services/tabitrace-api'
import { stayLabel } from '@/utils/explore'
import { PlaceCover } from './PlaceCover'
import { AddButton, FavoriteButton, ShareButton, type ExploreActions } from './PlaceActions'

export function PlaceCard({ place, actions, highlight, distance }: { place: PlaceView; actions: ExploreActions; highlight?: boolean; distance?: string }) {
  return (
    <article id={`place-${place.id}`} className={`ex-card ex-place${highlight ? ' is-highlight' : ''}`}>
      <div className="ex-place-media">
        <PlaceCover place={place} />
        <span className="ex-chip is-on-image">{place.category}</span>
        {distance && <span className="ex-distance">{distance}</span>}
      </div>
      <div className="ex-place-body">
        <h3>{place.name}</h3>
        <p>{place.tagline ?? place.description}</p>
        <ul className="ex-meta">
          <li><MapPin size={12} />{place.area ?? '东京'}</li>
          {place.stayMinutes ? <li><Clock3 size={12} />建议 {stayLabel(place.stayMinutes)}</li> : null}
          {place.bestTime && <li><Sun size={12} />{place.bestTime}</li>}
        </ul>
        <div className="ex-place-actions">
          <AddButton place={place} actions={actions} />
          <FavoriteButton place={place} actions={actions} />
          <ShareButton place={place} actions={actions} />
        </div>
      </div>
    </article>
  )
}
