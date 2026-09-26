'use client'

/**
 * 当前旅行的方案状态：FREE 显示真实用量与升级按钮；PRO 切换为已解锁状态并给出成果入口（不再出现购买按钮）；
 * 没登录 / 没有旅行时给出对应入口。购买按钮始终写明是为哪一段旅行解锁。
 */

import Link from 'next/link'
import { ArrowRight, BarChart3, Camera, CheckCircle2, CircleAlert, CreditCard, Film, Info, Loader2, Share2 } from 'lucide-react'
import type { TripSummary, TripView } from '@/services/tabitrace-api'
import { planPrice, tripUsage, type TripProPlan } from '@/utils/plan'

export type PayState = 'idle' | 'loading' | 'confirming' | 'success' | 'cancelled' | 'failed' | 'already'

export function UpgradeButton({ trip, plan, state, onClick, compact }: { trip: TripView; plan: TripProPlan; state: PayState; onClick: () => void; compact?: boolean }) {
  const busy = state === 'loading' || state === 'confirming'
  return (
    <button type="button" className="pr-cta" onClick={onClick} disabled={busy} aria-busy={busy}>
      {busy
        ? <><Loader2 size={17} className="pr-spin" /> {state === 'confirming' ? '正在确认支付…' : '正在创建订单…'}</>
        : <><CreditCard size={17} /> {compact ? `解锁 Trip Pro · ${planPrice(plan)}` : `为「${trip.title}」解锁 Trip Pro · ${planPrice(plan)}`}</>}
    </button>
  )
}

export function PayNotice({ state, message, trip, mock }: { state: PayState; message: string; trip: TripView | null; mock: boolean }) {
  if (state === 'idle' || state === 'loading') return null
  const map: Record<Exclude<PayState, 'idle' | 'loading'>, { icon: typeof Info; tone: string; text: string }> = {
    confirming: { icon: Loader2, tone: 'is-info', text: '支付已提交，正在确认结果…' },
    success: { icon: CheckCircle2, tone: 'is-ok', text: `支付成功，「${trip?.title ?? '这段旅行'}」已解锁 Trip Pro。${mock ? '（本地开发环境为模拟支付，没有产生真实扣款）' : ''}` },
    already: { icon: CheckCircle2, tone: 'is-ok', text: `「${trip?.title ?? '这段旅行'}」已经是 Trip Pro，无需重复购买。` },
    cancelled: { icon: Info, tone: 'is-info', text: '你已取消支付，没有产生扣款。可以随时再次升级。' },
    failed: { icon: CircleAlert, tone: 'is-bad', text: `支付未完成：${message || '请稍后再试'}` }
  }
  const m = map[state]
  const Icon = m.icon
  return <p className={`pr-notice ${m.tone}`} role={state === 'failed' ? 'alert' : 'status'}><Icon size={16} className={state === 'confirming' ? 'pr-spin' : ''} aria-hidden="true" /> {message && state === 'confirming' ? message : m.text}</p>
}

