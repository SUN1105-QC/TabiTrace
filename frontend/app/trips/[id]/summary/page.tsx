'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Film, Image, Sparkles } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { LiveTripSubnav } from '@/components/trip/LiveTripSubnav'
import { tripApi, type TripSummary, type TripView } from '@/services/tabitrace-api'

export default function SummaryPage() {
  const params = useParams<{ id: string }>()
  const tripId = Number(params.id)
  const [trip, setTrip] = useState<TripView | null>(null)
  const [summary, setSummary] = useState<TripSummary | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const reload = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([tripApi.get(tripId), tripApi.summary(tripId)])
      setTrip(t)
      setSummary(s)
    } catch (e: any) {
      setError(e.message)
    }
  }, [tripId])

  useEffect(() => { reload() }, [reload])

  async function completeTrip() {
    try {
      await tripApi.complete(tripId)
      setToast('旅行已完成')
      await reload()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-5 py-9 sm:px-8">
        <p className="text-xs font-semibold tracking-[.18em] text-vermilion">TRIP SUMMARY</p>
        <h1 className="mt-2 font-serif text-4xl">{trip?.title || '旅行总结'}</h1>
        <LiveTripSubnav tripId={tripId} />

        {error && <div className="mt-5 rounded-2xl bg-vermilion/10 p-4 text-sm text-vermilion">{error}</div>}

        {summary && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['天', summary.days],
                ['地点', summary.places],
                ['照片', summary.photos],
                ['区域', summary.areas],
                ['探索度', `${summary.explorationRate}%`],
                ['成就', summary.achievements]
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-black/[.07] bg-white/50 p-4">
                  <div className="font-serif text-3xl text-vermilion">{value}</div>
                  <div className="mt-1 text-[10px] text-black/40">{label}</div>
                </div>
              ))}
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
              <section className="rounded-[28px] border border-black/[.07] bg-white/50 p-6">
                <h2 className="font-serif text-3xl">每天留下了什么</h2>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {summary.dailyRecords.map(d => (
                    <div key={d.date} className={`rounded-2xl p-4 ${d.hasRecord ? 'bg-vermilion/[.05]' : 'bg-black/[.025]'}`}>
                      <div className="text-xs font-medium">{d.date}</div>
                      <div className="mt-2 text-xs text-black/45">{d.checkins} 次打卡 · {d.photos} 张照片</div>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="rounded-[28px] bg-ink p-6 text-white">
                <p className="text-xs tracking-[.16em] text-white/45">OUTPUT READINESS</p>
                <h2 className="mt-2 font-serif text-3xl">旅行成果</h2>
                <div className="mt-5 space-y-3 text-sm">
                  <Ready ok={summary.readiness.shareReady} label="分享图" />
                  <Ready ok={summary.readiness.videoReady} label="旅行视频" />
                  <Ready ok={summary.readiness.featuredPhotos > 0} label={`精选照片 ${summary.readiness.featuredPhotos}`} />
                </div>

                {trip?.status !== 'COMPLETED' && (
                  <button onClick={completeTrip} className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-ink">
                    完成这次旅行
                  </button>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link href={`/trips/${tripId}/share`} className="inline-flex items-center justify-center gap-1 rounded-xl bg-vermilion px-3 py-3 text-xs">
                    <Image size={13} /> 分享成果
                  </Link>
                  <Link href={`/trips/${tripId}/video`} className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/20 px-3 py-3 text-xs">
                    <Film size={13} /> 旅行视频
                  </Link>
                </div>
              </aside>
            </div>
          </>
        )}

        {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-xs text-white">{toast}</div>}
      </section>
    </main>
  )
}

function Ready({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/[.06] px-4 py-3">
      <span>{label}</span>
      {ok ? <CheckCircle2 size={16} className="text-[#d9be84]" /> : <Sparkles size={15} className="text-white/30" />}
    </div>
  )
}
