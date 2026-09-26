'use client'

/**
 * 统一旅行时间轴：同一条时间线里既有计划，也有打卡记录，按实际 / 计划时间排序。
 * 只有在出现过打卡时才渲染（只有计划时，面板里已经能看到）。按日期筛选后按天分组，每次最多展示 30 条。
 */

import { useState } from 'react'
import { Undo2 } from 'lucide-react'
import { dayLabel, dayTitle, type JourneyStop } from '@/utils/travel-map'

const PAGE = 30

function timeLine(s: JourneyStop) {
  if (s.status === 'done' && s.plannedTime && s.actualTime) return <>原计划 {s.plannedTime}<i>·</i><b>{s.actualTime} 已打卡</b></>
  if (s.status === 'done') return <b>{s.actualTime ? `${s.actualTime} 打卡` : '已完成'}</b>
  return <>计划 {s.plannedTime ?? '未设时间'}</>
}

export function TravelTimeline({ days, stops, selectedKey, readOnly, onSelect, onUndo }: {
  days: string[]
  stops: JourneyStop[]
  selectedKey: string | null
  readOnly: boolean
  onSelect: (key: string) => void
  onUndo: (s: JourneyStop) => void
}) {
  const [limit, setLimit] = useState(PAGE)
  if (!stops.some(s => s.status === 'done')) return null
  const shown = stops.slice(0, limit)
  const groups = [...new Set(shown.map(s => s.date))].map(d => [d, shown.filter(s => s.date === d)] as const)

  return (
    <section className="tm-timeline" aria-labelledby="tm-timeline-title">
      <header>
        <p className="tm-eyebrow">TRAVEL TIMELINE</p>
        <h2 id="tm-timeline-title">旅行时间轴</h2>
      </header>
      {groups.map(([d, items]) => (
        <div key={d} className="tm-tl-day">
          <p className="tm-tl-date">{days.includes(d) ? `${dayLabel(days, d)} · ` : ''}{dayTitle(d)}</p>
          <ol>
            {items.map(s => (
              <li key={s.key} id={`tl-${s.key}`} className={`is-${s.status}${selectedKey === s.selectKey ? ' is-selected' : ''}`}>
                <span className="tm-tl-dot" aria-hidden="true" />
                <div className="tm-tl-body">
                  <p className="tm-tl-time">{timeLine(s)}</p>
                  <button type="button" className="tm-tl-name" onClick={() => onSelect(s.selectKey)}>{s.name}{s.area ? <small> · {s.area}</small> : null}</button>
                  {s.note && <p className="tm-tl-note">{s.note}</p>}
                  {s.photos.length > 0 && (
                    <div className="tm-tl-photos">
                      {s.photos.slice(0, 4).map(p => <img key={p.id} src={p.imageUrl} alt="" loading="lazy" width={72} height={72} />)}
                      {s.photos.length > 4 && <span>+{s.photos.length - 4}</span>}
                    </div>
                  )}
                  {s.checkinId && !readOnly && (
                    <button type="button" className="tm-link" onClick={() => onUndo(s)}><Undo2 size={12} /> 撤销打卡</button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {stops.length > limit && <button type="button" className="tm-btn tm-more" onClick={() => setLimit(l => l + PAGE)}>显示更多（还有 {stops.length - limit} 条）</button>}
    </section>
  )
}
