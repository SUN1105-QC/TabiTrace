'use client'

/** 概览数据条、下一项成就、最近解锁。都只是把真实数据换一种组织方式，没有数据时整块不出现。 */

import type { AchievementView } from '@/services/tabitrace-api'
import { categoryOf, dotDate } from '@/utils/achievements'
import { AchievementBadge } from './AchievementBadge'
import { ActionLink, ProgressBar } from './AchievementCard'

export function AchievementOverview({ counts }: { counts: { unlocked: number; inProgress: number; notStarted: number; city: number } }) {
  const items: [string, number][] = [['已解锁', counts.unlocked], ['进行中', counts.inProgress], ['未开始', counts.notStarted], ['城市成就', counts.city]]
  return (
    <section className="ac-overview" aria-label="成就概览">
      {items.map(([label, value]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}
    </section>
  )
}

export function NextAchievements({ items, tripId, onOpen, onCheckin }: { items: AchievementView[]; tripId: number; onOpen: (a: AchievementView) => void; onCheckin: () => void }) {
  if (!items.length) return null
  return (
    <section className="ac-section">
      <header className="ac-section-head">
        <div>
          <p className="ac-eyebrow">NEXT UP</p>
          <h2>下一项成就</h2>
          <p>按当前进度，这几枚最容易拿到。</p>
        </div>
      </header>
      <div className="ac-next">
        {items.map(a => (
          <article key={a.id} className="ac-next-card">
            <button type="button" className="ac-next-main" onClick={() => onOpen(a)} aria-label={`查看成就：${a.name}`}>
              <AchievementBadge achievement={a} size={56} />
              <span>
                <small>{categoryOf(a).label}</small>
                <b>{a.name}</b>
                <em>{a.description}</em>
              </span>
            </button>
            <ProgressBar achievement={a} />
            <ActionLink achievement={a} tripId={tripId} onCheckin={onCheckin} primary />
          </article>
        ))}
      </div>
    </section>
  )
}

export function RecentlyUnlocked({ items, tripTitle, onOpen }: { items: AchievementView[]; tripTitle: string; onOpen: (a: AchievementView) => void }) {
  if (!items.length) return null
  return (
    <section className="ac-section">
      <header className="ac-section-head">
        <div>
          <p className="ac-eyebrow">RECENTLY UNLOCKED</p>
          <h2>最近解锁</h2>
        </div>
      </header>
      <div className="ac-recent">
        {items.map(a => (
          <button key={a.id} type="button" className="ac-recent-item" onClick={() => onOpen(a)} aria-label={`查看成就：${a.name}`}>
            <AchievementBadge achievement={a} size={54} />
            <span>
              <b>{a.name}</b>
              <small>{categoryOf(a).label} · {a.earnedAt ? `${dotDate(a.earnedAt)} 解锁` : '已解锁'}</small>
              <small>{tripTitle}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
