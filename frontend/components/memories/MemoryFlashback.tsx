'use client'

/** 往年今日：往年同一天（±3 天）→ 往年同月 → 往年同季节；都没有时后端返回空，整个模块不出现。 */

import Link from 'next/link'
import { ArrowRight, Images } from 'lucide-react'
import type { Flashback } from '@/services/memories'
import { dateRange, flashbackHeadline, flashbackKicker } from '@/utils/memories'
import { MemoryCover } from './MemoryCover'

export function MemoryFlashback({ flashback: f }: { flashback: Flashback }) {
  const shots = f.moments.filter(m => m.imageUrl !== f.cover).slice(0, 3)
  return (
    <section className="mm-card mm-flashback" id="mm-flashback">
      <div className="mm-flashback-media">
        <MemoryCover src={f.cover ?? f.moments[0]?.imageUrl} city={f.city} title={f.title} className="is-main" />
        {shots.length > 0 && (
          <div className="mm-flashback-shots">
            {shots.map(m => <img key={m.id} src={m.imageUrl} alt="" loading="lazy" />)}
          </div>
        )}
      </div>
      <div className="mm-flashback-body">
        <p className="mm-eyebrow">{flashbackKicker(f)}</p>
        <h2>{flashbackHeadline(f)}</h2>
        <p className="mm-flashback-trip">{f.title}</p>
        <p className="mm-date">{dateRange(f.startDate, f.endDate)}{f.photos ? ` · ${f.photos} 张照片` : ''}</p>
        <div className="mm-flashback-actions">
          <Link href={`/trips/${f.tripId}/summary`} className="mm-btn is-primary">查看回忆 <ArrowRight size={14} /></Link>
          {f.photos > 0 && <Link href={`/trips/${f.tripId}/gallery`} className="mm-btn"><Images size={14} /> 重温照片</Link>}
        </div>
      </div>
    </section>
  )
}
