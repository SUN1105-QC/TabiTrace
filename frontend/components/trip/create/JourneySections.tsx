'use client'

/** 创建旅行页的区块：官方探索、同行人数 Stepper、创建后准备的内容、创建摘要、创建成功。 */

import Link from 'next/link'
import { ArrowRight, CalendarDays, Camera, CheckCircle2, Map as MapIcon, Minus, Plus, Route, Sparkles } from 'lucide-react'
import type { OfficialGuide, TripView } from '@/services/tabitrace-api'
import { TRAVELERS_MAX, TRAVELERS_MIN, calculateTripDuration, formatTripDateRange, type PickedDestination } from '@/utils/journey'

/** 只在目的地真的有官方探索内容时渲染（调用方负责判断），数量为后端实时统计 */
export function OfficialGuideCard({ guide, join, onJoin }: { guide: OfficialGuide; join: boolean; onJoin: (v: boolean) => void }) {
  return (
    <section className="cj-official" aria-labelledby="cj-official-title">
      <div className="cj-official-head">
        <div>
          <p className="cj-eyebrow">{guide.code} OFFICIAL GUIDE</p>
          <h3 id="cj-official-title">{guide.name}官方探索</h3>
        </div>
        <Sparkles size={20} aria-hidden="true" />
      </div>
      <div className="cj-official-stats">
        <span><b>{guide.placeCount}</b> 个官方精选地点</span>
        {guide.routeCount > 0 && <span><Route size={13} aria-hidden="true" /><b>{guide.routeCount}</b> 条专题路线</span>}
      </div>
      <label className="cj-official-switch" htmlFor="cj-official-join">
        <span>
          <b>创建时自动加入官方探索</b>
          <small id="cj-official-desc">这 {guide.placeCount} 个地点会加入这段旅行，可以在地图里逐个打卡、累计探索度。</small>
        </span>
        <button
          id="cj-official-join"
          type="button"
          role="switch"
          aria-checked={join}
          aria-describedby="cj-official-desc"
          className={`cj-switch${join ? ' is-on' : ''}`}
          onClick={() => onJoin(!join)}
        >
          <span aria-hidden="true" />
        </button>
      </label>
    </section>
  )
}

/** onStep 传增量，由调用方基于最新值计算，连续快速点击也不会丢失 */
export function TravelerStepper({ value, onStep, error }: { value: number; onStep: (delta: 1 | -1) => void; error?: string }) {
  return (
    <div className="cj-stepper-wrap">
      <div className="cj-stepper" role="group" aria-labelledby="cj-travelers-label">
        <button type="button" onClick={() => onStep(-1)} disabled={value <= TRAVELERS_MIN} aria-label="减少一位同行">
          <Minus size={16} />
        </button>
        <output aria-live="polite" aria-label={`同行 ${value} 人`}><b>{value}</b> 人</output>
        <button type="button" onClick={() => onStep(1)} disabled={value >= TRAVELERS_MAX} aria-label="增加一位同行">
          <Plus size={16} />
        </button>
      </div>
      <small>{value === 1 ? '一个人的旅行' : `包括你在内共 ${value} 人`}</small>
      {error && <p className="cj-error" role="alert">⚠ {error}</p>}
    </div>
  )
}

/** 每段旅行创建后本来就具备的能力：只做说明，不做假开关 */
export function SetupItems({ official }: { official: OfficialGuide | null }) {
  const items = [
    { icon: CalendarDays, title: '旅行时间轴', text: '打卡和照片会按当地日期自动整理成每一天。' },
    { icon: MapIcon, title: '地图与打卡', text: '在地图上记录去过的地方，也可以先排好行程。' },
    { icon: Camera, title: '照片空间', text: '上传的照片可以设为精选，用于分享成果与 Travel Story。' }
  ]
  return (
    <ul className="cj-setup">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title}><span className="cj-setup-icon"><Icon size={17} aria-hidden="true" /></span><span><b>{title}</b><small>{text}</small></span><CheckCircle2 size={16} className="cj-setup-ok" aria-label="自动准备" /></li>
      ))}
      {official && (
        <li className="is-official"><span className="cj-setup-icon"><Sparkles size={17} aria-hidden="true" /></span><span><b>{official.name}官方探索</b><small>{official.placeCount} 个官方地点会加入旅行。</small></span><CheckCircle2 size={16} className="cj-setup-ok" aria-label="将加入" /></li>
      )}
    </ul>
  )
}

export function CreateSummary({ title, destination, startDate, endDate, travelers, joinOfficial }: {
  title: string; destination: PickedDestination | null; startDate: string; endDate: string; travelers: number; joinOfficial: boolean
}) {
  const d = calculateTripDuration(startDate, endDate)
  const rows: [string, string][] = [
    ['旅行名称', title.trim() || '—'],
    ['目的地', destination ? [destination.name, destination.countryName].filter(Boolean).join(' · ') : '—'],
    ['日期', formatTripDateRange(startDate, endDate) || '—'],
    ['时长', d.ok ? d.label : '—'],
    ['同行', `${travelers} 人`]
  ]
  if (destination?.official) rows.push(['官方探索', joinOfficial ? `加入 · ${destination.official.placeCount} 个地点` : '不加入'])
  return (
    <dl className="cj-summary">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  )
}

/** 创建成功：只列出真实已经完成的事（官方地点数量来自创建后查询） */
export function JourneySuccess({ trip, officialAdded, onGo }: { trip: TripView; officialAdded: number | null; onGo: () => void }) {
  return (
    <div className="cj-success-backdrop">
      <div className="cj-success" role="dialog" aria-modal="true" aria-labelledby="cj-success-title">
        <CheckCircle2 size={40} className="cj-success-icon" aria-hidden="true" />
        <h2 id="cj-success-title">旅行创建完成</h2>
        <p>{trip.title} · {trip.destinationName}</p>
        <ul>
          <li><CheckCircle2 size={15} aria-hidden="true" />时间轴已就绪</li>
          <li><CheckCircle2 size={15} aria-hidden="true" />地图与打卡已就绪</li>
          {officialAdded !== null && officialAdded > 0 && <li><CheckCircle2 size={15} aria-hidden="true" />已加入官方探索 · {officialAdded} 个地点</li>}
        </ul>
        <button type="button" className="cj-cta" onClick={onGo} autoFocus>开始规划旅行 <ArrowRight size={16} /></button>
        <Link href="/trips" className="cj-success-link">返回我的旅行</Link>
      </div>
    </div>
  )
}