export function TripProStatus({ plan, loggedIn, trips, trip, summary, loadingTrip, onSelectTrip, cta, notice }: {
  plan: TripProPlan
  loggedIn: boolean
  trips: TripView[]
  trip: TripView | null
  summary: TripSummary | null
  loadingTrip: boolean
  onSelectTrip: (id: number) => void
  cta: React.ReactNode
  notice: React.ReactNode
}) {
  if (!loggedIn) {
    return (
      <section className="pr-status is-empty" aria-label="当前旅行">
        <p>登录后，可以为你的某一段旅行解锁 Trip Pro。</p>
        <Link href="/login?next=%2Fpricing" className="pr-btn is-primary">登录旅迹 <ArrowRight size={15} /></Link>
      </section>
    )
  }
  if (loadingTrip) return <section className="pr-status" aria-busy="true" aria-label="正在读取旅行"><div className="skeleton" style={{ height: 150, borderRadius: 16 }} /></section>
  if (!trip) {
    return (
      <section className="pr-status is-empty" aria-label="当前旅行">
        <p>还没有旅行。新旅行可以免费开始，需要时再为它升级。</p>
        <Link href="/trips/new" className="pr-btn is-primary">创建旅行 <ArrowRight size={15} /></Link>
      </section>
    )
  }

  const pro = trip.planType === 'PRO'
  const usage = tripUsage(summary, plan)
  const switcher = trips.length > 1 && (
    <label className="pr-switch">
      <span>{pro ? '查看旅行' : '要升级的旅行'}</span>
      <select value={trip.id} onChange={e => onSelectTrip(Number(e.target.value))} className="pr-input">
        {trips.map(t => <option key={t.id} value={t.id}>{t.title} · {t.planType === 'PRO' ? 'PRO' : 'FREE'}</option>)}
      </select>
    </label>
  )

  return (
    <section className={`pr-status${pro ? ' is-pro' : ''}`} aria-labelledby="pr-status-title">
      <div className="pr-status-head">
        <div>
          <p className="pr-eyebrow">{pro ? 'TRIP PRO 已解锁' : '当前方案 FREE'}</p>
          <h2 id="pr-status-title">{trip.title}</h2>
          <p className="pr-status-meta">{trip.destinationName} · {trip.startDate.replace(/-/g, '.')} — {trip.endDate.replace(/-/g, '.')}</p>
        </div>
        {switcher}
      </div>
      {notice}

      {pro ? (
        <>
          <p className="pr-status-lead"><CheckCircle2 size={17} aria-hidden="true" /> 当前旅行已解锁 Trip Pro：打卡与照片不限数量，Travel Story 可用全部模板与 {plan.storyPro.quality.toUpperCase()}{plan.storyPro.watermark ? '' : ' 无水印'}导出。</p>
          <div className="pr-entries">
            <Link href={`/trips/${trip.id}/share`} className="pr-entry is-main"><Share2 size={18} /><b>制作旅行成果</b><small>海报 · 九宫格 · 每日长图</small></Link>
            <Link href={`/trips/${trip.id}/video`} className="pr-entry"><Film size={18} /><b>打开 Travel Story</b><small>{plan.storyPro.quality.toUpperCase()} 高清导出</small></Link>
            <Link href={`/trips/${trip.id}/summary`} className="pr-entry"><BarChart3 size={18} /><b>旅行统计</b><small>旅行总结与成就</small></Link>
            <Link href={`/trips/${trip.id}/gallery`} className="pr-entry"><Camera size={18} /><b>照片</b><small>不限张数</small></Link>
          </div>
        </>
      ) : (
        <>
          <div className="pr-usage">
            <Usage label="打卡" value={usage.checkins} limit={usage.checkinLimit} />
            <Usage label="照片" value={usage.photos} limit={usage.photoLimit} />
          </div>
          {(usage.checkinFull || usage.photoFull) && (
            <p className="pr-limit" role="status"><CircleAlert size={15} aria-hidden="true" /> {usage.checkinFull && usage.photoFull ? '打卡和照片' : usage.checkinFull ? '打卡' : '照片'}已达到免费上限，已记录的内容不会丢失；升级后可以继续记录。</p>
          )}
          <p className="pr-status-lead">升级后：打卡与照片不限数量，Travel Story 解锁全部模板、{plan.storyPro.quality.toUpperCase()}{plan.storyPro.watermark ? '' : ' 无水印'}与最长 {Math.max(...plan.storyPro.durations)} 秒。</p>
          {cta}
        </>
      )}
    </section>
  )
}

function Usage({ label, value, limit }: { label: string; value: number; limit: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, limit)) * 100))
  return (
    <div className={`pr-usage-item${value >= limit ? ' is-full' : ''}`}>
      <p><span>{label}</span><b>{value} / {limit}</b></p>
      <div className="pr-bar" role="progressbar" aria-label={`${label}用量`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(value, limit)}><span style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
