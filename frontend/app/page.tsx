'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Camera, Film, Globe2, MapPinned, RefreshCcw, Route, Sparkles } from 'lucide-react'
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

function Landing() {
  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 lg:py-14">
        <div className="relative min-h-[620px] overflow-hidden rounded-[36px] border border-black/[0.06] bg-[#E4C2A0] shadow-soft">
          <img src="/images/hero-scenery.jpg" alt="东京旅行风景" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#fffaf2]/95 via-[#fffaf2]/72 to-black/10" />
          <div className="relative z-10 flex min-h-[620px] max-w-[700px] flex-col justify-center px-8 py-16 sm:px-14 lg:px-20">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-warm/20 bg-white/70 px-4 py-2 text-xs font-semibold text-warm"><Globe2 size={14} /> 全球自由记录 · 东京官方探索首发</span>
            <h1 className="mt-7 font-serif text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">记录每一段旅程，<span className="text-warm">让回忆更有温度。</span></h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-black/60 sm:text-lg">用地图、时间轴、照片和故事，把旅行从“去过”变成可以长期收藏、回看和分享的个人作品。</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login?next=%2F" className="warm-button px-6 py-4 text-sm">登录并进入首页 <ArrowRight size={17} /></Link>
              <Link href="/register" className="rounded-[13px] border border-black/10 bg-white/70 px-6 py-4 text-sm font-semibold">创建账号</Link>
              <Link href="/explore/tokyo" className="rounded-[13px] border border-black/10 bg-white/70 px-6 py-4 text-sm font-semibold">看看东京探索</Link>
            </div>
            <p className="mt-8 font-serif text-lg italic text-warm-dark">Every Journey · A Better You</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-16 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [MapPinned, '旅行地图', '把地点和路线留在一张会成长的地图上。'],
            [Route, '行程与打卡', '计划、临时发现和真实到访都能被记录。'],
            [Camera, '照片与时间轴', '照片回到发生的时间和地点，旅程更有故事。'],
            [Sparkles, '分享成果', '城市海报、九宫格和每日长图自动生成。'],
            [Film, 'Travel Story', '把地图、照片和文字自动组合成旅行视频。']
          ].map(([Icon, title, desc]: any) => (
            <article key={title} className="warm-card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orangeSoft text-warm"><Icon size={20} /></span>
              <h2 className="mt-6 text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-black/50">{desc}</p>
            </article>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
