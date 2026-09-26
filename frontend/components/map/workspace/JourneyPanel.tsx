'use client'

/**
 * 旅程面板：当天进度 → 下一站 → 当天行程（计划）。
 * 与地图共用 selectedKey：点列表项让地图飞过去，点 Marker 时列表滚动并高亮对应项。
 */

import { useEffect, useRef } from 'react'
import { Camera, Check, Clock3, MapPin, Navigation, Plus, Trash2 } from 'lucide-react'
import { dayLabel, dayTitle, navigationUrl, type DayKey, type JourneyStop } from '@/utils/travel-map'

export function DaySelector({ days, value, onChange }: { days: string[]; value: DayKey; onChange: (d: DayKey) => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const box = ref.current, el = box?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (box && el && (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollLeft = el.offsetLeft - 12
  }, [value])
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const all: DayKey[] = ['ALL', ...days]
    const next = all[(all.indexOf(value) + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length]
    onChange(next)
    window.setTimeout(() => ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus(), 0)
  }
  return (
    <div className="tm-days" role="tablist" aria-label="按日期查看" ref={ref} onKeyDown={onKey}>
      <button type="button" role="tab" aria-selected={value === 'ALL'} tabIndex={value === 'ALL' ? 0 : -1} className={value === 'ALL' ? 'is-active' : ''} onClick={() => onChange('ALL')}>
        <b>全部</b><small>{days.length} 天</small>
      </button>
      {days.map(d => (
        <button key={d} type="button" role="tab" aria-selected={value === d} tabIndex={value === d ? 0 : -1} className={value === d ? 'is-active' : ''} onClick={() => onChange(d)}>
          <b>{dayLabel(days, d)}</b><small>{d.slice(5).replace('-', '.')}</small>
        </button>
      ))}
    </div>
  )
}

function statusText(s: JourneyStop) {
  if (s.status === 'done') return s.actualTime ? `${s.actualTime} 已打卡` : '已完成'
  return '计划中'
}

export function JourneyPanel({ days, day, stops, next, distance, selectedKey, readOnly, onSelect, onCheckin, onAdd, onRemove, onShowRecord }: {
  days: string[]
  day: DayKey
  stops: JourneyStop[]
  next: { stop: JourneyStop; overdue: boolean } | null
  distance: (s: JourneyStop) => string | null
  selectedKey: string | null
  readOnly: boolean
  onSelect: (key: string) => void
  onCheckin: (s: JourneyStop) => void
  onAdd: () => void
  onRemove: (s: JourneyStop) => void
  onShowRecord: (s: JourneyStop) => void
}) {
  const list = useRef<HTMLDivElement | null>(null)
  const plan = stops.filter(s => s.itineraryId)
  const done = plan.filter(s => s.status === 'done').length
  const extra = stops.length - plan.length
  const percent = plan.length ? Math.round((done / plan.length) * 100) : 0

  // Marker 被点中时，列表滚动到对应项
  useEffect(() => {
    if (!selectedKey) return
    list.current?.querySelector<HTMLElement>(`[data-key="${selectedKey}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedKey])

  const groups = day === 'ALL'
    ? days.map(d => [d, plan.filter(s => s.date === d)] as const).filter(([, l]) => l.length)
    : [[day, plan] as const]

  return (
    <section className="tm-panel" aria-label="旅程面板">
      <header className="tm-panel-head">
        <div>
          <p className="tm-eyebrow">{day === 'ALL' ? 'ALL DAYS' : dayLabel(days, day)}</p>
          <h2>{day === 'ALL' ? '全部行程' : dayTitle(day)}</h2>
        </div>
        {!readOnly && <button type="button" className="tm-btn is-primary tm-add-desktop" onClick={onAdd}><Plus size={15} /> 添加地点</button>}
      </header>

      <div className="tm-progress-box">
        <div className="tm-progress-nums">
          <span><b>{plan.length}</b> 个计划地点</span>
          <span><b>{done}</b> 已完成</span>
          {extra > 0 && <span><b>{extra}</b> 次随手打卡</span>}
        </div>
        <div className="tm-progress" role="progressbar" aria-label="行程完成度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
      </div>

      {next && (
        <div className={`tm-next${next.overdue ? ' is-overdue' : ''}`}>
          <p className="tm-eyebrow">NEXT STOP</p>
          <b>{next.stop.name}</b>
          <small>
            {day === 'ALL' || next.stop.date !== day ? `${dayLabel(days, next.stop.date)} · ` : ''}
            {next.stop.plannedTime ? `计划 ${next.stop.plannedTime}` : '未设时间'}
            {next.overdue ? ' · 已过计划时间' : ''}
            {distance(next.stop) ? ` · 距你 ${distance(next.stop)}` : ''}
          </small>
          <div className="tm-next-actions">
            {next.stop.lat !== undefined && <button type="button" className="tm-btn" onClick={() => onSelect(next.stop.selectKey)}><MapPin size={14} /> 查看地图</button>}
            {!readOnly && <button type="button" className="tm-btn is-primary" onClick={() => onCheckin(next.stop)}><Check size={14} /> 到达打卡</button>}
          </div>
        </div>
      )}

      <div className="tm-list" ref={list}>
        <h3>{day === 'ALL' ? '行程安排' : '当天行程'}</h3>
        {plan.length === 0 ? (
          <div className="tm-empty">
            <p>{day === 'ALL' ? '这段旅行还没有安排地点' : '今天还没有安排地点'}</p>
            {extra > 0 && <small>{day === 'ALL' ? '另有' : '这一天有'} {extra} 次打卡记录，见下方时间轴。</small>}
            {!readOnly && <button type="button" className="tm-btn is-primary" onClick={onAdd}><Plus size={14} /> 添加第一个地点</button>}
          </div>
        ) : groups.map(([d, items]) => (
          <div key={d} className="tm-list-group">
            {day === 'ALL' && <p className="tm-list-day">{dayLabel(days, d)} · {dayTitle(d)}</p>}
            <ul>
              {items.map(s => {
                const nav = navigationUrl(s)
                return (
                  <li key={s.key} data-key={s.selectKey} className={`${s.status === 'done' ? 'is-done' : ''}${selectedKey === s.selectKey ? ' is-selected' : ''}`}>
                    <button type="button" className="tm-item-main" onClick={() => onSelect(s.selectKey)} aria-pressed={selectedKey === s.selectKey}>
                      <span className="tm-item-time"><Clock3 size={12} aria-hidden="true" />{s.plannedTime ?? '--:--'}</span>
                      <span className="tm-item-text">
                        <b>{s.name}</b>
                        <small>{[s.area, statusText(s)].filter(Boolean).join(' · ')}{s.photos.length ? ` · ${s.photos.length} 张照片` : ''}</small>
                      </span>
                      {s.photos[0] && <img className="tm-item-thumb" src={s.photos[0].imageUrl} alt="" loading="lazy" width={40} height={40} />}
                      {!s.photos[0] && s.status === 'done' && <span className="tm-item-thumb is-empty"><Camera size={14} aria-hidden="true" /></span>}
                    </button>
                    <div className="tm-item-actions">
                      {nav && <a className="tm-link" href={nav} target="_blank" rel="noopener noreferrer" aria-label={`导航到 ${s.name}`}><Navigation size={13} /> 导航</a>}
                      {s.status === 'planned' && !readOnly && <button type="button" className="tm-link is-strong" onClick={() => onCheckin(s)}><Check size={13} /> 打卡</button>}
                      {s.status === 'done' && <button type="button" className="tm-link" onClick={() => onShowRecord(s)}>查看记录</button>}
                      {s.status === 'planned' && !readOnly && <button type="button" className="tm-icon" onClick={() => onRemove(s)} aria-label={`从行程移除 ${s.name}`}><Trash2 size={13} /></button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
