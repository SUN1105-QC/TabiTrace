'use client'

import { PageContainer } from '@/components/common/PageContainer'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { LandingHero } from '@/components/landing/LandingHero'
import { Capabilities, FinalCta, JourneyFlow, MemoriesBanner, Outcomes, ProductPreviews } from '@/components/landing/LandingSections'
import { PlanSection, TokyoSection, TravelStorySection, useLandingPlan } from '@/components/landing/LandingLive'
import { SiteHeader } from '@/components/common/SiteHeader'
import { SiteFooter } from '@/components/common/SiteFooter'
import { HomeWorkspace } from '@/components/home/HomeWorkspace'
import { HomeSkeleton } from '@/components/home/HomeSkeleton'
import { useHomeData } from '@/hooks/useHomeData'
import { hasSession } from '@/services/api'

export function HomeClient() {
  const [mounted, setMounted] = useState(false)
  const [session, setSession] = useState(false)
  useEffect(() => { setMounted(true); setSession(hasSession()) }, [])

  if (!mounted) return <main><SiteHeader /><PageContainer variant="wide" className="home-page px-5 py-10 sm:px-8"><HomeSkeleton /></PageContainer></main>
  return session ? <Dashboard /> : <Landing />
}

function Dashboard() {
  const { data, loading, error, reload } = useHomeData(true)

  return (
    <main>
      <SiteHeader />
      <PageContainer variant="wide" className="home-page px-5 pb-16 sm:px-8">
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
          <HomeWorkspace data={data} onSwitch={reload} />
        )}
      </PageContainer>
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
      <FinalCta openAccess={Boolean(plan?.openAccess)} />
      <SiteFooter />
    </main>
  )
}
