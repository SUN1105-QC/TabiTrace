'use client'

/**
 * 旅行总结页的组件（样式前缀 su-）。数据全部来自 useTripSummaryData，桌面与手机共用同一份。
 */

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { ArrowRight, Check, Circle, Film, Image as ImageIcon, MapPin } from 'lucide-react'
import type { AchievementView, TripSummary, TripView } from '@/services/tabitrace-api'
import type { VideoProject } from '@/types/video'
import type { GalleryItem } from '@/utils/gallery'
import { calculateTravelReadiness } from '@/utils/trip'
import { dayLabel, dayTitle } from '@/utils/travel-map'
import { hasExploreGuide, journeyHighlights, summarySentence, type DailyRecord } from '@/utils/summary'
import { AchievementBadge } from '@/components/achievements/AchievementBadge'
import { photoThumb } from '@/utils/photo-variants'

/* ---------------------------------------------------------------- 概览（2 × 3） */

export function SummaryOverview({ trip, s }: { trip: TripView; s: TripSummary }) {
  const guide = hasExploreGuide(s)
  const cells: [string, string | number, string][] = [
    ['days', s.days, '天'], ['places', s.places, '地点'], ['photos', s.photos, '照片'],
    ['achievements', s.achievements, '成就'], ['areas', s.areas, '区域']
  ]
  return (
    <section className="su-card su-overview" aria-label="旅行概览">
      <dl className="su-stats">
        {cells.map(([key, value, label]) => (
          <div key={key} className="su-stat"><dd>{value}</dd><dt>{label}</dt></div>
        ))}
        <div className="su-stat is-explore">
          {guide ? (
            <Link href="/explore/tokyo" className="su-explore" aria-label={`探索度 ${s.explorationRate}%，已打卡 ${s.officialPlacesCompleted} / ${s.officialPlacesTotal} 个官方地点，查看东京探索`}>
              <dd>{s.explorationRate}<small>%</small></dd>
              <dt>探索度</dt>
              <span className="su-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.explorationRate} aria-label="探索度">
                <i style={{ width: `${Math.max(2, s.explorationRate)}%` }} />
              </span>
            </Link>
          ) : (
            <><dd className="is-muted">—</dd><dt>探索度 · 暂无官方地点</dt></>
          )}
        </div>
      </dl>
      <div className="su-story">
        <h2 className="su-h3">这趟旅行</h2>
        <p>{summarySentence(trip, s)}</p>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- 按天回看 */

type DayPlaces = Map<string, { id: number; name: string; area?: string }[]>
type DayPhotos = Map<string, GalleryItem[]>

export function DailyReview({ tripId, s, selected, onSelect, places, photos }: {
  tripId: number; s: TripSummary; selected: string; onSelect: (date: string) => void; places: DayPlaces; photos: DayPhotos
}) {
  const days = s.dailyRecords.map(d => d.date)
  const bar = useRef<HTMLDivElement | null>(null)
  // 选中项滚到可见区域
  useEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selected])
  const day = s.dailyRecords.find(d => d.date === selected) ?? s.dailyRecords[0]
  if (!day) return null

  return (
    <section className="su-card su-daily" aria-labelledby="su-daily-title">
      <div className="su-head-row">
        <h2 id="su-daily-title" className="su-h2">每天留下了什么</h2>
        <span className="su-muted">{s.dailyRecords.filter(d => d.hasRecord).length} / {s.days} 天有记录</span>
      </div>
      <div ref={bar} className="su-days" role="tablist" aria-label="选择日期">
        {s.dailyRecords.map(d => (
          <button
            key={d.date} type="button" role="tab" aria-selected={d.date === day.date} aria-controls="su-day-panel"
            className={`su-day${d.date === day.date ? ' is-active' : ''}${d.hasRecord ? ' has-record' : ''}`}
            onClick={() => onSelect(d.date)}
          >
            <b>{dayLabel(days, d.date)}</b>
            <small>{d.date.slice(5).replace('-', '.')}</small>
            {d.hasRecord && <i aria-label="有记录" />}
          </button>
        ))}
      </div>
      <DayDetail id="su-day-panel" tripId={tripId} days={days} day={day} places={places.get(day.date) ?? []} photos={photos.get(day.date) ?? []} />
    </section>
  )
}

