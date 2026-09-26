'use client'

/**
 * 镜头顺序：轻量 storyboard，一格一个镜头，淡橙色细线相连。
 * 拖动卡片或用左右箭头调整顺序；星标设为封面；× 移出视频。不做多轨时间轴。
 */

import { useState } from 'react'
import { ArrowLeft, ArrowRight, GripHorizontal, Star, X } from 'lucide-react'
import type { CheckinView, PhotoView } from '@/services/tabitrace-api'
import { timecode } from '@/utils/video-status'

export function ShotTimeline({ ids, photosById, checkinsById, cover, totalSeconds, onChange, onCover }: {
  ids: number[]
  photosById: Map<number, PhotoView>
  checkinsById: Map<number, CheckinView>
  cover: number | null
  totalSeconds: number
  onChange: (ids: number[]) => void
  onCover: (id: number | null) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function move(from: number, to: number) {
    if (to < 0 || to >= ids.length || from === to) return
    const next = [...ids]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  if (ids.length === 0) return null

  return (
    <div className="vs-shots">
      <div className="vs-shots-head">
        <h3>镜头顺序</h3>
        <span><GripHorizontal size={13} /> 拖动调整顺序，顺序即播放顺序</span>
      </div>
      <ol className="vs-shots-row">
        {ids.map((id, i) => {
          const p = photosById.get(id)
          if (!p) return null
          const place = p.checkinId ? checkinsById.get(p.checkinId)?.placeName : undefined
          return (
            <li key={id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={e => { e.preventDefault(); setOverIndex(i) }}
              onDragLeave={() => setOverIndex(null)}
              onDrop={() => { if (dragIndex !== null) move(dragIndex, i); setDragIndex(null); setOverIndex(null) }}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
              className={`vs-shot${dragIndex === i ? ' is-dragging' : ''}${overIndex === i && dragIndex !== i ? ' is-over' : ''}`}>
              <span className="vs-shot-thumb">
                <img src={p.imageUrl} alt="" draggable={false} />
                {cover === id && <strong>封面</strong>}
                <span className="vs-shot-actions">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="前移"><ArrowLeft size={11} /></button>
                  <button type="button" onClick={() => onCover(cover === id ? null : id)} className={cover === id ? 'is-on' : ''} aria-label="设为封面"><Star size={11} /></button>
                  <button type="button" onClick={() => onChange(ids.filter(x => x !== id))} aria-label="移出视频"><X size={11} /></button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === ids.length - 1} aria-label="后移"><ArrowRight size={11} /></button>
                </span>
              </span>
              <em>{String(i + 1).padStart(2, '0')}</em>
              {place && <small>{place}</small>}
            </li>
          )
        })}
      </ol>
      <p className="vs-shots-foot">预计成片 <b>{timecode(totalSeconds)}</b><span>· {ids.length} 个镜头，另含开场、路线与结尾</span></p>
    </div>
  )
}
