'use client'

/** 筛选：范围（全球 / 城市）+ 类别（只显示数据里真实出现的）+ 状态。 */

import type { AchievementStatus } from '@/utils/achievements'

export type ScopeFilter = { key: string; label: string; count: number }

export function AchievementFilters({ scopes, scope, status, statusCounts, onScope, onStatus }: {
  scopes: ScopeFilter[]
  scope: string
  status: AchievementStatus | 'ALL'
  statusCounts: Record<AchievementStatus | 'ALL', number>
  onScope: (key: string) => void
  onStatus: (s: AchievementStatus | 'ALL') => void
}) {
  const statuses: [AchievementStatus | 'ALL', string][] = [['ALL', '全部'], ['unlocked', '已解锁'], ['inProgress', '进行中'], ['notStarted', '未开始']]
  return (
    <div className="ac-filters">
      <div className="ac-chips" role="tablist" aria-label="成就分类">
        {scopes.map(s => (
          <button key={s.key} type="button" role="tab" aria-selected={scope === s.key} className={scope === s.key ? 'is-active' : ''} onClick={() => onScope(s.key)}>
            {s.label}<small>{s.count}</small>
          </button>
        ))}
      </div>
      <div className="ac-seg" role="radiogroup" aria-label="成就状态">
        {statuses.map(([key, label]) => (
          <button key={key} type="button" role="radio" aria-checked={status === key} className={status === key ? 'is-active' : ''} onClick={() => onStatus(key)}>
            {label} {statusCounts[key]}
          </button>
        ))}
      </div>
    </div>
  )
}
