'use client'

/**
 * Pricing 区：FREE / TRIP PRO / 买断 · 终身 PRO 三张卡 + 为什么按旅行购买。
 * 内容与结构保持与既有付费规则一致（价格、限制都来自方案配置）；卡片底部按当前旅行与账号的真实状态显示按钮。
 * id="pr-price-title" 供设置页直接跳转。
 */

import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { LifetimeButton, PayNotes, PayNotice, UpgradeButton } from '../TripProButtons'
import type { TripProState } from '../useTripPro'
import { PricingCardFree } from './PricingCardFree'
import { PricingCardLifetimePro } from './PricingCardLifetimePro'
import { PricingCardTripPro } from './PricingCardTripPro'
import { WhyBuyPerTrip } from './WhyBuyPerTrip'

export function TripProPricingSection({ s }: { s: TripProState }) {
  const { plan, loggedIn, trip, loadingTrip, pay, checkout, lifetime, lifePay, lifeMessage, lifeMock, checkoutLifetime } = s
  if (!plan) return null

  const tripCta = !loggedIn
    ? <Link href="/login?next=%2Fpricing" className="pr-cta">登录后升级 <ArrowRight size={16} aria-hidden="true" /></Link>
    : loadingTrip
      ? <div className="skeleton pr-cta-skeleton" aria-hidden="true" />
      : !trip
        ? <Link href="/trips/new" className="pr-cta">先创建一段旅行 <ArrowRight size={16} aria-hidden="true" /></Link>
        : trip.planType === 'PRO'
          ? <p className="pr-unlocked"><CheckCircle2 size={16} aria-hidden="true" /> 「{trip.title}」已解锁 Trip Pro</p>
          : <><UpgradeButton trip={trip} plan={plan} state={pay} onClick={() => void checkout()} named /><PayNotes plan={plan} /></>

  const lifetimeCta = !plan.lifetime ? null : !loggedIn
    ? <Link href="/login?next=%2Fpricing" className="pr-cta is-lifetime">登录后买断 <ArrowRight size={16} aria-hidden="true" /></Link>
    : (
      <>
        <LifetimeButton plan={plan} owned={lifetime} state={lifePay} onClick={() => void checkoutLifetime()} />
        <PayNotice state={lifePay} message={lifeMessage} trip={null} mock={lifeMock} lifetime />
        {!lifetime && <PayNotes plan={plan} lifetime />}
      </>
    )

  return (
    <section className="pr-section pr-pricing-section" aria-labelledby="pr-price-title">
      <header className="pr-section-head">
        <p className="pr-eyebrow">PRICING</p>
        <h2 id="pr-price-title">基础记录永久免费，需要时再升级</h2>
      </header>
      <div className={`pr-pricing${plan.lifetime ? ' has-lifetime' : ''}`}>
        <PricingCardFree plan={plan} />
        <PricingCardTripPro plan={plan} cta={tripCta} />
        <PricingCardLifetimePro plan={plan} cta={lifetimeCta} />
      </div>
      <WhyBuyPerTrip plan={plan} />
    </section>
  )
}
