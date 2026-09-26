'use client'

/**
 * 移动端 Hero：封面 + 底部渐变，左下角城市 / PRO / 标题 / 日期与人数，右上角“···”操作。
 * 没有封面（或封面加载失败）时不借用 /images/cover.jpg：那张图印着某次旅行的日期与标题，
 * 放在别的旅行上会显示错误信息，这里改用品牌暖色底 + 目的地首字。
 */

import { useEffect, useRef, useState } from 'react'
import type { TripView } from '@/services/tabitrace-api'
import { dotDate } from '@/utils/trip'
import { TripMoreMenu } from './TripMoreMenu'

export function TripHero({ trip, onChanged, onToast }: { trip: TripView; onChanged: (t: TripView) => void; onToast: (msg: string) => void }) {
  const [failed, setFailed] = useState(false)
  const img = useRef<HTMLImageElement | null>(null)
  const cover = !failed && trip.coverImage ? trip.coverImage : null
  // 图片可能在事件绑定前就已加载失败（onError 收不到），挂载后再检查一次
  useEffect(() => {
    const el = img.current
    if (el && el.complete && el.naturalWidth === 0) setFailed(true)
  }, [cover])

  return (
    <section className={`td-hero${cover ? '' : ' is-blank'}`}>
      {cover
        // 首屏最大的图片，不做 lazy，避免拖慢 LCP
        ? <img ref={img} src={cover} alt="" fetchPriority="high" onError={() => setFailed(true)} />
        : <span className="td-hero-mark" aria-hidden="true">{Array.from(trip.destinationName || '旅')[0]}</span>}
      <div className="td-hero-shade" aria-hidden="true" />
      <TripMoreMenu trip={trip} onChanged={onChanged} onToast={onToast} />
      <div className="td-hero-info">
        <div className="td-hero-tags">
          <span title={trip.destinationName}>{trip.destinationName}</span>
          {trip.planType === 'PRO' && <span className="is-pro">PRO</span>}
        </div>
        <h1 title={trip.title}>{trip.title}</h1>
        <p>{dotDate(trip.startDate)} — {dotDate(trip.endDate)} · {trip.peopleCount || 1} 人同行</p>
      </div>
    </section>
  )
}
