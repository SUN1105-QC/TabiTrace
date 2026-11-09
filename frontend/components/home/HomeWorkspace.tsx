'use client'

import Link from 'next/link'
import { ArrowRight, Camera, Film, Images, MapPin, Navigation, Plus, Share2 } from 'lucide-react'
import type { HomeData } from '@/hooks/useHomeData'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'
import { RecentActivities } from './RecentActivities'
import { buildStops, getNextStop, navigationUrl } from '@/utils/travel-map'
import { photoThumb } from '@/utils/photo-variants'
import { rememberActiveTrip } from '@/lib/active-trip'

/** 首页只聚合已有接口的真实记录；切换旅行后重新加载，所有入口都携带同一个旅行 ID。 */
export function HomeWorkspace({ data, onSwitch }: { data: HomeData; onSwitch: () => void }) {
  const { openQuickCheckIn } = useQuickCheckIn()
  const trip = data.activeTrip
  const readOnly = trip?.status === 'ARCHIVED'
  const timeline = data.checkins.map(checkin => ({ date: checkin.checkinTime.slice(0, 10), items: [{ checkin, photos: [] }] }))
  const next = getNextStop(buildStops(data.itinerary, timeline, data.places), new Date())
  const href = (suffix: string) => trip ? `/trips/${trip.id}/${suffix}` : '/trips/new'
  const photos = [...data.photos].reverse().slice(0, 6)
  return <div className="hw-workspace">
    <header className="hw-heading"><div><p>你好，{data.user?.nickname || '旅行中的你'}</p><h1>我的旅行工作台</h1></div><Link href="/trips/new" className="hw-secondary"><Plus size={16} />创建旅行</Link></header>
    {trip ? <>
      <section className="hw-trip" aria-label="当前旅行">
        <div className="hw-trip-copy"><span className="hw-kicker">当前旅行{readOnly ? ' · 已归档，只读' : ''}</span>
          <label className="sr-only" htmlFor="hw-trip">切换旅行</label><select id="hw-trip" value={trip.id} onChange={e => { rememberActiveTrip(Number(e.target.value)); onSwitch() }}>
            {data.trips.map(row => <option key={row.id} value={row.id}>{row.title}{row.status === 'ARCHIVED' ? ' · 已归档' : ''}</option>)}
          </select><p>{trip.destinationName} · {trip.startDate} — {trip.endDate}</p>
          <p>{data.checkins.length} 次打卡 · {data.activeSummary?.photos ?? data.photos.length} 张照片</p>
        </div>
        {readOnly ? <Link href={href('map')} className="warm-button">查看旅行记录<ArrowRight size={16} /></Link>
          : <button className="warm-button" onClick={() => openQuickCheckIn(trip.id)}><Camera size={18} />记录这一刻</button>}
      </section>
      <nav className="hw-shortcuts" aria-label="当前旅行操作">
        {[[MapPin, '地图与行程', 'map'], [Images, '整理照片', 'gallery'], [Share2, '导出与分享', 'share'], [Film, '旅行视频', 'video']].map(([Icon, label, suffix]) => {
          const Symbol = Icon as typeof MapPin
          return <Link key={String(suffix)} href={href(String(suffix))}><Symbol size={21} /><span>{String(label)}</span><ArrowRight size={14} /></Link>
        })}
      </nav>
      <div className="hw-columns">
        <div className="hw-main">
          {!readOnly && <section className="hw-section hw-next"><header><h2>接下来去哪？</h2><Link href={href('map')}>全部行程<ArrowRight size={14} /></Link></header>
            {next ? <><p className="hw-kicker">{next.overdue ? '待完成的计划' : '下一站'} · {next.stop.date}{next.stop.plannedTime ? ` · ${next.stop.plannedTime}` : ''}</p><h3>{next.stop.name}</h3><p>{next.stop.area || '到达后，记下此刻的风景。'}</p>
              <div className="hw-inline-actions"><button className="warm-button" onClick={() => openQuickCheckIn(trip.id, { placeId: next.stop.placeId, itineraryItemId: next.stop.itineraryId, placeName: next.stop.name, area: next.stop.area, date: next.stop.date })}><Camera size={16} />到达打卡</button>
                {navigationUrl(next.stop) && <a className="hw-secondary" href={navigationUrl(next.stop)!} target="_blank" rel="noopener noreferrer"><Navigation size={15} />打开导航</a>}</div>
            </> : <><p>还没有待完成的行程，随时记录也很好。</p><Link className="hw-secondary" href={href('map')}><Plus size={16} />安排行程</Link></>}
          </section>}
          <RecentActivities activities={data.activities} tripId={trip.id} />
        </div>
        <aside className="hw-section hw-photos"><header><h2>最近照片</h2><Link href={href('gallery')}>全部照片<ArrowRight size={14} /></Link></header>
          {photos.length ? <div className="hw-photo-grid">{photos.map(photo => <Link key={photo.id} href={href('gallery')} aria-label="打开旅行相册"><img src={photoThumb(photo)} alt="旅行照片" loading="lazy" /></Link>)}</div> : <p>还没有照片，上传后就能制作旅行作品。</p>}
          {!readOnly && <Link className="hw-secondary" href={href('gallery')}>整理与添加照片<ArrowRight size={15} /></Link>}
          <div className="hw-export-tip"><Share2 size={20} /><h3>把旅途带回家</h3><p>保存带地图的 PDF 记录，或制作九宫格和旅行海报。</p><Link href={href('share')} className="hw-secondary">打开导出与分享<ArrowRight size={15} /></Link></div>
        </aside>
      </div>
    </> : <section className="hw-section hw-empty"><MapPin size={32} /><h2>从第一段旅行开始</h2><p>选择目的地和日期，照片、打卡和旅行作品都会归在同一段旅程里。</p><Link href="/trips/new" className="warm-button"><Plus size={17} />创建第一段旅行</Link></section>}
  </div>
}
