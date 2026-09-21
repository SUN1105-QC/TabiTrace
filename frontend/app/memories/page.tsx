'use client'

/** 旅行回忆：已完成 / 已归档旅行的回顾入口，数据全部来自既有 Trip 与 Summary 接口。 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Camera, Film, MapPin, RefreshCcw, Share2, Trophy } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { tripApi, type TripSummary, type TripView } from '@/services/tabitrace-api'

export default function MemoriesPage() {
  const [trips, setTrips] = useState<TripView[]>([])
  const [summaries, setSummaries] = useState<Record<number, TripSummary>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    ;(async () => {
      try {
        const rows = await tripApi.list()
        const past = rows.filter(t => t.status === 'COMPLETED' || t.status === 'ARCHIVED')
        const pairs = await Promise.all(past.map(async t => {
          try { return [t.id, await tripApi.summary(t.id)] as const } catch { return [t.id, null] as const }
        }))
        if (cancelled) return
        setTrips(past)
        const map: Record<number, TripSummary> = {}
        pairs.forEach(([id, s]) => { if (s) map[id] = s })
        setSummaries(map)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '旅行回忆加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [reloadKey])

  return (
    <main>
      <SiteHeader />
      <section className="mx-auto w-full max-w-[1320px] px-5 pb-14 sm:px-8">
        <p className="text-sm font-bold text-warm">TRAVEL MEMORIES</p>
        <h1 className="mt-2 font-serif text-4xl">旅行回忆</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-black/50">那些走过的路，都会成为更好的自己。这里汇总已完成与已归档的旅行，可以随时回看成果、分享图和 Travel Story。</p>

        {error ? (
          <div className="warm-card mt-8 p-8 text-center">
            <p className="font-serif text-2xl">旅行回忆加载失败</p>
            <p className="mt-2 text-sm text-black/50">{error}</p>
            <button className="warm-button mx-auto mt-5" onClick={() => setReloadKey(k => k + 1)}><RefreshCcw size={15} /> 重新加载</button>
          </div>
        ) : loading ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="skeleton skeleton-block" />)}</div>
        ) : trips.length === 0 ? (
          <div className="warm-card mt-8 p-10 text-center">
            <p className="font-serif text-2xl">还没有旅行回忆</p>
            <p className="mt-2 text-sm text-black/50">完成一段旅行后，它会出现在这里，连同统计、成就和分享成果。</p>
            <Link href="/trips" className="warm-button mx-auto mt-5">回到我的旅行</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {trips.map(trip => {
              const s = summaries[trip.id]
              return (
                <article key={trip.id} className="warm-card overflow-hidden">
                  <div className="relative h-44">
                    <img src={trip.coverImage || '/images/cover.jpg'} alt={`${trip.title} 封面`} className="h-full w-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <p className="text-[10px] tracking-[.18em] opacity-80">{trip.status === 'ARCHIVED' ? 'ARCHIVED' : 'COMPLETED'}</p>
                      <h2 className="mt-1 font-serif text-2xl">{trip.title}</h2>
                      <p className="mt-1 text-xs opacity-80">{trip.startDate} — {trip.endDate}</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Fact icon={<MapPin size={13} />} value={s?.places ?? 0} label="地点" />
                      <Fact icon={<Camera size={13} />} value={s?.photos ?? 0} label="照片" />
                      <Fact icon={<Trophy size={13} />} value={s?.achievements ?? 0} label="成就" />
                      <Fact icon={<Film size={13} />} value={`${s?.explorationRate ?? 0}%`} label="探索" />
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link href={`/trips/${trip.id}/summary`} className="warm-button flex-1 justify-center">旅行总结 <ArrowRight size={13} /></Link>
                      <Link href={`/trips/${trip.id}/share`} className="hero-ghost-button"><Share2 size={13} /> 成果</Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function Fact({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-[#F8F2EA] p-3">
      <div className="grid place-items-center text-warm">{icon}</div>
      <div className="mt-1 font-serif text-xl">{value}</div>
      <div className="text-[10px] text-black/40">{label}</div>
    </div>
  )
}
