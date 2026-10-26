'use client'

/**
 * 镜头顺序：轻量 storyboard，一格一个镜头，淡橙色细线相连。
 * 拖动卡片或用左右箭头调整顺序；星标设为封面；× 移出视频。不做多轨时间轴。
 * mobile（触屏）：没有悬停与拖拽，改为「点选一个素材 → 下方操作条」：前移 / 后移 / 设为封面 / 移出，并显示它的地点。
 */

import { useState } from 'react'
import { ArrowLeft, ArrowRight, GripHorizontal, MapPin, Star, X } from 'lucide-react'
import type { CheckinView, PhotoView } from '@/services/tabitrace-api'
import { timecode } from '@/utils/video-status'
import { photoThumb } from '@/utils/photo-variants'

export function ShotTimeline({ ids, photosById, checkinsById, cover, totalSeconds, mobile = false, onChange, onCover }: {
  ids: number[]
  photosById: Map<number, PhotoView>
  checkinsById: Map<number, CheckinView>
  cover: number | null
  totalSeconds: number
  mobile?: boolean
  onChange: (ids: number[]) => void
  onCover: (id: number | null) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [picked, setPicked] = useState<number | null>(null)

  function move(from: number, to: number) {
    if (to < 0 || to >= ids.length || from === to) return
    const next = [...ids]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  if (ids.length === 0) return null

  const placeOf = (p?: PhotoView) => (p?.checkinId ? checkinsById.get(p.checkinId)?.placeName : undefined)
  const pickedIndex = picked === null ? -1 : ids.indexOf(picked)

  return (
    <div className={`vs-shots${mobile ? ' is-touch' : ''}`}>
      <div className="vs-shots-head">
        <h3>{mobile ? '已选素材顺序' : '镜头顺序'}</h3>
        <span>{mobile ? '点选素材可调整顺序、设封面或移出' : <><GripHorizontal size={13} /> 拖动调整顺序，顺序即播放顺序</>}</span>
      </div>
      <ol className="vs-shots-row">
        {ids.map((id, i) => {
          const p = photosById.get(id)
          if (!p) return null
          const place = placeOf(p)
          if (mobile) {
            return (
              <li key={id} className={`vs-shot${picked === id ? ' is-picked' : ''}`}>
                <button type="button" className="vs-shot-thumb" onClick={() => setPicked(picked === id ? null : id)} aria-pressed={picked === id}
                  aria-label={`第 ${i + 1} 个素材${place ? `：${place}` : ''}${cover === id ? '（封面）' : ''}`}>
                  <img src={photoThumb(p)} alt="" loading="lazy" decoding="async" />
                  {cover === id && <strong>封面</strong>}
                </button>
                <em>{String(i + 1).padStart(2, '0')}</em>
                <small>{place ?? '未关联地点'}</small>
              </li>
            )
          }
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
                <img src={photoThumb(p)} alt="" draggable={false} loading="lazy" decoding="async" />
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
      {mobile && pickedIndex >= 0 && picked !== null && (
        <div className="vs-shot-bar" role="group" aria-label="调整选中的素材">
          <p><b>第 {pickedIndex + 1} 个</b><span><MapPin size={11} /> {placeOf(photosById.get(picked)) ?? '未关联地点'}</span>{cover === picked && <em>封面</em>}</p>
          <div>
            <button type="button" onClick={() => move(pickedIndex, pickedIndex - 1)} disabled={pickedIndex === 0}><ArrowLeft size={13} /> 前移</button>
            <button type="button" onClick={() => move(pickedIndex, pickedIndex + 1)} disabled={pickedIndex === ids.length - 1}>后移 <ArrowRight size={13} /></button>
            <button type="button" className={cover === picked ? 'is-on' : ''} onClick={() => onCover(cover === picked ? null : picked)}><Star size={13} /> {cover === picked ? '取消封面' : '设为封面'}</button>
            <button type="button" className="is-danger" onClick={() => { onChange(ids.filter(x => x !== picked)); setPicked(null) }}><X size={13} /> 移出</button>
          </div>
        </div>
      )}
      <p className="vs-shots-foot">预计成片 <b>{timecode(totalSeconds)}</b><span>· {ids.length} 个镜头，另含开场与结尾</span></p>
    </div>
  )
}
