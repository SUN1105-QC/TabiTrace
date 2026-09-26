'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { LandingHero } from '@/components/landing/LandingHero'
import { Capabilities, FinalCta, JourneyFlow, MemoriesBanner, Outcomes, ProductPreviews } from '@/components/landing/LandingSections'
import { PlanSection, TokyoSection, TravelStorySection, useLandingPlan } from '@/components/landing/LandingLive'
import { SiteHeader } from '@/components/common/SiteHeader'
import { SiteFooter } from '@/components/common/SiteFooter'
import { HeroJourneyCard } from '@/components/home/HeroJourneyCard'
import { TravelCalendar } from '@/components/home/TravelCalendar'
import { TravelStats } from '@/components/home/TravelStats'
import { CurrentTripCard } from '@/components/home/CurrentTripCard'
import { RecentActivities } from '@/components/home/RecentActivities'
import { TodayActions } from '@/components/home/TodayActions'
import { ExploreBanner, TravelMemoryBanner } from '@/components/home/HomeBanners'
import { MobileHero } from '@/components/mobile/MobileHero'
import { ExploreRecommendations } from '@/components/mobile/ExploreRecommendations'
import { HomeSkeleton } from '@/components/home/HomeSkeleton'
import { useHomeData } from '@/hooks/useHomeData'
import { hasSession } from '@/services/api'

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [session, setSession] = useState(false)
  useEffect(() => { setMounted(true); setSession(hasSession()) }, [])

  if (!mounted) return <main><SiteHeader /><section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8"><HomeSkeleton /></section></main>
  return session ? <Dashboard /> : <Landing />
}

function Dashboard() {
  const { data, loading, error, reload } = useHomeData(true)

  return (
    <main>
      <SiteHeader />
      <section className="mx-auto w-full max-w-[1460px] px-5 pb-16 sm:px-8">
        {error ? (
          <div className="warm-card mt-4 p-8 text-center">
            <p className="font-serif text-2xl">首页数据加载失败</p>
            <p className="mt-2 text-sm text-black/50">{error}</p>
            <div className="mt-5 flex justify-center gap-3">
              <button className="warm-button" onClick={reload}><RefreshCcw size={15} /> 重新加载</button>
              <Link href="/login" className="hero-ghost-button">重新登录</Link>
            </div>
          </div>
        ) : loading ? (
          <HomeSkeleton />
        ) : (
          <div className="home-grid">
            <div className="home-main">
              {/* Hero：桌面端与移动端两套排版，共用同一份数据 */}
              <div className="only-desktop"><HeroJourneyCard user={data.user} trip={data.activeTrip} /></div>
              <div className="only-mobile"><MobileHero user={data.user} trip={data.activeTrip} /></div>

              <TravelStats stats={{ ...data.stats, activeTripId: data.activeTrip?.id ?? null }} />

              <div className="home-columns">
                <CurrentTripCard
                  trip={data.activeTrip}
                  summary={data.activeSummary}
                  itinerary={data.itinerary}
                  note={[...data.checkins].reverse().find(c => c.note?.trim())?.note}
                />
                <div className="only-desktop">
                  <RecentActivities activities={data.activities} tripId={data.activeTrip?.id ?? null} />
                </div>
              </div>

              {/* 推荐探索：移动端首页的最后一个模块 */}
              <div className="only-mobile">
                <ExploreRecommendations places={data.recommended} />
              </div>
            </div>
            <aside className="home-side only-desktop">
              <TravelCalendar trip={data.activeTrip} itinerary={data.itinerary} checkins={data.checkins} />
              <TodayActions trip={data.activeTrip} summary={data.activeSummary} />
              <TravelMemoryBanner trips={data.trips} />
              <ExploreBanner />
            </aside>
          </div>
        )}
      </section>
    </main>
  )
}

/** 未登录用户看到的公共首页；已登录用户看到上面的 Dashboard（互不混用） */
function Landing() {
  const plan = useLandingPlan()
  return (
    <main className="ld-page">
      <SiteHeader />
      <LandingHero />
      <Capabilities />
      <ProductPreviews />
      <JourneyFlow />
      <TokyoSection />
      <Outcomes />
      <TravelStorySection plan={plan} />
      <PlanSection plan={plan} />
      <MemoriesBanner />
      <FinalCta />
      <SiteFooter />
    </main>
  )
}
