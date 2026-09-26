/** 按时间回看：年份 → 月份 → 旅行（小封面、标题、地点、日期），点击进入这段旅行的回顾。 */

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { TimelineEntry } from '@/services/memories'
import { dateRange, groupTimeline } from '@/utils/memories'
import { MemoryCover } from './MemoryCover'

export function MemoryTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (!entries.length) return null
  const years = groupTimeline(entries)
  return (
    <section className="mm-section mm-timeline-wrap" id="mm-timeline">
      <header className="mm-section-head">
        <div>
          <p className="mm-eyebrow">TIMELINE</p>
          <h2>按时间回看</h2>
          <p>{years.length > 1 ? `${years[years.length - 1].year} — ${years[0].year}，` : ''}共 {entries.length} 段旅行。</p>
        </div>
      </header>
      <div className="mm-card mm-timeline">
        {years.map(y => (
          <div key={y.year} className="mm-year">
            <b className="mm-year-label">{y.year}</b>
            <div className="mm-year-body">
              {y.months.map(m => (
                <div key={m.month} className="mm-month">
                  <span className="mm-month-label">{m.month}</span>
                  <ul>
                    {m.trips.map(t => (
                      <li key={t.id}>
                        <Link href={`/trips/${t.id}/summary`}>
                          <MemoryCover src={t.cover} city={t.city} title={t.title} className="is-thumb" />
                          <span className="mm-tl-text">
                            <b>{t.title}</b>
                            <small>{t.city} · {dateRange(t.startDate, t.endDate)}</small>
                          </span>
                          <ChevronRight size={16} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
