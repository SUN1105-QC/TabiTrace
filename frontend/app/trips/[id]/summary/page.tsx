'use client'

/**
 * 旅行总结。数据来自 useTripSummaryData（手机与桌面共用，只请求一次）。
 * - 手机（<768px）：紧凑概览（2×3）→ 这趟旅行 → 按天回看（一次一天）→ 旅程亮点 → 本次成就 → 旅行成果
 * - 平板 / 桌面：保持原有布局（统计格 + 每天记录 + 旅行成果），旅行成果与手机共用同一组件
 */

import { PageContainer } from '@/components/common/PageContainer'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { RefreshCcw } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { LiveTripSubnav } from '@/components/trip/LiveTripSubnav'
import { tripApi } from '@/services/tabitrace-api'
import { useTripSummaryData } from '@/hooks/useTripSummaryData'
import { formatTripDateRange } from '@/utils/journey'
import { defaultSummaryDay } from '@/utils/summary'
import { AchievementsPreview, DailyReview, JourneyHighlights, OutputReadiness, SummaryOverview, SummarySkeleton } from '@/components/trip/summary/SummaryParts'
import { photoMedium } from '@/utils/photo-variants'

export default function SummaryPage() {
  const params = useParams<{ id: string }>()
  const tripId = Number(params.id)
  const { data, error, loading, reload, byDay, earned, story, storyCover, activeShare } = useTripSummaryData(tripId)
  const [selectedDay, setSelectedDay] = useState('')
  const [completing, setCompleting] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { if (data && !selectedDay) setSelectedDay(defaultSummaryDay(data.summary.dailyRecords)) }, [data, selectedDay])
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(''), 2400); return () => window.clearTimeout(t) }, [toast])

  async function completeTrip() {
    setCompleting(true)
    try { await tripApi.complete(tripId); setToast('旅行已完成'); await reload() }
    catch (e) { setToast(e instanceof Error ? e.message : '暂时无法完成，请稍后再试') }
    finally { setCompleting(false) }
  }

  const trip = data?.trip, s = data?.summary
  const meta = trip ? [formatTripDateRange(trip.startDate, trip.endDate), trip.destinationName].filter(Boolean).join(' · ') : ''
  const output = trip && s && (
    <OutputReadiness trip={trip} s={s} story={story} storyCoverUrl={storyCover ? photoMedium(storyCover) : undefined} shareUrl={activeShare?.url} onComplete={completeTrip} completing={completing} />
  )

  return (
    <main>
      <SiteHeader />
      <PageContainer variant="medium" className="su-page px-5 py-9 sm:px-8">
        <header className="su-header">
          <p className="su-eyebrow">TRIP SUMMARY</p>
          <h1>{trip?.title || (loading ? ' ' : '旅行总结')}</h1>
          {meta && <p className="su-meta">{meta}</p>}
        </header>
        <LiveTripSubnav tripId={tripId} />

        {error && (
          <div className="su-error" role="alert">
            <p>旅行总结暂时无法加载：{error}</p>
            <button type="button" onClick={reload}><RefreshCcw size={14} aria-hidden="true" /> 重试</button>
          </div>
        )}
        {loading && !data && <SummarySkeleton />}

        {trip && s && (
          <>
            {/* ---------- 手机 ---------- */}
            <div className="su-mobile only-mobile">
              <SummaryOverview trip={trip} s={s} />
              <DailyReview tripId={tripId} s={s} selected={selectedDay} onSelect={setSelectedDay} places={byDay.places} photos={byDay.photos} />
              <JourneyHighlights s={s} hideAchievements={earned.length > 0} onPickDay={d => { setSelectedDay(d); document.getElementById('su-daily-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} />
              <AchievementsPreview tripId={tripId} earned={earned} />
              {output}
            </div>

            {/* ---------- 平板 / 桌面：原有布局 ---------- */}
            <div className="only-desktop">
              <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {([
                  ['天', s.days], ['地点', s.places], ['照片', s.photos], ['区域', s.areas],
                  ['探索度', s.officialPlacesTotal > 0 ? `${s.explorationRate}%` : '—'], ['成就', s.achievements]
                ] as [string, string | number][]).map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-black/[.07] bg-white/50 p-4">
                    <div className="font-serif text-3xl text-vermilion">{value}</div>
                    <div className="mt-1 text-[10px] text-black/40">{label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
                <section className="rounded-[28px] border border-black/[.07] bg-white/50 p-6">
                  <h2 className="font-serif text-3xl">每天留下了什么</h2>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {s.dailyRecords.map(d => (
                      <div key={d.date} className={`rounded-2xl p-4 ${d.hasRecord ? 'bg-vermilion/[.05]' : 'bg-black/[.025]'}`}>
                        <div className="text-xs font-medium">{d.date}</div>
                        <div className="mt-2 text-xs text-black/45">{d.hasRecord ? `${d.checkins} 次打卡 · ${d.photos} 张照片` : '这一天没有留下记录'}</div>
                      </div>
                    ))}
                  </div>
                </section>
                {output}
              </div>
            </div>
          </>
        )}

        {toast && <div className="ts-toast" role="status">{toast}</div>}
      </PageContainer>
    </main>
  )
}
