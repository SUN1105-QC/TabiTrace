'use client'

/**
 * Trip Pro：旅行升级页。
 * 真实商业规则（来自后端 /plans/trip-pro 与 PaymentService）：按单段旅行一次性购买，升级后该旅行永久为 Pro，
 * 不是订阅、不会自动续费；另有账号级「买断 · 终身 Pro」。价格、Free 限制与成果规格全部读取方案配置。
 * 数据与购买流程在 useTripPro，页面只负责区块顺序：
 * Hero → 当前旅行 → 核心权益 → 成果展示 → Pricing（含为什么按旅行购买）→ Free 与 Trip Pro 对比 → FAQ
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, RefreshCcw, TriangleAlert } from 'lucide-react'
import { PageContainer } from '@/components/common/PageContainer'
import { SiteHeader } from '@/components/common/SiteHeader'
import { TripProHero } from '@/components/pro/TripProHero'
import { TripStatusCard } from '@/components/pro/TripStatusCard'
import { TripProBenefits } from '@/components/pro/TripProBenefits'
import { TripProOutcomeShowcase } from '@/components/pro/TripProOutcomeShowcase'
import { TripProPricingSection } from '@/components/pro/pricing/TripProPricingSection'
import { TripProComparisonTable } from '@/components/pro/TripProComparisonTable'
import { TripProFaq } from '@/components/pro/TripProFaq'
import { UpgradeButton } from '@/components/pro/TripProButtons'
import { useTripPro } from '@/components/pro/useTripPro'
import { PaymentHistory } from '@/components/pro/PaymentHistory'
import { AccountUsage } from '@/components/pro/AccountUsage'
import { isOneTimePerTrip, planPrice } from '@/utils/plan'

export default function PricingPage() {
  const s = useTripPro()
  const { plan, planError, loadPlan, trip, pay, checkout } = s
  const pro = trip?.planType === 'PRO'

  // 底部购买条：状态卡和价格卡都不在屏幕上时才显示，避免同一个购买按钮在屏幕上出现两次
  const [showSticky, setShowSticky] = useState(false)
  const visible = useRef(new Map<Element, boolean>())
  useEffect(() => {
    if (!plan) return
    const targets = [document.getElementById('pr-status'), document.querySelector('.pr-pricing')].filter((el): el is Element => Boolean(el))
    if (!targets.length) return
    // 被吸顶导航盖住的部分不算“在屏幕上”
    const topbar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar')) || 0
    const io = new IntersectionObserver(entries => {
      for (const e of entries) visible.current.set(e.target, e.isIntersecting)
      setShowSticky(targets.every(t => visible.current.get(t) === false))
    }, { threshold: 0, rootMargin: `-${Math.round(topbar)}px 0px 0px 0px` })
    targets.forEach(t => io.observe(t))
    return () => io.disconnect()
  }, [plan, s.loadingTrip, trip?.id])

  const sticky = plan && trip && showSticky

  return (
    <main>
      <SiteHeader />
      <PageContainer variant="medium" className={`pr-page${sticky ? ' has-sticky' : ''}`}>
        <TripProHero s={s} />

        {planError ? (
          <div className="pr-fail" role="alert">
            <TriangleAlert size={22} aria-hidden="true" />
            <p>Trip Pro 信息加载失败</p>
            <small>{planError}</small>
            <button type="button" className="pr-btn is-primary" onClick={loadPlan}><RefreshCcw size={14} aria-hidden="true" /> 重新加载</button>
          </div>
        ) : !plan ? (
          <div className="pr-trip is-loading" aria-busy="true" aria-label="正在读取 Trip Pro 方案"><div className="skeleton" /></div>
        ) : (
          <>
            <TripStatusCard s={s} />
            <TripProBenefits plan={plan} member={s.member} />
            <TripProOutcomeShowcase plan={plan} trip={trip} loggedIn={s.loggedIn} />
            <TripProPricingSection s={s} />
            <TripProComparisonTable plan={plan} trip={trip} />
            <TripProFaq plan={plan} />
            {s.loggedIn && <PaymentHistory refreshKey={`${s.pay}:${s.lifePay}`} onUpdated={s.reloadEntitlements} />}
            {s.loggedIn && <AccountUsage />}
          </>
        )}

        {sticky && (
          <div className="pr-sticky" role="region" aria-label={pro ? 'Trip Pro 已解锁' : '升级 Trip Pro'}>
            {pro ? (
              <>
                <p><CheckCircle2 size={16} aria-hidden="true" /><span><b>Trip Pro 已解锁</b><small>{trip.title}</small></span></p>
                <Link href={`/trips/${trip.id}/share`} className="pr-btn is-primary">查看分享成果 <ArrowRight size={15} aria-hidden="true" /></Link>
              </>
            ) : (
              <>
                <p><span><b>{trip.title}</b><small>Trip Pro · {planPrice(plan)}{isOneTimePerTrip(plan) ? ' · 一次性' : ''}</small></span></p>
                <UpgradeButton trip={trip} plan={plan} state={pay} onClick={() => void checkout()} compact />
              </>
            )}
          </div>
        )}
      </PageContainer>
    </main>
  )
}
