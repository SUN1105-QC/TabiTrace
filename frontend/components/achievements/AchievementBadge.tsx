/**
 * 统一的旅行徽章：圆形底座 + 外圈刻度 + 类别图标，城市成就带城市缎带。
 * 已解锁：暖金底座；进行中：暖灰底座 + 橙色进度弧；未开始：暖灰线稿。
 * 不为每个成就单独画图，只按类别换中心图标。
 */

import { Camera, CheckCircle2, Compass, Flag, Landmark, MapPinned, MoonStar, Trophy } from 'lucide-react'
import type { AchievementView } from '@/services/tabitrace-api'
import { categoryOf, formatAchievementProgress, getAchievementStatus } from '@/utils/achievements'

const ICON = { RECORD: CheckCircle2, PHOTO: Camera, EXPLORE: Compass, CULTURE: Landmark, NIGHT: MoonStar, JOURNEY: Flag, OTHER: Trophy } as const

export function AchievementBadge({ achievement: a, size = 72, label }: { achievement: AchievementView; size?: number; label?: boolean }) {
  const status = getAchievementStatus(a)
  const { ratio } = formatAchievementProgress(a)
  const Icon = a.type === 'CITY' && categoryOf(a).key === 'EXPLORE' ? MapPinned : ICON[categoryOf(a).key as keyof typeof ICON] ?? Trophy
  const r = 44, c = 2 * Math.PI * r
  const ariaLabel = label ? `${a.name}徽章，${status === 'unlocked' ? '已解锁' : status === 'inProgress' ? `进行中，完成 ${Math.round(ratio * 100)}%` : '未开始'}` : undefined

  return (
    <span className={`ac-badge is-${status}`} style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={ariaLabel} aria-hidden={label ? undefined : true}>
      <svg className="ac-badge-ring" viewBox="0 0 100 100" width={size} height={size}>
        {/* 外圈刻度 */}
        <circle cx="50" cy="50" r="47" className="ac-badge-rim" />
        <circle cx="50" cy="50" r={r} className="ac-badge-track" />
        {status === 'inProgress' && (
          <circle cx="50" cy="50" r={r} className="ac-badge-arc" strokeDasharray={`${c * ratio} ${c}`} transform="rotate(-90 50 50)" />
        )}
        <circle cx="50" cy="50" r="36" className="ac-badge-face" />
      </svg>
      <Icon className="ac-badge-icon" size={Math.round(size * 0.34)} strokeWidth={1.6} />
      {a.type === 'CITY' && a.cityCode && <em className="ac-badge-ribbon">{a.cityCode}</em>}
    </span>
  )
}
