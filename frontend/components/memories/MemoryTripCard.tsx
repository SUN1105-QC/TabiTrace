'use client'

/**
 * 内容型旅行回忆卡：封面、状态、目的地、标题、日期、摘要、一行轻量统计、精选瞬间、已有成果、主操作。
 * 摘要优先用自己写下的打卡文字，没有就用轻量元信息，不代写旅行经历。
 * FeaturedMemoryCard 是左图右文的大卡（手机上改为上图下文），作为首屏的视觉锚点。
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Film, Image as ImageIcon, MapPin, MoreHorizontal, Share2, Trophy } from 'lucide-react'
import type { MemoryTrip } from '@/services/memories'
import { dateRange, statLine, statusLabel } from '@/utils/memories'
import { MemoryCover } from './MemoryCover'

function Summary({ trip }: { trip: MemoryTrip }) {
  if (trip.note) {
    return (
      <p className="mm-quote">
        “{trip.note.text}”{trip.note.place && <small>— 写于 {trip.note.place}</small>}
      </p>
    )
  }
  const meta = [trip.city, trip.places ? `${trip.places} 个地点` : '', trip.photos ? `${trip.photos} 张旅行照片` : ''].filter(Boolean).join(' · ')
  return <p className="mm-meta-line">{meta}</p>
}

/** 精选瞬间：最多 3 张真实照片，还有更多时最后一张显示 +N；点击进入这段旅行的照片页 */
export function MemoryMoments({ trip }: { trip: MemoryTrip }) {
  if (!trip.moments.length) return null
  return (
    <div className="mm-moments">
      <p className="mm-label">精选瞬间</p>
      <div className="mm-moments-row">
        {trip.moments.map((m, i) => (
          <Link key={m.id} href={`/trips/${trip.id}/gallery`} className="mm-moment" aria-label={`查看「${trip.title}」的照片`}>
            <img src={m.imageUrl} alt="" loading="lazy" />
            {i === trip.moments.length - 1 && trip.moreMoments > 0 && <span>+{trip.moreMoments}</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}

/** 已有成果：只显示真实存在的 Travel Story 与分享页 */
function Creations({ trip }: { trip: MemoryTrip }) {
  if (!trip.stories && !trip.shareLinks) return null
  return (
    <div className="mm-trip-creations">
      {trip.stories > 0 && <Link href={`/trips/${trip.id}/video`}><Film size={12} /> Travel Story{trip.stories > 1 ? ` × ${trip.stories}` : ''}</Link>}
      {trip.shareLinks > 0 && <Link href={`/trips/${trip.id}/share`}><Share2 size={12} /> 分享页{trip.shareLinks > 1 ? ` × ${trip.shareLinks}` : ''}</Link>}
    </div>
  )
}

function MoreMenu({ trip }: { trip: MemoryTrip }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className="mm-more" ref={ref}>
      <button type="button" className="mm-icon-btn" onClick={() => setOpen(o => !o)} aria-label="更多" aria-expanded={open}><MoreHorizontal size={16} /></button>
      {open && (
        <div className="mm-menu" role="menu">
          <Link role="menuitem" href={`/trips/${trip.id}/map`}><MapPin size={13} /> 地图与打卡</Link>
          <Link role="menuitem" href={`/trips/${trip.id}/gallery`}><ImageIcon size={13} /> 全部照片</Link>
          <Link role="menuitem" href={`/trips/${trip.id}/achievements`}><Trophy size={13} /> 旅行成就</Link>
        </div>
      )}
    </div>
  )
}

function Actions({ trip }: { trip: MemoryTrip }) {
  return (
    <div className="mm-trip-actions">
      <Link href={`/trips/${trip.id}/summary`} className="mm-btn is-primary">回看这段旅程 <ArrowRight size={14} /></Link>
      <Link href={`/trips/${trip.id}/share`} className="mm-text-btn">查看成果</Link>
      <Link href={`/trips/${trip.id}/video`} className="mm-text-btn">Travel Story</Link>
      <MoreMenu trip={trip} />
    </div>
  )
}

export function MemoryTripCard({ trip }: { trip: MemoryTrip }) {
  return (
    <article className="mm-card mm-trip">
      <div className="mm-trip-media">
        <MemoryCover src={trip.cover} city={trip.city} title={trip.title} />
        <span className="mm-status">{statusLabel(trip.status)}</span>
      </div>
      <div className="mm-trip-body">
        <p className="mm-dest"><MapPin size={12} /> {trip.city}</p>
        <h3>{trip.title}</h3>
        <p className="mm-date">{dateRange(trip.startDate, trip.endDate)}{trip.days ? ` · ${trip.days} 天` : ''}</p>
        <Summary trip={trip} />
        <p className="mm-stats">{statLine(trip)}</p>
        <MemoryMoments trip={trip} />
        <Creations trip={trip} />
        <Actions trip={trip} />
      </div>
    </article>
  )
}

export function FeaturedMemoryCard({ trip }: { trip: MemoryTrip }) {
  return (
    <article className="mm-card mm-featured">
      <div className="mm-featured-media">
        <MemoryCover src={trip.cover} city={trip.city} title={trip.title} />
        <span className="mm-status">{statusLabel(trip.status)}</span>
      </div>
      <div className="mm-featured-body">
        <p className="mm-eyebrow">LATEST MEMORY</p>
        <p className="mm-dest"><MapPin size={12} /> {trip.city}</p>
        <h2>{trip.title}</h2>
        <p className="mm-date">{dateRange(trip.startDate, trip.endDate)}{trip.days ? ` · ${trip.days} 天` : ''}</p>
        <Summary trip={trip} />
        <p className="mm-stats">{statLine(trip)}</p>
        <Creations trip={trip} />
        <Link href={`/trips/${trip.id}/summary`} className="mm-btn is-primary">回看这段旅程 <ArrowRight size={14} /></Link>
      </div>
    </article>
  )
}
