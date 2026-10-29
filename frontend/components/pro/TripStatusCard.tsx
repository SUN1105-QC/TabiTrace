'use client'

/**
 * 当前旅行状态卡：让用户明确这次操作的是哪一段旅行、它是否已经升级。
 * - FREE：真实用量（打卡 / 照片对免费上限）+ 升级按钮
 * - 已解锁 Trip Pro（单次升级或买断终身 Pro）：成功状态 + 成果入口，不再出现购买按钮
 * - 未登录 / 没有旅行 / 读取中：对应的入口
 */

import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Crown, Film, MapPin, Share2 } from 'lucide-react'
import { TripCoverImage } from '@/components/trip/TripCoverImage'
import { tripUsage } from '@/utils/plan'
import { PayNotes, PayNotice, UpgradeButton } from './TripProButtons'
import type { TripProState } from './useTripPro'

const dot = (d: string) => d.replace(/-/g, '.')
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1

export function TripStatusCard({ s }: { s: TripProState }) {
  const { plan, loggedIn, trips, trip, summary, loadingTrip, selectTrip, pay, payMessage, mockPaid, checkout, lifetime } = s
  if (!plan) return null

  if (!loggedIn) {
    return (
      <section id="pr-status" className="pr-trip is-empty" aria-label="当前旅行">
        <p>登录后，可以为你的某一段旅行解锁 Trip Pro。</p>
        <Link href="/login?next=%2Fpricing" className="pr-btn is-primary">登录旅迹 <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
    )
  }
  if (loadingTrip) return <section id="pr-status" className="pr-trip is-loading" aria-busy="true" aria-label="正在读取旅行"><div className="skeleton" /></section>
  if (!trip) {
    return (
      <section id="pr-status" className="pr-trip is-empty" aria-label="当前旅行">
        <p>还没有旅行。新旅行可以免费开始，需要时再为它升级。</p>
        <Link href="/trips/new" className="pr-btn is-primary">创建旅行 <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
    )
  }

  const pro = trip.planType === 'PRO'
  const usage = tripUsage(summary, plan)
  const days = summary?.days ?? daysBetween(trip.startDate, trip.endDate)
  const city = trip.city || trip.destinationName

  return (
    <section id="pr-status" className={`pr-trip${pro ? ' is-pro' : ''}`} aria-labelledby="pr-trip-title">
      <div className="pr-trip-cover"><TripCoverImage key={trip.id} trip={trip} alt={`${trip.title} 封面`} sizes="(max-width: 767px) 100vw, 240px" /></div>

      <div className="pr-trip-info">
        <p className="pr-eyebrow">当前旅行</p>
        <h2 id="pr-trip-title">{trip.title}</h2>
        <ul className="pr-trip-meta">
          {city && <li><MapPin size={13} aria-hidden="true" />{city}</li>}
          <li><CalendarDays size={13} aria-hidden="true" />{dot(trip.startDate)} — {dot(trip.endDate)}</li>
          <li>{days} 天</li>
          {summary && <li>{summary.places} 个地点</li>}
        </ul>
        {trips.length > 1 && (
          <label className="pr-switch">
            <span>切换旅行</span>
            <select value={trip.id} onChange={e => selectTrip(Number(e.target.value))} className="pr-input">
              {trips.map(t => <option key={t.id} value={t.id}>{t.title} · {t.planType === 'PRO' ? 'PRO' : 'FREE'}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="pr-trip-state">
        {pro ? (
          <>
            <p className="pr-badge is-pro"><CheckCircle2 size={16} aria-hidden="true" /> 已解锁 Trip Pro</p>
            <p className="pr-trip-note">{lifetime ? <><Crown size={13} aria-hidden="true" /> 买断终身 Pro：账号下所有旅行都已解锁</> : '这段旅行永久有效：打卡与照片不限数量，成果可高清无水印导出。'}</p>
            <PayNotice state={pay} message={payMessage} trip={trip} mock={mockPaid} onRetry={() => void s.recheckTrip()} />
            <div className="pr-trip-actions">
              <Link href={`/trips/${trip.id}/share`} className="pr-btn is-primary"><Share2 size={15} aria-hidden="true" /> 查看分享成果</Link>
              <Link href={`/trips/${trip.id}/video`} className="pr-btn"><Film size={15} aria-hidden="true" /> 制作 Travel Story</Link>
            </div>
          </>
        ) : (
          <>
            <p className="pr-badge"><span>当前状态</span> FREE</p>
            <div className="pr-usage">
              <Usage label="打卡" value={usage.checkins} limit={usage.checkinLimit} ready={Boolean(summary)} />
              <Usage label="照片" value={usage.photos} limit={usage.photoLimit} ready={Boolean(summary)} />
            </div>
            {(usage.checkinFull || usage.photoFull) && (
              <p className="pr-limit" role="status"><CircleAlert size={15} aria-hidden="true" /> {usage.checkinFull && usage.photoFull ? '打卡和照片' : usage.checkinFull ? '打卡' : '照片'}已达到免费上限，已记录的内容不会丢失；升级后可以继续记录。</p>
            )}
            <PayNotice state={pay} message={payMessage} trip={trip} mock={mockPaid} onRetry={() => void s.recheckTrip()} />
            <UpgradeButton trip={trip} plan={plan} state={pay} onClick={() => void checkout()} />
            <PayNotes plan={plan} />
          </>
        )}
      </div>
    </section>
  )
}

function Usage({ label, value, limit, ready }: { label: string; value: number; limit: number; ready: boolean }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, limit)) * 100))
  return (
    <div className={`pr-usage-item${value >= limit ? ' is-full' : ''}`}>
      <p><span>{label}</span><b>{ready ? `${value} / ${limit}` : `— / ${limit}`}</b></p>
      <div className="pr-bar" role="progressbar" aria-label={`${label}用量`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(value, limit)}><span style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
