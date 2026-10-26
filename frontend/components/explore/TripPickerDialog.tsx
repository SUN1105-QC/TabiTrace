'use client'

/**
 * 加入旅行时还不知道加到哪段旅行：
 * 未登录 → 引导登录；没有可写的旅行 → 引导创建；有多段旅行 → 选一段（之后记住，作为当前旅行）。
 */

import Link from 'next/link'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import type { TripView } from '@/services/tabitrace-api'

const STATUS: Record<string, string> = { PLANNING: '计划中', ONGOING: '进行中', COMPLETED: '已完成' }

export function TripPickerDialog({ signedIn, trips, placeName, current, onPick, onClose }: {
  signedIn: boolean
  trips: TripView[]
  /** 正在加入的地点；为空表示只是更换当前旅行 */
  placeName?: string
  current?: TripView | null
  onPick: (trip: TripView) => void
  onClose: () => void
}) {
  const [picked, setPicked] = useState<number | null>(current?.id ?? null)
  const next = encodeURIComponent('/explore/tokyo')

  if (!signedIn) {
    return (
      <ConfirmDialog title="登录后加入旅行" onCancel={onClose}
        body={<p>{placeName ? `登录后就可以把「${placeName}」加入你的旅行。` : '登录后就可以把地点加入你的旅行。'}</p>}
        actions={<><button type="button" className="st-btn" onClick={onClose}>取消</button><Link href={`/login?next=${next}`} className="st-btn is-primary">登录</Link></>} />
    )
  }
  if (!trips.length) {
    return (
      <ConfirmDialog title="还没有可以加入的旅行" onCancel={onClose}
        body={<p>先创建一段旅行，再把{placeName ? `「${placeName}」` : '喜欢的地点'}加进去。</p>}
        actions={<><button type="button" className="st-btn" onClick={onClose}>取消</button><Link href="/trips/new" className="st-btn is-primary">创建旅行</Link></>} />
    )
  }
  const choose = () => { const t = trips.find(x => x.id === picked); if (t) onPick(t) }
  return (
    <ConfirmDialog title={placeName ? `把「${placeName}」加入哪段旅行？` : '选择要加入地点的旅行'} onCancel={onClose}
      body={
        <div className="xp-trips" role="radiogroup" aria-label="选择旅行">
          {trips.map(t => (
            <button key={t.id} type="button" role="radio" aria-checked={picked === t.id} className={picked === t.id ? 'is-active' : ''} onClick={() => setPicked(t.id)}>
              <b>{t.title}</b>
              <small>{t.startDate} — {t.endDate}{STATUS[t.status] ? ` · ${STATUS[t.status]}` : ''}</small>
            </button>
          ))}
          <Link href="/trips/new" className="xp-link">+ 创建新的旅行</Link>
        </div>
      }
      actions={<><button type="button" className="st-btn" onClick={onClose}>取消</button><button type="button" className="st-btn is-primary" disabled={picked == null} onClick={choose}>{placeName ? '加入' : '确定'}</button></>} />
  )
}
