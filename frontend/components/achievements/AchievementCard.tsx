'use client'

/**
 * 成就卡：徽章 · 类别 · 名称 · 条件 · 进度或解锁信息 · 行动。
 * 已解锁：暖米色底，显示解锁日期与来源旅行，不再显示 100% 进度条；
 * 进行中：白底，current / target + 「还差 X」；未开始：暖灰底 + 线稿徽章 + 对应行动入口。
 * 整张卡可点击 / 键盘回车打开详情。
 */

import Link from 'next/link'
import type { KeyboardEvent, MouseEvent } from 'react'
import { ArrowRight, CheckCircle2, CircleDashed, Hourglass } from 'lucide-react'
import type { AchievementView } from '@/services/tabitrace-api'
import { STATUS_LABEL, achievementAction, categoryOf, dotDate, formatAchievementProgress, getAchievementStatus } from '@/utils/achievements'
import { AchievementBadge } from './AchievementBadge'

const STATUS_ICON = { unlocked: CheckCircle2, inProgress: Hourglass, notStarted: CircleDashed }

export function ProgressBar({ achievement }: { achievement: AchievementView }) {
  const p = formatAchievementProgress(achievement)
  return (
    <div className="ac-progress">
      <div className="ac-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.target} aria-valuenow={p.current} aria-label={`${achievement.name} 进度`}>
        <i style={{ width: `${Math.round(p.ratio * 100)}%` }} />
      </div>
      <p><b>{p.current} / {p.target}</b><span>{p.text}</span></p>
    </div>
  )
}

export function ActionLink({ achievement, tripId, onCheckin, primary }: { achievement: AchievementView; tripId: number; onCheckin: () => void; primary?: boolean }) {
  const act = achievementAction(achievement, tripId)
  const cls = `ac-action${primary ? ' is-primary' : ''}`
  const stop = (e: MouseEvent) => e.stopPropagation()
  if (act.checkin) return <button type="button" className={cls} onClick={e => { stop(e); onCheckin() }}>{act.label} <ArrowRight size={13} /></button>
  return <Link href={act.href!} className={cls} onClick={stop}>{act.label} <ArrowRight size={13} /></Link>
}

export function AchievementCard({ achievement: a, tripId, tripTitle, onOpen, onCheckin }: {
  achievement: AchievementView
  tripId: number
  tripTitle: string
  onOpen: (a: AchievementView) => void
  onCheckin: () => void
}) {
  const status = getAchievementStatus(a)
  const StatusIcon = STATUS_ICON[status]
  const open = () => onOpen(a)
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }

  return (
    <article className={`ac-card is-${status}`} role="button" tabIndex={0} onClick={open} onKeyDown={onKey} aria-label={`${a.name}，${STATUS_LABEL[status]}，查看详情`}>
      <div className="ac-card-top">
        <AchievementBadge achievement={a} size={64} />
        <span className={`ac-status is-${status}`}><StatusIcon size={12} /> {STATUS_LABEL[status]}</span>
      </div>
      <p className="ac-cat">{a.type === 'CITY' ? `${a.cityCode} · ` : ''}{categoryOf(a).label}</p>
      <h3>{a.name}</h3>
      <p className="ac-cond">{a.description}</p>
      <div className="ac-card-foot">
        {status === 'unlocked' ? (
          <p className="ac-unlocked-meta">
            {a.earnedAt ? <b>{dotDate(a.earnedAt)} 解锁</b> : <b>已解锁</b>}
            <span>{tripTitle}</span>
          </p>
        ) : status === 'inProgress' ? (
          <>
            <ProgressBar achievement={a} />
            <ActionLink achievement={a} tripId={tripId} onCheckin={onCheckin} />
          </>
        ) : (
          <>
            <p className="ac-hint">{formatAchievementProgress(a).text}</p>
            <ActionLink achievement={a} tripId={tripId} onCheckin={onCheckin} />
          </>
        )}
      </div>
    </article>
  )
}
