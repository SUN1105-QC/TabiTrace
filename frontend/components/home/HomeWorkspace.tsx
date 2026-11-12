'use client'

import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Camera, ChevronDown, ChevronRight, Clock, Film, Image as ImageIcon, LocateFixed, Map as MapIcon, MapPin, Navigation, Plus, Share2, Sparkles } from 'lucide-react'
import type { HomeData } from '@/hooks/useHomeData'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'
import { RecentActivities } from './RecentActivities'
import { TripLandmark } from './TripLandmark'
import { buildStops, getNextStop, navigationUrl } from '@/utils/travel-map'
import { photoThumb } from '@/utils/photo-variants'
import { rememberActiveTrip } from '@/lib/active-trip'
import { localDateKey } from '@/lib/time'
import { parseDay } from '@/utils/journey'

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const SHORTCUTS = [
  [MapIcon, '地图与行程', '查看旅行路线', 'map'],
  [ImageIcon, '整理照片', '珍藏旅途瞬间', 'gallery'],
  [Share2, '导出与分享', '生成旅行记录', 'share'],
  [Film, '旅行视频', '让回忆动起来', 'video']
] as const

const countryName = (code?: string) => {
  if (!code) return ''
  try { return new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(code.toUpperCase()) ?? '' } catch { return '' }
}
/** YYYY-MM-DD → 2026.11.14；同一年的结束日省略年份 */
const dateRange = (start: string, end: string) => {
  const s = start.replaceAll('-', '.'), e = end.replaceAll('-', '.')
  return start.slice(0, 4) === end.slice(0, 4) ? `${s} — ${e.slice(5)}` : `${s} — ${e}`
}

