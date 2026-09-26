'use client'

/**
 * 实时旅行预览：随表单即时变化。
 * 封面：目的地官方封面 → 没有时用品牌暖色底 + 目的地首字
 * （不借用 /images/cover.jpg：那张图印着某次东京旅行的标题和日期，放在别的旅行上会显示错误信息）。
 */

import { useState } from 'react'
import { CalendarDays, Camera, Clock3, Map as MapIcon, Sparkles, Users } from 'lucide-react'
import { calculateTripDuration, formatTripDateRange, timezoneOffsetLabel, type PickedDestination } from '@/utils/journey'

export function JourneyPreview({ title, destination, startDate, endDate, travelers, joinOfficial, compact = false }: {
  title: string
  destination: PickedDestination | null
  startDate: string
  endDate: string
  travelers: number
  joinOfficial: boolean
  compact?: boolean
}) {
  const [broken, setBroken] = useState<string | null>(null)
  const duration = calculateTripDuration(startDate, endDate)
  const range = formatTripDateRange(startDate, endDate)
  const cover = destination?.coverImage && broken !== destination.coverImage ? destination.coverImage : null
  const official = joinOfficial && destination?.official ? destination.official : null
  const tz = timezoneOffsetLabel(destination?.timezone)
  const place = destination ? [destination.name, destination.countryName].filter(Boolean).join(' · ') : '还没有选择目的地'

  return (
    <section className={`cj-preview${compact ? ' is-compact' : ''}`} aria-label="旅行预览" aria-live="polite">
      <div className={`cj-cover${cover ? '' : ' is-blank'}`}>
        {cover
          ? <img src={cover} alt="" onError={() => setBroken(cover)} />
          : <span className="cj-cover-mark" aria-hidden="true">{Array.from(destination?.name || '旅')[0]}</span>}
        <div className="cj-cover-shade" aria-hidden="true" />
        <div className="cj-cover-info">
          <p className="cj-eyebrow-light">NEW JOURNEY</p>
          <p className="cj-cover-place">{place}</p>
          <h2 className={title.trim() ? '' : 'is-placeholder'}>{title.trim() || '给这段旅行起个名字'}</h2>
        </div>
      </div>

      <dl className="cj-facts">
        <div><dt><CalendarDays size={14} aria-hidden="true" />日期</dt><dd>{range || '—'}</dd></div>
        <div><dt><Clock3 size={14} aria-hidden="true" />时长</dt><dd>{duration.ok ? duration.label : '—'}</dd></div>
        <div><dt><Users size={14} aria-hidden="true" />同行</dt><dd>{travelers} 人</dd></div>
        {tz && !compact && <div><dt><Clock3 size={14} aria-hidden="true" />当地时区</dt><dd>{tz}</dd></div>}
      </dl>

      {!compact && (
        <div className="cj-prepared">
          <p>创建后将准备</p>
          <ul>
            <li><CalendarDays size={15} aria-hidden="true" />旅行时间轴</li>
            <li><MapIcon size={15} aria-hidden="true" />地图与打卡</li>
            <li><Camera size={15} aria-hidden="true" />照片空间</li>
            {official && <li className="is-official"><Sparkles size={15} aria-hidden="true" />{official.name}官方探索 · {official.placeCount} 个地点</li>}
          </ul>
        </div>
      )}
    </section>
  )
}
