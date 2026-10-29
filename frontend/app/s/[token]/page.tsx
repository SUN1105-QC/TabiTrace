'use client'

/**
 * 公开分享页（未登录也可访问）：旅行标题与日期 → 封面 → 旅行数据 → 精选照片 → 按天时间轴。
 * 移动端优先：数据 2×2、照片三列、时间轴紧凑；数据全部来自 GET /share/{token}，没有的内容就不显示。
 */

import { PageContainer } from '@/components/common/PageContainer'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CalendarDays, Camera, MapPin, Building2 } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { TripCoverImage } from '@/components/trip/TripCoverImage'
import { tripApi, type PublicShareView } from '@/services/tabitrace-api'
import { timeOfDay } from '@/lib/time'
import { photoMedium, photoThumb, photoSrcSet } from '@/utils/photo-variants'

const dot = (d: string) => d.replace(/-/g, '.')
const dayLabel = (date: string) => { const [, m, d] = date.split('-').map(Number); return m && d ? `${m}月${d}日` : date }

export default function PublicSharePage() {
  const params = useParams<{ token: string }>()
  const [data, setData] = useState<PublicShareView | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    tripApi.publicShare(params.token).then(setData).catch((e: unknown) => setError(e instanceof Error && e.message ? e.message : '分享链接无效'))
  }, [params.token])

  return (
    <main>
      <SiteHeader />
      <PageContainer variant="narrow" className="px-4 pb-16 pt-6 sm:px-8 sm:pt-12">
        {error ? <div className="rounded-2xl bg-vermilion/10 p-5 text-sm text-vermilion">{error}</div>
          : !data ? <div className="text-sm text-black/45">正在读取旅迹分享…</div>
          : <Share data={data} />}
      </PageContainer>
    </main>
  )
}

function Share({ data }: { data: PublicShareView }) {
  const { trip, summary } = data
  const hero = data.featuredPhotos?.[0]
  const photos = (data.featuredPhotos ?? []).slice(hero ? 1 : 0, (hero ? 1 : 0) + 6)
  const days = (data.timeline ?? []).filter(d => d.items?.length)

  return (
    <>
      <p className="text-xs font-bold tracking-[.16em] text-vermilion">UNLISTED TRAVEL STORY</p>
      <h1 className="mt-2 font-serif text-[30px] leading-tight [text-wrap:balance] sm:text-5xl">{trip.title}</h1>
      <p className="mt-2 text-sm text-black/50">
        {trip.destinationName} · {dot(trip.startDate)} — {dot(trip.endDate)}
        <span className="block text-xs text-black/40 sm:ml-2 sm:inline">来自 {data.ownerNickname} 的旅迹分享</span>
      </p>

      <div className="mt-5 h-52 overflow-hidden rounded-[22px] sm:h-80 sm:rounded-[28px] [&>img]:h-full [&>img]:w-full [&>img]:object-cover">
        {hero ? <img src={photoMedium(hero)} srcSet={photoSrcSet(hero)} sizes="(max-width: 1199px) 100vw, 1120px" alt={`${trip.title} 精选照片`} fetchPriority="high" /> : <TripCoverImage trip={trip} alt={`${trip.title} 封面`} loading="eager" sizes="(max-width: 1199px) 100vw, 1120px" />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat icon={<CalendarDays size={16} />} value={summary.days} label="天" />
        <Stat icon={<MapPin size={16} />} value={summary.places} label="地点" />
        <Stat icon={<Camera size={16} />} value={summary.photos} label="照片" />
        <Stat icon={<Building2 size={16} />} value={summary.cities} label="城市" />
      </div>

      {photos.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-2xl sm:text-3xl">精选照片</h2>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {photos.map(p => <img key={p.id} src={photoThumb(p)} srcSet={photoSrcSet(p)} sizes="(max-width: 639px) 33vw, 25vw" alt="" loading="lazy" decoding="async" className="aspect-square w-full rounded-xl object-cover" />)}
          </div>
        </section>
      )}

      {days.length > 0 && (
        <section className="mt-8 rounded-[22px] border border-black/[0.07] bg-white/60 p-4 sm:rounded-[28px] sm:p-6">
          <h2 className="font-serif text-2xl sm:text-3xl">旅行时间轴</h2>
          <ol className="mt-4 space-y-5">
            {days.map((day, i) => (
              <li key={day.date}>
                <p className="text-xs font-bold tracking-[.08em] text-vermilion">DAY {String(i + 1).padStart(2, '0')} · {dayLabel(day.date)}</p>
                <ul className="mt-2 space-y-3 border-l border-vermilion/25 pl-4">
                  {day.items.map(item => (
                    <li key={item.checkin.id}>
                      <p className="text-[15px] font-bold leading-6">
                        <span className="mr-2 text-xs font-bold text-black/40">{timeOfDay(item.checkin.checkinTime)}</span>{item.checkin.placeName}
                        {item.checkin.area && <span className="ml-1.5 text-xs font-normal text-black/40">{item.checkin.area}</span>}
                      </p>
                      {item.checkin.note && <p className="mt-1 text-sm leading-6 text-black/55">{item.checkin.note}</p>}
                      {item.photos?.length > 0 && (
                        <div className="mt-2 flex gap-2">
                          {item.photos.slice(0, 3).map(p => <img key={p.id} src={photoThumb(p)} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}

    </>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white/60 px-4 py-3 sm:block sm:p-4">
      <div className="text-vermilion">{icon}</div>
      <div className="flex items-baseline gap-1.5 sm:mt-3 sm:block">
        <div className="font-serif text-2xl sm:text-3xl">{value ?? 0}</div>
        <div className="text-xs text-black/45">{label}</div>
      </div>
    </div>
  )
}