/** 首页只聚合已有接口的真实记录；切换旅行后重新加载，所有入口都携带同一个旅行 ID。 */
export function HomeWorkspace({ data, onSwitch }: { data: HomeData; onSwitch: () => void }) {
  const { openQuickCheckIn } = useQuickCheckIn()
  const trip = data.activeTrip
  const readOnly = trip?.status === 'ARCHIVED'
  const timeline = data.checkins.map(checkin => ({ date: checkin.checkinTime.slice(0, 10), items: [{ checkin, photos: [] }] }))
  const next = getNextStop(buildStops(data.itinerary, timeline, data.places), new Date())
  const href = (suffix: string) => trip ? `/trips/${trip.id}/${suffix}` : '/trips/new'
  const photos = [...data.photos].reverse().slice(0, 6)
  const name = data.user?.nickname?.trim() || '旅行中的你'

  const today = localDateKey(new Date())
  const phase = !trip ? null : readOnly ? 'archived' : today < trip.startDate ? 'upcoming' : today > trip.endDate ? 'ended' : 'ongoing'
  const start = trip ? parseDay(trip.startDate) : null, end = trip ? parseDay(trip.endDate) : null
  const days = start !== null && end !== null ? Math.round((end - start) / 86400000) + 1 : null
  const country = countryName(trip?.countryCode)
  const place = trip ? [country, trip.city || trip.destinationName].filter((v, i, all) => v && all.indexOf(v) === i).join(' · ') : ''
  const headline = phase === 'ongoing' ? '今天也记下旅途的风景吧。' : phase === 'upcoming' || !trip ? '准备好下一段旅程了吗？' : '一起回看这段旅程吧。'
  const badge = { upcoming: '即将出发', ongoing: '旅行中', ended: '已结束', archived: '已归档，只读' }[phase ?? 'upcoming']

  const stopDay = next ? parseDay(next.stop.date) : null
  const stopDate = stopDay !== null ? new Date(stopDay) : null
  const stopTime = next?.stop.plannedTime?.slice(0, 5)

  return <div className="hw-workspace">
    <header className="hw-heading">
      <div>
        <p className="hw-eyebrow">YOUR TRAVEL SPACE<span>/</span>旅行工作台</p>
        <h1>你好，{name}。{headline}</h1>
        <p>记录路上的每个瞬间，让旅行有迹可循。</p>
      </div>
      <Link href="/trips/new" className="hw-secondary hw-create"><Plus size={16} />创建旅行</Link>
    </header>
    {trip ? <>
      <section className="hw-trip" aria-label="当前旅行">
        <TripLandmark trip={trip} />
        {/[A-Za-z]/.test(trip.city || '') && <span className="hw-script" aria-hidden="true">{trip.city}.</span>}
        <div className="hw-trip-copy">
          <span className="hw-badge"><Sparkles size={12} />{badge} · 当前旅行</span>
          <label className="sr-only" htmlFor="hw-trip">切换旅行</label>
          <div className="hw-trip-title">
            <select id="hw-trip" value={trip.id} onChange={e => { rememberActiveTrip(Number(e.target.value)); onSwitch() }}>
              {data.trips.map(row => <option key={row.id} value={row.id}>{row.title}{row.status === 'ARCHIVED' ? ' · 已归档' : ''}</option>)}
            </select>
            {data.trips.length > 1 && <ChevronDown size={20} aria-hidden="true" />}
          </div>
          <p className="hw-trip-meta">
            {place && <span><MapPin size={16} />{place}</span>}
            <span><CalendarDays size={16} />{dateRange(trip.startDate, trip.endDate)}</span>
          </p>
          <p className="hw-trip-stats">
            {days !== null && <span><CalendarDays size={15} />{days} 天旅程</span>}
            <span><Camera size={15} />{data.checkins.length} 次打卡</span>
            <span><ImageIcon size={15} />{data.activeSummary?.photos ?? data.photos.length} 张照片</span>
          </p>
          <div className="hw-trip-actions">
            <Link href={readOnly ? href('map') : `/trips/${trip.id}`} className="warm-button">{readOnly ? '查看旅行记录' : '进入旅行'}<ArrowUpRight size={16} /></Link>
            {!readOnly && <button className="hw-secondary" onClick={() => openQuickCheckIn(trip.id)}><Camera size={16} />记录这一刻</button>}
          </div>
        </div>
      </section>
      <nav className="hw-shortcuts" aria-label="当前旅行操作">
        {SHORTCUTS.map(([Icon, label, hint, suffix]) => <Link key={suffix} href={href(suffix)}>
          <span className="hw-tile"><Icon size={20} /></span>
          <span className="hw-shortcut-text"><b>{label}</b><small>{hint}</small></span>
          <ChevronRight size={16} />
        </Link>)}
      </nav>
      <div className="hw-columns">
        <div className="hw-main">
          {!readOnly && <section className="hw-section hw-next">
            <header><h2>{next?.overdue ? '待完成的计划' : '下一站'}<small>{next?.overdue ? '计划时间已过，可以补记' : '即将开启的旅程'}</small></h2><Link href={href('map')}>全部行程<ChevronRight size={14} /></Link></header>
            {next ? <div className="hw-next-body">
              {stopDate && <div className="hw-date-card" aria-label={next.stop.date}>
                <span>{MONTHS[stopDate.getUTCMonth()]} · {stopDate.getUTCFullYear()}</span>
                <b>{stopDate.getUTCDate()}</b>
                <small>{WEEKDAYS[stopDate.getUTCDay()]}</small>
              </div>}
              <div className="hw-next-copy">
                {(stopTime || next.stop.area) && <p className="hw-next-kicker">{[stopTime, next.stop.area].filter(Boolean).join(' · ')}</p>}
                <h3>{next.stop.name}</h3>
                <p>{next.stop.note || '到达后，记下此刻的风景。'}</p>
                <div className="hw-inline-actions">
                  <button className="warm-button" onClick={() => openQuickCheckIn(trip.id, { placeId: next.stop.placeId, itineraryItemId: next.stop.itineraryId, placeName: next.stop.name, area: next.stop.area, date: next.stop.date })}><Camera size={16} />到达打卡</button>
                  {navigationUrl(next.stop) && <a className="hw-secondary" href={navigationUrl(next.stop)!} target="_blank" rel="noopener noreferrer"><Navigation size={15} />打开导航</a>}
                </div>
                <p className="hw-next-meta">
                  {place && <span><LocateFixed size={13} />{[trip.city || trip.destinationName, country].filter((v, i, all) => v && all.indexOf(v) === i).join(' · ')}</span>}
                  {stopDate && <span><Clock size={13} />{stopDate.getUTCMonth() + 1}月{stopDate.getUTCDate()}日{stopTime ? ` ${stopTime}` : ''}</span>}
                </p>
              </div>
            </div> : <div className="hw-next-empty"><p>还没有待完成的行程，随时记录也很好。</p><Link className="hw-secondary" href={href('map')}><Plus size={16} />安排行程</Link></div>}
          </section>}
          <RecentActivities activities={data.activities} tripId={trip.id} />
        </div>
        <aside className="hw-side">
          <section className="hw-section hw-photos"><header><h2>最近照片</h2><Link href={href('gallery')}>全部照片<ChevronRight size={14} /></Link></header>
            {photos.length ? <>
              <div className="hw-photo-grid">{photos.map(photo => <Link key={photo.id} href={href('gallery')} aria-label="打开旅行相册"><img src={photoThumb(photo)} alt="旅行照片" loading="lazy" /></Link>)}</div>
              {!readOnly && <Link className="hw-secondary" href={href('gallery')}><Plus size={15} />整理与添加照片</Link>}
            </> : <div className="hw-photo-empty">
              <span className="hw-round"><ImageIcon size={22} /></span>
              <b>旅途故事，等待第一张照片</b>
              <p>上传照片，留住值得回忆的瞬间。</p>
              {!readOnly && <Link className="hw-secondary" href={href('gallery')}><Plus size={15} />整理与添加照片</Link>}
            </div>}
          </section>
          <section className="hw-section hw-export-tip">
            <Sparkles className="hw-spark" size={22} aria-hidden="true" />
            <p className="hw-eyebrow">TRAVEL MEMORIES</p>
            <h2>把旅行带回家</h2>
            <p>把地图、打卡和照片整理成自己的旅行手记，分享路上遇见的美好。</p>
            <Link href={href('share')} className="hw-secondary"><Share2 size={16} />导出与分享<ArrowUpRight size={15} /></Link>
          </section>
        </aside>
      </div>
    </> : <section className="hw-section hw-empty"><MapPin size={32} /><h2>从第一段旅行开始</h2><p>选择目的地和日期，照片、打卡和旅行作品都会归在同一段旅程里。</p><Link href="/trips/new" className="warm-button"><Plus size={17} />创建第一段旅行</Link></section>}
  </div>
}
