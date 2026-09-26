'use client'

/** 移动端旅行详情的内容区块：关于这趟旅行、成果准备度、最近记录、下一步。 */

import Link from 'next/link'
import { ArrowRight, Camera, Check, Circle, MapPin } from 'lucide-react'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'
import type { RecentRecord, TripSummary, TripView } from '@/services/tabitrace-api'
import { calculateTravelReadiness, getTripPrimaryAction, isArchived, recordDetail, recordTime, tripMetaLine, type TripAction } from '@/utils/trip'

/** 旅迹没有“旅行描述”字段，这里只陈述真实的元数据，不替用户编写经历 */
export function TripAbout({ trip, summary }: { trip: TripView; summary: TripSummary }) {
  const extra = [summary.areas > 0 ? `走过 ${summary.areas} 个区域` : '', summary.cities > 1 ? `${summary.cities} 座城市` : ''].filter(Boolean).join(' · ')
  return (
    <section className="td-card td-about">
      <h2>关于这趟旅行</h2>
      <p>{tripMetaLine(trip, summary)}</p>
      {extra && <p className="td-meta">{extra}</p>}
    </section>
  )
}

export function TravelReadinessCard({ trip, summary }: { trip: TripView; summary: TripSummary }) {
  const r = calculateTravelReadiness(trip, summary)
  const cta = r.ready
    ? { href: `/trips/${trip.id}/share`, label: '生成旅行成果' }
    : isArchived(trip) ? { href: `/trips/${trip.id}/summary`, label: '查看旅行总结' } : { href: `/trips/${trip.id}/map`, label: '继续完善旅程' }
  return (
    <section className="td-card td-ready">
      <p className="td-eyebrow">TRAVEL READINESS</p>
      <div className="td-ready-head">
        <h2 id="td-ready-title">成果准备度</h2>
        <b>{r.percent}%</b>
      </div>
      <div className="td-progress" role="progressbar" aria-labelledby="td-ready-title" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.percent}>
        <span style={{ width: `${r.percent}%` }} />
      </div>
      <ul className="td-ready-list">
        {r.items.map(i => (
          <li key={i.key} className={i.done ? 'is-done' : ''}>
            {i.done ? <Check size={15} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
            <span className="sr-only">{i.done ? '已完成：' : '未完成：'}</span>
            {i.href ? <Link href={i.href}>{i.text}</Link> : <span>{i.text}</span>}
          </li>
        ))}
      </ul>
      <Link href={cta.href} className="td-btn is-primary">{cta.label} <ArrowRight size={16} /></Link>
    </section>
  )
}

/** 最近 2~3 条真实记录；没有记录时整个区块不渲染 */
export function RecentRecords({ tripId, records }: { tripId: number; records: RecentRecord[] }) {
  if (records.length === 0) return null
  return (
    <section className="td-card td-recent">
      <div className="td-sec-head">
        <h2>最近记录</h2>
        <Link href={`/trips/${tripId}/map`}>时间轴 <ArrowRight size={13} /></Link>
      </div>
      <ul>
        {records.map((r, i) => (
          <li key={`${r.kind}-${r.checkinId ?? i}-${r.at}`}>
            <Link href={r.kind === 'PHOTOS' ? `/trips/${tripId}/gallery` : `/trips/${tripId}/map`}>
              <span className="td-thumb">
                {r.thumbnailUrl
                  ? <img src={r.thumbnailUrl} alt="" loading="lazy" decoding="async" width={56} height={56} />
                  : r.kind === 'PHOTOS' ? <Camera size={18} aria-hidden="true" /> : <MapPin size={18} aria-hidden="true" />}
              </span>
              <span className="td-recent-text">
                <b>{r.kind === 'PHOTOS' ? '旅行照片' : r.placeName || '打卡'}</b>
                <small>{recordTime(r.at)}{r.area && r.kind === 'CHECKIN' ? ` · ${r.area}` : ''}</small>
                <em>{recordDetail(r)}</em>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

const HINT: Record<string, string> = {
  PLANNING: '出发前，把想去的地方排进行程。',
  ONGOING: '今天还可以继续记录这些内容。',
  COMPLETED: '旅程已经结束，把它整理成一份成果吧。',
  ARCHIVED: '这段旅程已归档，可以随时回看。'
}

/** 下一步：主操作与次操作随旅行状态变化；快速打卡与底部导航调用同一个 openQuickCheckIn */
export function NextActions({ trip }: { trip: TripView }) {
  const { openQuickCheckIn } = useQuickCheckIn()
  const { primary, secondary } = getTripPrimaryAction(trip)
  const render = (a: TripAction, cls: string) => a.kind === 'checkin'
    ? <button key={a.key} type="button" className={cls} onClick={() => openQuickCheckIn(trip.id)}>{a.label}</button>
    : <Link key={a.key} href={a.href} className={cls}>{a.label}</Link>
  return (
    <section className="td-card td-next">
      <p className="td-eyebrow">NEXT</p>
      <h2>继续留下旅迹</h2>
      <p>{HINT[trip.status] ?? HINT.ONGOING}</p>
      <div className="td-next-actions">
        {render(primary, 'td-btn is-primary')}
        <div className="td-next-secondary">{secondary.map(a => render(a, 'td-btn'))}</div>
      </div>
    </section>
  )
}
