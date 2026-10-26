'use client'

/**
 * Hero：一句话说明 Trip Pro 是什么、买的是什么（一次性、只对这段旅行、不续费）。
 * 按钮跟随真实状态：未登录 → 登录；没有旅行 → 创建；免费旅行 → 跳到下方状态卡（那里写明为哪段旅行、多少钱）；
 * 已升级 → 直接去做成果，不再引导购买。
 */

import Link from 'next/link'
import { ArrowRight, CheckCircle2, Film, Share2 } from 'lucide-react'
import { hdImage, hdSrcSet } from '@/utils/place-images'
import { isOneTimePerTrip } from '@/utils/plan'
import { PRODUCT_SHOTS } from '@/components/landing/landingDemo'
import type { TripProState } from './useTripPro'

const HERO = hdImage('08-imperial-palace')

export function TripProHero({ s }: { s: TripProState }) {
  const { plan, loggedIn, trip, loadingTrip } = s
  const pro = trip?.planType === 'PRO'

  const primary = !loggedIn
    ? <Link href="/login?next=%2Fpricing" className="pr-btn is-primary is-lg">登录后升级 <ArrowRight size={16} aria-hidden="true" /></Link>
    : !loadingTrip && !trip
      ? <Link href="/trips/new" className="pr-btn is-primary is-lg">先创建一段旅行 <ArrowRight size={16} aria-hidden="true" /></Link>
      : pro && trip
        ? <Link href={`/trips/${trip.id}/share`} className="pr-btn is-primary is-lg"><Share2 size={16} aria-hidden="true" /> 查看分享成果</Link>
        : <a href="#pr-status" className="pr-btn is-primary is-lg">升级这趟旅行 <ArrowRight size={16} aria-hidden="true" /></a>
  const secondary = pro && trip
    ? <Link href={`/trips/${trip.id}/video`} className="pr-btn is-lg"><Film size={16} aria-hidden="true" /> 制作 Travel Story</Link>
    : <a href="#pr-compare" className="pr-btn is-lg">查看功能对比</a>

  return (
    <header className="pr-hero">
      <div className="pr-hero-copy">
        <p className="pr-eyebrow">TRIP PRO</p>
        <h1>让值得留下的旅程，<br />拥有完整的表达。</h1>
        <p className="pr-hero-sub">解锁更完整的旅行记录、高清旅行成果和 Travel Story，把这一趟旅程真正保存下来。</p>
        {plan && isOneTimePerTrip(plan) && (
          <ul className="pr-trust" aria-label="购买说明">
            <li><CheckCircle2 size={14} aria-hidden="true" />一次购买</li>
            <li><CheckCircle2 size={14} aria-hidden="true" />当前旅行永久生效</li>
            <li><CheckCircle2 size={14} aria-hidden="true" />不自动续费</li>
          </ul>
        )}
        <div className="pr-hero-actions">{primary}{secondary}</div>
      </div>
      <figure className="pr-hero-visual">
        <img className="pr-hero-photo" src={HERO} srcSet={hdSrcSet(HERO)} sizes="(max-width: 1023px) 92vw, (max-width: 1799px) 48vw, 820px" alt="东京皇居二重桥与伏见橹" fetchPriority="high" />
        <figcaption className="pr-hero-caption">
          <small>TOKYO · 皇居二重桥</small>
          <span>每一段值得留下的旅程</span>
        </figcaption>
        {/* 真实生成的城市海报，暗示升级后得到的成果 */}
        <img className="pr-hero-print" src={PRODUCT_SHOTS.poster.src} srcSet={PRODUCT_SHOTS.poster.srcSet} sizes="(max-width: 767px) 30vw, 190px" alt="" width={PRODUCT_SHOTS.poster.width} height={PRODUCT_SHOTS.poster.height} decoding="async" />
      </figure>
    </header>
  )
}
