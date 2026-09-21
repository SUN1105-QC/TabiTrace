'use client'

/**
 * 推荐探索：来自官方城市地点库（/official-cities/{code}/places），
 * 过滤掉当前旅行已加入的地点，按商圈去重后取前 3 条，全部是真实数据。
 */

import Link from 'next/link'
import { ArrowRight, ChevronRight } from 'lucide-react'
import type { PlaceView } from '@/services/tabitrace-api'
import { placeImage } from '@/lib/placeImage'

export function ExploreRecommendations({ places, cityCode = 'tokyo' }: { places: PlaceView[]; cityCode?: string }) {
  const exploreHref = `/explore/${cityCode.toLowerCase()}`

  return (
    <section className="warm-card home-block m-explore">
      <div className="panel-head">
        <h3>推荐探索</h3>
        <Link href={exploreHref} className="panel-link">查看全部 <ArrowRight size={12} /></Link>
      </div>

      {places.length === 0 ? (
        <div className="empty-block">
          <p className="empty-title">暂时没有新的推荐</p>
          <p className="empty-desc">官方地点已经全部加入当前旅行，去探索页看看其他城市吧。</p>
        </div>
      ) : (
        <ul className="m-explore-list">
          {places.map((place, index) => (
            <li key={place.id}>
              <Link href={exploreHref}>
                <span className="m-explore-thumb">
                  <img src={placeImage(place, index)} alt={place.name} loading="lazy" />
                </span>
                <span className="m-explore-body">
                  <b>{place.name}</b>
                  <small>{[place.area, place.category].filter(Boolean).join(' · ') || place.city || '官方推荐地点'}</small>
                </span>
                <ChevronRight size={17} className="m-explore-arrow" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
