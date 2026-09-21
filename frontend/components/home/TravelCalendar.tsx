'use client'

/** 旅行日历：真实读取旅行日期、行程与打卡；可切换月份、点击日期查看当天安排。 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from "lucide-react"
import type { CheckinView, ItineraryView, TripView } from '@/services/tabitrace-api'
import { dateKeyOf, hhmm, localDateKey, pad, timeOfDay } from '@/lib/time'

type DayInfo = { inTrip: boolean; itinerary: ItineraryView[]; checkins: CheckinView[] }

export function TravelCalendar({ trip, itinerary, checkins }: { trip: TripView | null; itinerary: ItineraryView[]; checkins: CheckinView[] }) {
  const today = localDateKey(new Date())
  const base = trip?.startDate ? new Date(`${trip.startDate}T00:00:00`) : new Date()
  const [cursor, setCursor] = useState({ year: base.getFullYear(), month: base.getMonth() })
  const [selected, setSelected] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const byDay = useMemo(() => {
    const map = new Map<string, DayInfo>()
    const ensure = (key: string) => {
      if (!map.has(key)) map.set(key, { inTrip: false, itinerary: [], checkins: [] })
      return map.get(key)!
    }
    if (trip) {
      const start = new Date(`${trip.startDate}T00:00:00`)
      const end = new Date(`${trip.endDate}T00:00:00`)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) ensure(localDateKey(d)).inTrip = true
    }
    itinerary.forEach(i => ensure(i.plannedDate).itinerary.push(i))
    checkins.forEach(c => { const k = dateKeyOf(c.checkinTime); if (k) ensure(k).checkins.push(c) })
    return map
  }, [trip?.startDate, trip?.endDate, itinerary, checkins])

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1).getDay()
    const count = new Date(cursor.year, cursor.month + 1, 0).getDate()
    return [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)]
  }, [cursor])

  const keyOf = (day: number) => `${cursor.year}-${pad(cursor.month + 1)}-${pad(day)}`
  const move = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
    setSelected(null)
  }

  const selectedInfo = selected ? byDay.get(selected) : null
  const weekRow = useMemo(() => {
    const now = new Date()
    const start = new Date(now); start.setDate(now.getDate() - now.getDay())
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [])

  return (
    <section className="side-panel calendar-panel">
      <div className="panel-head">
        <h3><CalendarDays size={16} className="text-warm" /> 旅行日历</h3>
        <Link href={trip ? `/trips/${trip.id}/map` : '/trips'} className="panel-link">查看行程 <ArrowRight size={12} /></Link>
      </div>

      <div className="calendar-month">
        <b>{cursor.year} 年 {cursor.month + 1} 月</b>
        <span className="calendar-month-nav">
          <button onClick={() => move(-1)} aria-label="上个月"><ChevronLeft size={15} /></button>
          <button onClick={() => move(1)} aria-label="下个月"><ChevronRight size={15} /></button>
        </span>
      </div>

      <div className={`mini-calendar-grid${expanded ? ' is-expanded' : ''}`}>
        {['日', '一', '二', '三', '四', '五', '六'].map(d => <span key={d} className="calendar-weekday">{d}</span>)}
        {cells.map((day, i) => {
          if (day === null) return <span key={`b-${i}`} />
          const key = keyOf(day)
          const info = byDay.get(key)
          const classes = [
            info?.inTrip ? 'trip-day' : '',
            key === today ? 'today' : '',
            selected === key ? 'selected' : '',
            info?.checkins.length ? 'has-checkin' : '',
            info?.itinerary.length ? 'has-plan' : ''
          ].filter(Boolean).join(' ')
          return (
            <button key={key} className={`calendar-cell ${classes}`} onClick={() => setSelected(selected === key ? null : key)} aria-label={`${key}${info?.itinerary.length ? '，有行程' : ''}${info?.checkins.length ? '，已打卡' : ''}`}>
              {day}
              {(info?.itinerary.length || info?.checkins.length) ? (
                <i className="calendar-marks">
                  {info?.itinerary.length ? <em className="plan" /> : null}
                  {info?.checkins.length ? <em className="checkin" /> : null}
                </i>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="calendar-legend">
        <span><i className="plan" />有行程</span>
        <span><i className="checkin" />已打卡</span>
        <span><i className="today" />今天</span>
      </div>

      <button className="calendar-toggle" onClick={() => setExpanded(v => !v)}>{expanded ? '收起整月' : '展开整月'}</button>

      {selected && (
        <div className="calendar-detail">
          <div className="calendar-detail-head">
            <b>{selected}</b>
            <button onClick={() => setSelected(null)} aria-label="关闭当日详情"><X size={14} /></button>
          </div>
          {!selectedInfo || (!selectedInfo.itinerary.length && !selectedInfo.checkins.length) ? (
            <p className="calendar-detail-empty">这一天还没有行程或打卡记录。</p>
          ) : (
            <ul>
              {selectedInfo.itinerary.map(i => (
                <li key={`i-${i.id}`}><span className="dot plan" /><b>{i.placeName}</b><time>{hhmm(i.plannedTime) || '未设时间'}</time></li>
              ))}
              {selectedInfo.checkins.map(c => (
                <li key={`c-${c.id}`}><span className="dot checkin" /><b>{c.placeName}</b><time>{timeOfDay(c.checkinTime)}</time></li>
              ))}
            </ul>
          )}
          {trip && <Link href={`/trips/${trip.id}/map`} className="panel-link mt-2 inline-flex">去地图与时间轴 <ArrowRight size={12} /></Link>}
        </div>
      )}

      {!selected && (
        <div className="calendar-week">
          {weekRow.map(d => {
            const key = localDateKey(d)
            const info = byDay.get(key)
            return (
              <button key={key} onClick={() => { setCursor({ year: d.getFullYear(), month: d.getMonth() }); setSelected(key) }} className={key === today ? 'is-today' : ''}>
                <small>{['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}</small>
                <b>{d.getDate()}</b>
                {info?.checkins.length ? <i className="checkin" /> : info?.itinerary.length ? <i className="plan" /> : <i className="none" />}
              </button>
            )
          })}
        </div>
      )}

      {!trip && (
        <p className="calendar-detail-empty mt-3">创建旅行后，行程与打卡会自动标记在这里。</p>
      )}
      {trip && (
        <p className="calendar-foot"><Clock3 size={12} /> 当前旅行：{trip.startDate} — {trip.endDate}</p>
      )}
    </section>
  )
}