function DayDetail({ id, tripId, days, day, places, photos }: {
  id: string; tripId: number; days: string[]; day: DailyRecord; places: { id: number; name: string; area?: string }[]; photos: GalleryItem[]
}) {
  const shownPlaces = places.slice(0, 4)
  const shownPhotos = photos.slice(0, 4)
  const morePhotos = Math.max(0, day.photos - shownPhotos.length, photos.length - shownPhotos.length)
  return (
    <div id={id} role="tabpanel" className="su-day-panel">
      <div className="su-day-head">
        <p><b>{dayLabel(days, day.date)}</b> · {dayTitle(day.date)}</p>
        <span>{day.checkins} 次打卡 · {day.photos} 张照片</span>
      </div>
      {!day.hasRecord ? (
        <p className="su-day-empty">这一天没有留下记录。</p>
      ) : (
        <>
          {shownPlaces.length > 0 && (
            <ul className="su-places">
              {shownPlaces.map(p => <li key={p.id}><MapPin size={14} aria-hidden="true" /><span>{p.name}</span>{p.area && <small>{p.area}</small>}</li>)}
              {places.length > shownPlaces.length && <li className="is-more">还有 {places.length - shownPlaces.length} 个地点</li>}
            </ul>
          )}
          {shownPhotos.length > 0 && (
            <div className="su-thumbs">
              {shownPhotos.map((it, i) => {
                const last = i === shownPhotos.length - 1 && morePhotos > 0
                return (
                  <Link key={it.photo.id} href={`/trips/${tripId}/gallery`} className="su-thumb" aria-label={last ? `查看全部 ${day.photos} 张照片` : `查看照片：${it.checkin?.placeName ?? dayTitle(day.date)}`}>
                    <img src={photoThumb(it.photo)} alt={it.checkin?.placeName ?? ''} loading="lazy" decoding="async" />
                    {last && <span>+{morePhotos}</span>}
                  </Link>
                )
              })}
            </div>
          )}
          <div className="su-day-links">
            <Link href={`/trips/${tripId}/map`}>在地图与时间轴中查看 <ArrowRight size={14} aria-hidden="true" /></Link>
            {day.photos > 0 && <Link href={`/trips/${tripId}/gallery`}>查看当天照片 <ArrowRight size={14} aria-hidden="true" /></Link>}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- 旅程亮点 */

export function JourneyHighlights({ s, hideAchievements = false, onPickDay }: { s: TripSummary; hideAchievements?: boolean; onPickDay?: (date: string) => void }) {
  const rows = journeyHighlights(s).filter(r => !(hideAchievements && r.key === 'achievements'))
  if (rows.length === 0) return null
  return (
    <section className="su-card" aria-labelledby="su-hl-title">
      <h2 id="su-hl-title" className="su-h2">旅程亮点</h2>
      <dl className="su-rows">
        {rows.map(r => (
          <div key={r.key}>
            <dt>{r.label}</dt>
            <dd>{r.date && onPickDay
              ? <button type="button" onClick={() => onPickDay(r.date!)} aria-label={`${r.label}：${r.value}，在上方查看这一天`}>{r.value}<ArrowRight size={13} aria-hidden="true" /></button>
              : r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ---------------------------------------------------------------- 本次成就 */

export function AchievementsPreview({ tripId, earned }: { tripId: number; earned: AchievementView[] }) {
  if (earned.length === 0) return null
  return (
    <section className="su-card" aria-labelledby="su-ach-title">
      <div className="su-head-row">
        <h2 id="su-ach-title" className="su-h2">本次成就</h2>
        <span className="su-muted">{earned.length} 个</span>
      </div>
      <ul className="su-badges">
        {earned.slice(0, 4).map(a => (
          <li key={a.id}><AchievementBadge achievement={a} size={48} /><span>{a.name}</span></li>
        ))}
      </ul>
      <Link href={`/trips/${tripId}/achievements`} className="su-link">查看全部成就 <ArrowRight size={14} aria-hidden="true" /></Link>
    </section>
  )
}

/* ---------------------------------------------------------------- 旅行成果 */

export function OutputReadiness({ trip, s, story, storyCoverUrl, shareUrl, onComplete, completing }: {
  trip: TripView; s: TripSummary; story: VideoProject | null; storyCoverUrl?: string | null; shareUrl?: string | null
  onComplete: () => void; completing: boolean
}) {
  // 已经生成过 Travel Story 时，这一项视为完成（后端的 videoReady 只表示“现在能否生成”）
  const items = calculateTravelReadiness(trip, s).items.map(i => (i.key === 'story' && story ? { ...i, done: true, text: 'Travel Story 已生成' } : i))
  const allDone = items.every(i => i.done) && s.readiness.shareReady
  const tripId = trip.id
  return (
    <section className="su-output" aria-labelledby="su-out-title">
      <p className="su-output-eyebrow">{allDone ? 'OUTPUT READY' : 'OUTPUT READINESS'}</p>
      <h2 id="su-out-title">旅行成果</h2>
      <ul className="su-ready">
        {items.map(i => (
          <li key={i.key} className={i.done ? 'is-done' : undefined}>
            {i.done ? <Check size={15} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />}
            <span>{i.text}</span>
            <span className="sr-only">{i.done ? '（已完成）' : '（未完成）'}</span>
          </li>
        ))}
        <li className={s.readiness.shareReady ? 'is-done' : undefined}>
          {s.readiness.shareReady ? <Check size={15} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />}
          <span>{shareUrl ? '分享成果已发布' : s.readiness.shareReady ? '分享成果可以生成' : '完成一次打卡后可生成分享成果'}</span>
        </li>
      </ul>

      {story && storyCoverUrl && (
        <Link href={`/trips/${tripId}/video`} className="su-story-thumb" aria-label="查看已生成的 Travel Story">
          <img src={storyCoverUrl} alt="Travel Story 封面" loading="lazy" />
          <div><b>Travel Story 已生成</b><small>{story.duration} 秒 · {story.resolution}</small></div>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}

      <div className="su-output-actions">
        <Link href={`/trips/${tripId}/share`} className="su-btn is-primary"><ImageIcon size={15} aria-hidden="true" />{shareUrl ? '查看分享成果' : '生成分享成果'}</Link>
        <Link href={`/trips/${tripId}/video`} className="su-btn"><Film size={15} aria-hidden="true" />{story ? '查看 Travel Story' : '制作 Travel Story'}</Link>
      </div>
      {trip.status !== 'COMPLETED' && trip.status !== 'ARCHIVED' && (
        <button type="button" onClick={onComplete} disabled={completing} className="su-complete">{completing ? '正在标记…' : '完成这次旅行'}</button>
      )}
    </section>
  )
}

/* ---------------------------------------------------------------- 加载骨架 */

export function SummarySkeleton() {
  return (
    <div className="su-skeleton" aria-busy="true" aria-label="正在加载旅行总结">
      <div className="skeleton su-sk-head" />
      <div className="skeleton su-sk-overview" />
      <div className="su-sk-days">{Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton" />)}</div>
      <div className="skeleton su-sk-day" />
      <div className="skeleton su-sk-ready" />
    </div>
  )
}
