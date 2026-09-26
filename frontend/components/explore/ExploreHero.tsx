'use client'

/**
 * 首屏：左侧城市专题文案 + CTA + 快速标签，右侧大号城市专题卡（封面、当季推荐与真实统计）。
 * 数字全部来自官方内容库：地点数、专题路线数、区域数。
 */

import Link from 'next/link'
import { ArrowRight, Compass, Map as MapIcon } from 'lucide-react'
import type { OfficialRouteView } from '@/services/tabitrace-api'

const QUICK_TAGS: { label: string; filter?: string; route?: string }[] = [
  { label: '城市漫步', filter: 'WALK' },
  { label: '地标', filter: 'LANDMARK' },
  { label: '夜景', filter: 'NIGHT' },
  { label: '展馆', filter: 'MUSEUM' },
  { label: '秋日', route: 'AUTUMN_TOKYO' },
  { label: '美食', filter: 'FOOD' },
  { label: '购物', filter: 'SHOP' }
]

export function ExploreHero({ stats, season, seasonRoute, trip, onStart, onMap, onFilter, onRoute }: {
  stats: { places: number; routes: number; areas: number }
  season: string
  seasonRoute?: OfficialRouteView
  trip: { id: number; title: string } | null
  onStart: () => void
  onMap: () => void
  onFilter: (key: string) => void
  onRoute: (code: string) => void
}) {
  return (
    <section className="ex-hero">
      <div className="ex-hero-text">
        <p className="ex-eyebrow">TOKYO OFFICIAL EXPLORE</p>
        <h1>从东京开始，<br />探索一座城市的另一种方式。</h1>
        <p className="ex-hero-lead">将地标、街区、文化体验与散步灵感，整理成一份更值得出发的城市指南。</p>
        <div className="ex-hero-cta">
          <button type="button" className="ex-btn is-primary" onClick={onStart}><Compass size={15} /> 开始探索</button>
          <button type="button" className="ex-btn" onClick={onMap}><MapIcon size={15} /> 查看地图</button>
        </div>
        <div className="ex-tags">
          {QUICK_TAGS.map(t => (
            <button key={t.label} type="button" onClick={() => (t.route ? onRoute(t.route) : onFilter(t.filter!))}>{t.label}</button>
          ))}
        </div>
        <p className="ex-trip-line">
          {trip ? <>地点会加入到当前旅行：<Link href={`/trips/${trip.id}`}>{trip.title}</Link></> : <>还没有打开的旅行，<Link href="/trips/new">先创建一段旅行</Link>，就可以把地点加进去。</>}
        </p>
      </div>

      <div className="ex-city">
        <img src={seasonRoute?.coverImage ?? '/images/explore/rainbow-bridge.jpg'} alt="东京" />
        <div className="ex-city-shade" />
        <div className="ex-city-top">
          <span>OFFICIAL CITY GUIDE</span>
          <span>{season}季特别版</span>
        </div>
        <div className="ex-city-body">
          <b>TOKYO</b>
          <p>东京探索指南</p>
          <dl>
            <div><dt>{stats.places}</dt><dd>精选地点</dd></div>
            <div><dt>{stats.routes}</dt><dd>推荐路线</dd></div>
            <div><dt>{stats.areas}</dt><dd>探索区域</dd></div>
          </dl>
          {seasonRoute && (
            <button type="button" className="ex-city-season" onClick={() => onRoute(seasonRoute.code)}>
              当季推荐 · {seasonRoute.title} <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
