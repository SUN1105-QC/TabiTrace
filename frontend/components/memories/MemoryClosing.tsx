/** 底部收尾：左侧引导下一次出发，右侧展示最近获得的真实成就。 */

import Link from 'next/link'
import { ArrowRight, Plus, Trophy } from 'lucide-react'
import type { MemoryAchievement } from '@/services/memories'
import { dot } from '@/utils/memories'

export function MemoryClosing({ achievements, total, achievementsHref }: { achievements: MemoryAchievement[]; total: number; achievementsHref: string }) {
  return (
    <section className="mm-closing">
      <div className="mm-card mm-closing-card is-warm">
        <p className="mm-eyebrow">NEXT JOURNEY</p>
        <h3>旅行回忆与下一次出发</h3>
        <p>把去过的地方，慢慢变成能反复回看的故事。<br />每一次回看，也是下一次出发的开始。</p>
        <Link href="/trips/new" className="mm-btn is-primary"><Plus size={15} /> 继续记录新的旅行</Link>
      </div>
      <div className="mm-card mm-closing-card">
        <p className="mm-eyebrow"><Trophy size={12} /> MEMORY BADGES</p>
        <h3>回忆成就{total > 0 && <small>已获得 {total} 个</small>}</h3>
        {achievements.length > 0 ? (
          <ul className="mm-badges">
            {achievements.slice(0, 4).map(a => (
              <li key={a.code}>
                <span className="mm-badge-mark"><Trophy size={14} /></span>
                <span><b>{a.name}</b><small>{[a.tripTitle, dot(a.earnedAt)].filter(Boolean).join(' · ')}</small></span>
              </li>
            ))}
          </ul>
        ) : <p>完成打卡、记录照片后，获得的成就会出现在这里。</p>}
        <Link href={achievementsHref} className="mm-text-btn is-brand">查看全部成就 <ArrowRight size={13} /></Link>
      </div>
    </section>
  )
}
