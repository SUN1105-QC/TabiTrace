'use client'

/**
 * 旅行详情总览。数据只在这里请求一次（useTripDetailData），
 * 桌面布局保持原样（.only-desktop），< 768px 使用重新组织的移动布局（.only-mobile）。
 */

import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Archive, ArchiveRestore, ArrowRight, CalendarDays, Camera, MapPin, RefreshCcw, Route, Sparkles, TriangleAlert, Trophy } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { LiveTripSubnav } from '@/components/trip/LiveTripSubnav'
import { MobileTripDetail, MobileTripDetailSkeleton } from '@/components/trip/detail/MobileTripDetail'
import { useTripDetailData } from '@/hooks/useTripDetailData'
import { tripApi, type TripView } from '@/services/tabitrace-api'
import { formatTripStatus } from '@/utils/trip'

export default function TripPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const { trip, setTrip, summary, recent, loading, error, reload } = useTripDetailData(id)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  // 编辑 / 归档后：先用返回的旅行更新，再静默刷新统计（天数、状态可能变化）
  const onTripChanged = useCallback((t: TripView) => { setTrip(t); void reload(true) }, [setTrip, reload])

  const changeArchive = async () => {
    if (!trip) return
    setBusy(true); setActionError('')
    try { onTripChanged(trip.status === 'ARCHIVED' ? await tripApi.unarchive(id) : await tripApi.archive(id)) }
    catch (e) { setActionError(e instanceof Error && e.message ? e.message : '操作失败') }
    finally { setBusy(false) }
  }

  if (error) {
    return (
      <main><SiteHeader />
        <section className="mx-auto max-w-[1180px] px-5 pb-12 sm:px-8">
          <div className="td-error" role="alert">
            <TriangleAlert size={22} />
            <p>旅行信息加载失败</p>
            <small>{error}</small>
            <button type="button" className="td-btn is-primary" onClick={() => void reload()}><RefreshCcw size={15} /> 重新加载</button>
          </div>
        </section>
      </main>
    )
  }

  if (loading || !trip || !summary) {
    return (
      <main><SiteHeader />
        <section className="mx-auto max-w-[1180px] px-5 pb-12 sm:px-8">
          <div className="only-desktop text-sm text-black/45">正在读取旅行…</div>
          <div className="only-mobile"><MobileTripDetailSkeleton /></div>
        </section>
      </main>
    )
  }

  const status = formatTripStatus(trip.status)

  return <main><SiteHeader /><section className="mx-auto max-w-[1180px] px-5 pb-12 sm:px-8">
    <div className="only-mobile">
      <MobileTripDetail trip={trip} summary={summary} recent={recent} onTripChanged={onTripChanged} onToast={showToast} />
    </div>
    <div className="only-desktop">
      {actionError && <div className="mb-4 rounded-2xl bg-warm/10 p-5 text-sm text-warm">{actionError}</div>}
      <div className="relative overflow-hidden rounded-[30px] shadow-card"><img src={trip.coverImage || '/images/cover.jpg'} alt={trip.title} className="h-[300px] w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-7 text-white sm:p-9"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold backdrop-blur">{trip.destinationName}</span><span className="rounded-full bg-warm px-3 py-1 text-[10px] font-bold">{trip.planType}</span></div><h1 className="mt-4 font-serif text-4xl sm:text-5xl">{trip.title}</h1><p className="mt-2 text-sm text-white/75">{trip.startDate} — {trip.endDate} · {trip.peopleCount} 人同行</p></div></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><LiveTripSubnav tripId={id} /><button disabled={busy} onClick={changeArchive} className="mt-7 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/55 px-4 py-2 text-xs font-bold text-black/55 transition hover:border-warm/30 hover:text-warm disabled:opacity-50">{trip.status === 'ARCHIVED' ? <ArchiveRestore size={14} /> : <Archive size={14} />} {trip.status === 'ARCHIVED' ? '取消归档' : '归档旅行'}</button></div>
      <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-6"><Stat icon={<CalendarDays />} value={String(summary.days)} label="天" /><Stat icon={<MapPin />} value={String(summary.places)} label="地点" /><Stat icon={<Camera />} value={String(summary.photos)} label="照片" /><Stat icon={<Route />} value={`${summary.explorationRate ?? 0}%`} label="探索度" /><Stat icon={<Trophy />} value={String(summary.achievements)} label="成就" /><Stat icon={<Sparkles />} value={status.label} label={`状态 · ${status.code}`} /></div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><div className="warm-card p-6"><p className="text-xs font-bold tracking-[.15em] text-warm">TRAVEL READINESS</p><h2 className="mt-2 font-serif text-3xl">成果准备度</h2><p className="mt-2 text-sm text-black/45">由真实打卡、照片和每日记录自动计算。</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><Mini value={String(summary.readiness.recordedDays)} label="有记录天数" /><Mini value={String(summary.readiness.featuredPhotos)} label="精选照片" /><Mini value={summary.readiness.videoReady ? 'READY' : 'WAIT'} label="旅行视频" /></div></div><div className="rounded-[28px] bg-[#F2E4D4] p-6"><p className="text-xs font-bold tracking-[.15em] text-warm">NEXT</p><h2 className="mt-2 font-serif text-3xl">继续留下旅迹</h2><p className="mt-3 text-sm leading-6 text-black/50">添加行程、完成打卡、上传照片，最后生成分享图和旅行视频。</p><Link href={`/trips/${id}/map`} className="mt-6 warm-button">进入地图与时间轴 <ArrowRight size={14} /></Link></div></div>
    </div>
    {toast && <div className="ts-toast" role="status" aria-live="polite">{toast}</div>}
  </section></main>
}
function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) { return <div className="warm-card p-4"><div className="text-warm">{icon}</div><div className="mt-4 font-serif text-2xl">{value}</div><div className="text-[10px] text-black/40">{label}</div></div> }
function Mini({ value, label }: { value: string; label: string }) { return <div className="rounded-2xl bg-[#F8F2EA] p-4"><div className="font-serif text-2xl text-warm">{value}</div><div className="mt-1 text-xs text-black/40">{label}</div></div> }
