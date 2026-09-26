'use client'

/**
 * 成就详情：复用项目现有的 modal-backdrop / modal-panel 弹窗样式。
 * 条件涉及具体地点时逐项列出（已打卡 / 未打卡），其余只显示真实的计数进度，不虚构子条件。
 */

import { useEffect, useRef } from 'react'
import { CheckCircle2, Circle, X } from 'lucide-react'
import type { AchievementView } from '@/services/tabitrace-api'
import { STATUS_LABEL, categoryOf, dotDate, getAchievementStatus } from '@/utils/achievements'
import { AchievementBadge } from './AchievementBadge'
import { ActionLink, ProgressBar } from './AchievementCard'

export function AchievementDetail({ achievement: a, tripId, tripTitle, onClose, onCheckin }: {
  achievement: AchievementView
  tripId: number
  tripTitle: string
  onClose: () => void
  onCheckin: () => void
}) {
  const status = getAchievementStatus(a)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel ac-detail" role="dialog" aria-modal="true" aria-label={`成就详情：${a.name}`}>
        <div className="modal-head">
          <div>
            <p className="ac-eyebrow">{a.type === 'CITY' ? `CITY · ${a.cityCode}` : 'GLOBAL'} · {categoryOf(a).label}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭成就详情" className="ac-close"><X size={16} /></button>
        </div>
        <div className="ac-detail-body">
          <div className={`ac-detail-hero is-${status}`}>
            <AchievementBadge achievement={a} size={112} label />
            <h2>{a.name}</h2>
            <span className={`ac-status is-${status}`}>{STATUS_LABEL[status]}</span>
          </div>
          <dl className="ac-detail-list">
            <div><dt>达成条件</dt><dd>{a.description}</dd></div>
            <div><dt>当前进度</dt><dd>{status === 'unlocked' ? '已达成' : <ProgressBar achievement={a} />}</dd></div>
            {a.requirements && a.requirements.length > 0 && (
              <div>
                <dt>地点</dt>
                <dd>
                  <ul className="ac-reqs">
                    {a.requirements.map(r => (
                      <li key={r.name} className={r.done ? 'is-done' : ''}>
                        {r.done ? <CheckCircle2 size={14} aria-hidden /> : <Circle size={14} aria-hidden />}
                        {r.name}<span className="sr-only">{r.done ? '（已打卡）' : '（未打卡）'}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {status === 'unlocked' && <div><dt>解锁时间</dt><dd>{a.earnedAt ? dotDate(a.earnedAt) : '—'}</dd></div>}
            <div><dt>相关旅行</dt><dd>{tripTitle}</dd></div>
          </dl>
          {status !== 'unlocked' && (
            <div className="ac-detail-cta"><ActionLink achievement={a} tripId={tripId} onCheckin={() => { onClose(); onCheckin() }} primary /></div>
          )}
        </div>
      </div>
    </div>
  )
}
