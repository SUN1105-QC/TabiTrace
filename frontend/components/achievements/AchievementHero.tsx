'use client'

/**
 * 首屏：左侧是这段旅行的成就总览（已解锁 / 总数、完成度、城市成就），右侧用大徽章展示最近解锁的一枚；
 * 还没有解锁时展示最接近完成的一枚。项目没有等级、称号、积分，所以不显示这些。
 */

import type { AchievementView } from '@/services/tabitrace-api'
import { dotDate, formatAchievementProgress } from '@/utils/achievements'
import { AchievementBadge } from './AchievementBadge'

export function AchievementHero({ tripTitle, total, unlocked, cityTotal, cityUnlocked, spotlight, onOpen }: {
  tripTitle: string
  total: number
  unlocked: number
  cityTotal: number
  cityUnlocked: number
  spotlight: AchievementView | null
  onOpen: (a: AchievementView) => void
}) {
  const rate = total ? Math.round((unlocked / total) * 100) : 0
  const spotlightProgress = spotlight ? formatAchievementProgress(spotlight) : null
  return (
    <section className="ac-hero">
      <div className="ac-hero-text">
        <p className="ac-eyebrow">ACHIEVEMENTS · {tripTitle}</p>
        <h1>旅行成就</h1>
        <p className="ac-hero-lead">记录每一次抵达，<br />也记录自己一步步走远的过程。</p>
        <div className="ac-hero-stats">
          <div>
            <b>{unlocked}<small> / {total}</small></b>
            <span>已解锁成就</span>
          </div>
          <div>
            <b>{rate}<small>%</small></b>
            <span>总体完成度</span>
          </div>
          {cityTotal > 0 && (
            <div>
              <b>{cityUnlocked}<small> / {cityTotal}</small></b>
              <span>城市成就</span>
            </div>
          )}
        </div>
        <div className="ac-hero-bar" role="progressbar" aria-label="总体完成度" aria-valuemin={0} aria-valuemax={total} aria-valuenow={unlocked}>
          <i style={{ width: `${rate}%` }} />
        </div>
      </div>

      {spotlight && (
        <button type="button" className={`ac-spotlight${spotlight.earned ? ' is-unlocked' : ''}`} onClick={() => onOpen(spotlight)} aria-label={`查看成就：${spotlight.name}`}>
          <p className="ac-eyebrow">{spotlight.earned ? 'LATEST BADGE' : 'NEXT BADGE'}</p>
          <AchievementBadge achievement={spotlight} size={148} />
          <b>{spotlight.name}</b>
          <span>{spotlight.description}</span>
          <em>{spotlight.earned ? (spotlight.earnedAt ? `${dotDate(spotlight.earnedAt)} 解锁` : '已解锁') : `${spotlightProgress!.current} / ${spotlightProgress!.target} · ${spotlightProgress!.text}`}</em>
        </button>
      )}
    </section>
  )
}
