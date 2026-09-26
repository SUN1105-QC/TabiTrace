'use client'

/**
 * Trip Pro 升级中心。
 * 真实商业规则（来自后端 /plans/trip-pro 与 PaymentService）：按单段旅行一次性购买，升级后该旅行永久为 Pro，
 * 不是订阅、不会自动续费。价格、Free 限制与 Travel Story 差异全部读取方案配置。
 * 购买复用现有 checkout：模拟支付环境立即完成；Stripe 环境跳转付款页，返回后轮询确认结果，不会假装成功。
 */

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Info, RefreshCcw, TriangleAlert } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { PayNotice, TripProStatus, UpgradeButton, type PayState } from '@/components/pro/TripProStatus'
import { ProComparison, ProFaq, ProPreviews, ProPricing, ProValues, WhyPerTrip } from '@/components/pro/ProSections'
import { ApiError, hasSession } from '@/services/api'
import { planApi, tripApi, type TripSummary, type TripView } from '@/services/tabitrace-api'
import { isOneTimePerTrip, planPrice, type TripProPlan } from '@/utils/plan'

export default function PricingPage() {
  const [plan, setPlan] = useState<TripProPlan | null>(null)
  const [planError, setPlanError] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [trips, setTrips] = useState<TripView[]>([])
  const [trip, setTrip] = useState<TripView | null>(null)
  const [summary, setSummary] = useState<TripSummary | null>(null)
  const [loadingTrip, setLoadingTrip] = useState(true)
  const [pay, setPay] = useState<PayState>('idle')
  const [payMessage, setPayMessage] = useState('')
  const [mockPaid, setMockPaid] = useState(false)
  const [showSticky, setShowSticky] = useState(false)
  const paying = useRef(false)
  const statusBox = useRef<HTMLDivElement | null>(null)

  const loadPlan = useCallback(() => {
    setPlanError('')
    planApi.tripPro().then(setPlan).catch(e => setPlanError(e instanceof Error && e.message ? e.message : '请稍后再试'))
  }, [])

  const loadSummary = useCallback((t: TripView) => {
    setSummary(null)
    if (t.planType !== 'PRO') tripApi.summary(t.id).then(setSummary).catch(() => setSummary(null))
  }, [])

  // 付款返回后确认结果：以旅行的真实方案为准，最多等 30 秒，确认不了就如实告诉用户
  const confirmPaid = useCallback(async (tripId: number) => {
    setPay('confirming')
    for (let i = 0; i < 15; i++) {
      try {
        const t = await tripApi.get(tripId)
        if (t.planType === 'PRO') { setTrip(t); setTrips(ts => ts.map(x => (x.id === t.id ? t : x))); setPay('success'); return }
      } catch { /* 继续等待 */ }
      await new Promise(r => setTimeout(r, 2000))
    }
    setPayMessage('支付结果还在确认中，稍后刷新本页即可看到最新状态；如已扣款，旅行会自动解锁。')
  }, [])

  useEffect(() => {
    loadPlan()
    const q = new URLSearchParams(window.location.search)
    const wanted = Number(q.get('trip') || 0)
    const payment = q.get('payment')
    const session = hasSession()
    setLoggedIn(session)
    if (!session) { setLoadingTrip(false); return }
    ;(async () => {
      try {
        const rows = await tripApi.list()
        setTrips(rows)
        const stored = Number(localStorage.getItem('tabitrace-live-trip-id') || 0)
        const picked = rows.find(t => t.id === wanted) || rows.find(t => t.id === stored) || rows.find(t => t.status !== 'ARCHIVED') || rows[0] || null
        setTrip(picked)
        if (picked) {
          loadSummary(picked)
          if (payment === 'cancelled') setPay('cancelled')
          if (payment === 'success') void confirmPaid(picked.id)
        }
      } catch {
        setTrip(null)
      } finally {
        setLoadingTrip(false)
        if (payment) { q.delete('payment'); window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}`) }
      }
    })()
  }, [loadPlan, loadSummary, confirmPaid])

  // 状态卡片离开视口后才显示底部条，避免同一个购买按钮在屏幕上出现两次
  useEffect(() => {
    const el = statusBox.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [plan, loadingTrip])

  const selectTrip = (id: number) => {
    const t = trips.find(x => x.id === id)
    if (!t) return
    setTrip(t); setPay('idle'); setPayMessage(''); loadSummary(t)
    const q = new URLSearchParams(window.location.search); q.set('trip', String(id))
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`)
  }

  const checkout = async () => {
    if (paying.current || !trip || trip.planType === 'PRO') return
    paying.current = true
    setPay('loading'); setPayMessage('')
    let redirecting = false
    try {
      const r = await tripApi.checkout(trip.id)
      if (r?.mock) {
        const t = await tripApi.get(trip.id)
        setTrip(t); setTrips(ts => ts.map(x => (x.id === t.id ? t : x)))
        setMockPaid(true)
        setPay(t.planType === 'PRO' ? 'success' : 'failed')
        if (t.planType !== 'PRO') setPayMessage('支付记录已创建，但旅行还没有解锁，请稍后刷新')
      } else if (r?.checkoutUrl) {
        redirecting = true
        window.location.assign(r.checkoutUrl)
      } else {
        setPay('failed'); setPayMessage('没有拿到支付页面，请稍后再试')
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'TRIP_ALREADY_PRO') {
        const t = await tripApi.get(trip.id).catch(() => null)
        if (t) { setTrip(t); setTrips(ts => ts.map(x => (x.id === t.id ? t : x))) }
        setPay('already')
      } else {
        setPay('failed'); setPayMessage(e instanceof Error && e.message ? e.message : '请稍后再试')
      }
    } finally {
      if (!redirecting) paying.current = false
    }
  }

  const pro = trip?.planType === 'PRO'
  const upgradeCta = plan && trip && !pro ? (
    <div className="pr-cta-wrap">
      <UpgradeButton trip={trip} plan={plan} state={pay} onClick={() => void checkout()} />
      {!plan.realPayments && <p className="pr-mock"><Info size={13} aria-hidden="true" /> 当前是本地开发环境：会模拟支付成功，不会产生真实扣款。</p>}
    </div>
  ) : null
  const notice = <PayNotice state={pay} message={payMessage} trip={trip} mock={mockPaid} />
  const pricingCta = !plan ? null : !loggedIn
    ? <Link href="/login?next=%2Fpricing" className="pr-cta">登录后升级 <ArrowRight size={16} /></Link>
    : !trip ? <Link href="/trips/new" className="pr-cta">先创建一段旅行 <ArrowRight size={16} /></Link>
    : pro ? <p className="pr-unlocked"><CheckCircle2 size={16} /> 「{trip.title}」已解锁 Trip Pro</p>
    : upgradeCta

  return (
    <main>
      <SiteHeader />
      <section className={`pr-page${showSticky && trip ? ' has-sticky' : ''}`}>
        <header className="pr-hero">
          <p className="pr-eyebrow">TRIP PRO</p>
          <h1>让值得留下的旅程，<br />拥有完整的表达。</h1>
          <p className="pr-hero-sub">基础记录永久免费。当你需要更多记录空间、高清成果或完整 Travel Story 时，再为这趟旅行升级。</p>
          {plan && isOneTimePerTrip(plan) && (
            <ul className="pr-trust" aria-label="购买说明">
              <li><CheckCircle2 size={14} aria-hidden="true" />一次购买</li>
              <li><CheckCircle2 size={14} aria-hidden="true" />当前旅行永久生效</li>
              <li><CheckCircle2 size={14} aria-hidden="true" />不会自动续费</li>
            </ul>
          )}
        </header>

        {planError ? (
          <div className="pr-fail" role="alert">
            <TriangleAlert size={22} />
            <p>Trip Pro 信息加载失败</p>
            <small>{planError}</small>
            <button type="button" className="pr-btn is-primary" onClick={loadPlan}><RefreshCcw size={14} /> 重新加载</button>
          </div>
        ) : !plan ? (
          <div className="pr-status" aria-busy="true" aria-label="正在读取 Trip Pro 方案"><div className="skeleton" style={{ height: 180, borderRadius: 16 }} /></div>
        ) : (
          <>
            <div ref={statusBox}>
              <TripProStatus plan={plan} loggedIn={loggedIn} trips={trips} trip={trip} summary={summary} loadingTrip={loadingTrip} onSelectTrip={selectTrip} cta={upgradeCta} notice={notice} />
            </div>
            <ProValues plan={plan} />
            <ProPreviews plan={plan} trip={trip} />
            <ProPricing plan={plan} cta={pricingCta} />
            <WhyPerTrip plan={plan} />
            <ProComparison plan={plan} />
            <ProFaq plan={plan} />
          </>
        )}

        {plan && trip && showSticky && (
          <div className="pr-sticky" role="region" aria-label={pro ? 'Trip Pro 已解锁' : '升级 Trip Pro'}>
            {pro ? (
              <>
                <p><CheckCircle2 size={16} aria-hidden="true" /><span><b>Trip Pro 已解锁</b><small>{trip.title}</small></span></p>
                <Link href={`/trips/${trip.id}/share`} className="pr-btn is-primary">制作旅行成果 <ArrowRight size={15} /></Link>
              </>
            ) : (
              <>
                <p><span><b>{trip.title}</b><small>Trip Pro · {planPrice(plan)}{isOneTimePerTrip(plan) ? ' · 一次性' : ''}</small></span></p>
                <UpgradeButton trip={trip} plan={plan} state={pay} onClick={() => void checkout()} compact />
              </>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
