'use client'

/**
 * 旅行封面：有封面（且加载成功）时显示照片；没有封面时画一张暖色渐变封面（目的地首字 + 城市名）。
 * 不再借用 /images/cover.jpg —— 那张示例图印着某次东京旅行的标题和「10.01—10.06 6天5晚」，放在别的旅行上会显示错误信息。
 * 占满父容器（父容器负责尺寸与圆角），与旅行详情页 TripHero 的空白封面同一套视觉。
 */

import { useState } from 'react'
import { hdSrcSet } from '@/utils/place-images'

export function TripCoverImage({ trip, alt, loading = 'lazy', compact = false, sizes = '(max-width: 767px) 100vw, 50vw' }: {
  trip: { coverImage?: string | null; destinationName?: string | null; city?: string | null; title?: string }
  /** 官方高清封面按显示宽度选档 */
  sizes?: string
  alt?: string
  loading?: 'lazy' | 'eager'
  /** 小缩略图：只画首字，不写城市名 */
  compact?: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (trip.coverImage && !failed) {
    return <img src={trip.coverImage} srcSet={hdSrcSet(trip.coverImage)} sizes={sizes} alt={alt ?? trip.title ?? ''} loading={loading} onError={() => setFailed(true)} />
  }
  const place = trip.destinationName || trip.city || ''
  const mark = Array.from(place || trip.title || '旅')[0]
  return (
    <span className={`trip-cover-art${compact ? ' is-compact' : ''}`} role="img" aria-label={alt ?? `${trip.title ?? '旅行'} 封面`}>
      <b aria-hidden="true">{mark}</b>
      {!compact && place && <small aria-hidden="true">{place}</small>}
    </span>
  )
}
