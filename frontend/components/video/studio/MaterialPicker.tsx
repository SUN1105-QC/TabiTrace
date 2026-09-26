'use client'

/**
 * STEP 2 旅行素材：筛选（全部 / 精选 / 已选 / 按天）+ 大尺寸素材网格。
 * 点选顺序就是镜头顺序，选中的照片右上角显示橙色序号；有选中时未选照片轻微弱化。
 * 数量上限前端先拦一次（体验），后端再校验一次（规则）。
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ImagePlus, Sparkles, Star } from 'lucide-react'
import type { CheckinView, PhotoView } from '@/services/tabitrace-api'
import type { Plan } from '@/types/video'
import { photoTime } from '@/utils/video-autoselect'
import { VideoProGate } from '../VideoProGate'

const dayKey = (t: number) => {
  const d = new Date(t)
  return Number.isNaN(d.getTime()) || t === 0 ? '' : `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`
}

export function MaterialPicker({ tripId, photos, checkins, selected, max, plan, onChange, onSmartPick }: {
  tripId: number
  photos: PhotoView[]
  checkins: CheckinView[]
  selected: number[]
  max: number
  plan: Plan
  onChange: (ids: number[]) => void
  onSmartPick: () => void
}) {
  const [filter, setFilter] = useState('ALL')
  const [limitHit, setLimitHit] = useState(false)
  const checkinMap = useMemo(() => new Map(checkins.map(c => [c.id, c])), [checkins])
  const sorted = useMemo(() => [...photos].sort((a, b) => photoTime(a, checkinMap) - photoTime(b, checkinMap)), [photos, checkinMap])
  const days = useMemo(() => Array.from(new Set(sorted.map(p => dayKey(photoTime(p, checkinMap))).filter(Boolean))), [sorted, checkinMap])

  const shown = filter === 'FEATURED' ? sorted.filter(p => p.featured)
    : filter === 'SELECTED' ? selected.map(id => sorted.find(p => p.id === id)).filter((p): p is PhotoView => !!p)
    : filter === 'ALL' ? sorted
    : sorted.filter(p => dayKey(photoTime(p, checkinMap)) === filter)

  function toggle(id: number) {
    if (selected.includes(id)) { onChange(selected.filter(x => x !== id)); setLimitHit(false); return }
    if (selected.length >= max) { setLimitHit(true); return }
    onChange([...selected, id])
  }

  if (photos.length === 0) {
    return (
      <div className="vs-empty">
        <p>这趟旅行还没有照片</p>
        <small>先为这趟旅行添加几张照片，再生成属于你的旅行故事。</small>
        <Link href={`/trips/${tripId}/gallery`} className="vs-btn is-primary"><ImagePlus size={14} /> 上传照片</Link>
      </div>
    )
  }

  const tabs: [string, string][] = [
    ['ALL', `全部 ${photos.length}`],
    ['FEATURED', `精选 ${photos.filter(p => p.featured).length}`],
    ['SELECTED', `已选 ${selected.length}`],
    ...days.map(d => [d, d] as [string, string])
  ]

  return (
    <div className="vs-materials">
      <div className="vs-materials-bar">
        <p className="vs-count">已选择 <b className={selected.length >= max ? 'is-full' : ''}>{selected.length}</b> / {max}</p>
        <button type="button" className="vs-ai-btn" onClick={onSmartPick} title="精选照片优先，在不同打卡地点之间分散挑选，过滤连拍，并按时间排序">
          <Sparkles size={13} /> 智能选片
        </button>
      </div>

      <div className="vs-chips" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="vs-hint">{filter === 'FEATURED' ? '还没有精选照片，可以在「照片」页把喜欢的照片标为精选。' : '这里还没有照片。'}</p>
      ) : (
        <div className={`vs-grid${selected.length ? ' has-selection' : ''}`}>
          {shown.map(p => {
            const index = selected.indexOf(p.id)
            const place = p.checkinId ? checkinMap.get(p.checkinId)?.placeName : undefined
            return (
              <button key={p.id} type="button" className={`vs-tile${index >= 0 ? ' is-selected' : ''}`} aria-pressed={index >= 0}
                onClick={() => toggle(p.id)} aria-label={`${index >= 0 ? '取消选择' : '选择'}照片${place ? `：${place}` : ''}`}>
                <img src={p.imageUrl} alt="" loading="lazy" />
                {index >= 0 ? <span className="vs-tile-no">{index + 1}</span> : <span className="vs-tile-ring" />}
                {p.featured && <span className="vs-tile-star" title="精选"><Star size={10} /></span>}
                {place && <span className="vs-tile-place">{place}</span>}
              </button>
            )
          })}
        </div>
      )}

      {limitHit && (plan === 'FREE'
        ? <VideoProGate message={`Free 旅行最多选择 ${max} 张照片，升级 Trip Pro 可使用更多素材。`} />
        : <p className="vs-hint is-warn">一个视频最多选择 {max} 张照片。</p>)}
    </div>
  )
}
