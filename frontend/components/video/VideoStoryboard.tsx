'use client'

/**
 * 视频结构 / 分镜预览：分镜由后端按真实旅行数据自动编排。
 * 用户只能做三件事——调整中间段落的顺序、关闭某段、改段落标题；开场和结尾固定在首尾。
 * 不提供逐帧、音轨、关键帧之类的剪辑能力。
 */

import { useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Map as MapIcon, MapPin, PencilLine, Sparkles, Trophy, Flag, Info } from 'lucide-react'
import type { SegmentOverride, Scene, Storyboard } from '@/types/video'
import type { PhotoView } from '@/services/tabitrace-api'
import { SCENE_LABEL, timecode } from '@/utils/video-status'

const ICON = { OPENING: Sparkles, MAP: MapIcon, PLACE: MapPin, ACHIEVEMENTS: Trophy, ENDING: Flag }

/** 把本地的段落覆盖先套到分镜上，编辑后立刻看到顺序和开关变化（时长在重新预览后更新）。 */
export function applySegments(scenes: Scene[], segments: SegmentOverride[]): Scene[] {
  const titles = new Map(segments.filter(s => s.title).map(s => [s.key, s.title as string]))
  const head = scenes.filter(s => s.pinned && s.type === 'OPENING')
  const tail = scenes.filter(s => s.pinned && s.type === 'ENDING')
  const middle = new Map(scenes.filter(s => !s.pinned).map(s => [s.key, s]))
  const ordered: Scene[] = []
  for (const o of segments) {
    const s = middle.get(o.key)
    if (!s) continue
    ordered.push({ ...s, enabled: o.enabled !== false })
    middle.delete(o.key)
  }
  ordered.push(...middle.values())
  return [...head, ...ordered, ...tail].map(s => (titles.has(s.key) ? { ...s, title: titles.get(s.key)! } : s))
}

export function VideoStoryboard({
  storyboard, segments, photosById, dirty, loading, onChange, onRefresh
}: {
  storyboard: Storyboard | null
  segments: SegmentOverride[]
  photosById: Map<number, PhotoView>
  dirty: boolean
  loading: boolean
  onChange: (next: SegmentOverride[]) => void
  onRefresh: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)

  if (!storyboard) {
    return (
      <div className="ts-storyboard-empty">
        <p>选好照片后点击「生成分镜」，旅迹会按打卡时间自动编排开场、地图、地点和结尾。</p>
        <button type="button" className="hero-ghost-button" onClick={onRefresh} disabled={loading}>{loading ? '正在编排…' : '生成分镜'}</button>
      </div>
    )
  }

  const scenes = applySegments(storyboard.scenes, segments)
  const middleKeys = scenes.filter(s => !s.pinned).map(s => s.key)

  /** 以当前显示的顺序重建覆盖列表；标题只记录用户真正改过的。 */
  function commit(order: string[], patch?: { key: string; enabled?: boolean; title?: string | null }) {
    const prev = new Map(segments.map(s => [s.key, s]))
    const byKey = new Map(scenes.map(s => [s.key, s]))
    const next: SegmentOverride[] = order.map(key => {
      const p = patch?.key === key ? patch : undefined
      return {
        key,
        enabled: p?.enabled !== undefined ? p.enabled : byKey.get(key)?.enabled !== false,
        title: p && 'title' in p ? p.title ?? null : prev.get(key)?.title ?? null
      }
    })
    for (const key of ['opening', 'ending']) {
      const title = patch?.key === key && 'title' in patch ? patch.title ?? null : prev.get(key)?.title ?? null
      if (title) next.push({ key, title })
    }
    onChange(next)
  }

  function move(key: string, delta: number) {
    const i = middleKeys.indexOf(key), j = i + delta
    if (i < 0 || j < 0 || j >= middleKeys.length) return
    const order = [...middleKeys]
    ;[order[i], order[j]] = [order[j], order[i]]
    commit(order)
  }

  function drop(target: string) {
    if (!dragKey || dragKey === target) return
    const order = middleKeys.filter(k => k !== dragKey)
    order.splice(order.indexOf(target), 0, dragKey)
    commit(order)
  }

  return (
    <div className="ts-storyboard">
      <div className="ts-storyboard-head">
        <span>{scenes.filter(s => s.enabled).length} 个段落 · {storyboard.totalDuration} 秒</span>
        <button type="button" className="panel-link" onClick={onRefresh} disabled={loading}>{loading ? '更新中…' : dirty ? '按新设置更新分镜' : '刷新分镜'}</button>
      </div>
      {dirty && <p className="ts-hint is-warn">设置已变化，时间轴会在重新预览后更新。</p>}

      <ol className="ts-scenes">
        {scenes.map(s => {
          const Icon = ICON[s.type] ?? MapPin
          const isEditing = editing === s.key
          return (
            <li
              key={s.key}
              className={`ts-scene${s.enabled ? '' : ' is-off'}${s.pinned ? ' is-pinned' : ''}${dragKey === s.key ? ' is-dragging' : ''}`}
              draggable={!s.pinned && !isEditing}
              onDragStart={() => setDragKey(s.key)}
              onDragOver={e => { if (!s.pinned) e.preventDefault() }}
              onDrop={() => { drop(s.key); setDragKey(null) }}
              onDragEnd={() => setDragKey(null)}
            >
              <span className="ts-scene-time">{s.enabled ? timecode(s.start) : '—'}</span>
              <span className="ts-scene-grip">{s.pinned ? <Icon size={14} /> : <GripVertical size={14} />}</span>
              <span className="ts-scene-body">
                <span className="ts-scene-kind"><Icon size={11} /> {SCENE_LABEL[s.type]}{s.enabled && s.duration ? ` · ${s.duration.toFixed(1)} 秒` : ''}</span>
                {isEditing ? (
                  <input
                    className="field ts-scene-input"
                    autoFocus
                    maxLength={40}
                    defaultValue={s.title}
                    onBlur={e => { commit(middleKeys, { key: s.key, title: e.target.value.trim() || null }); setEditing(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null) }}
                  />
                ) : (
                  <button type="button" className="ts-scene-title" onClick={() => setEditing(s.key)} title="修改标题">
                    {s.title || <em>（未显示标题）</em>} <PencilLine size={11} />
                  </button>
                )}
                {s.subtitle && <small>{s.subtitle}</small>}
                {s.type === 'MAP' && s.meta.points && <small>{s.meta.points.map(p => p.name).join(' → ')}</small>}
                {s.type === 'ACHIEVEMENTS' && s.meta.items && <small>{s.meta.items.join(' · ')}</small>}
              </span>
              {s.photoIds.length > 0 && (
                <span className="ts-scene-thumbs">
                  {s.photoIds.slice(0, 3).map(id => photosById.get(id) && <img key={id} src={photosById.get(id)!.imageUrl} alt="" />)}
                  {s.photoIds.length > 3 && <em>+{s.photoIds.length - 3}</em>}
                </span>
              )}
              {!s.pinned && (
                <span className="ts-scene-actions">
                  <button type="button" onClick={() => move(s.key, -1)} disabled={middleKeys.indexOf(s.key) === 0} aria-label="上移"><ArrowUp size={13} /></button>
                  <button type="button" onClick={() => move(s.key, 1)} disabled={middleKeys.indexOf(s.key) === middleKeys.length - 1} aria-label="下移"><ArrowDown size={13} /></button>
                  <button type="button" onClick={() => commit(middleKeys, { key: s.key, enabled: !s.enabled })} aria-label={s.enabled ? '关闭这一段' : '开启这一段'}>
                    {s.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {storyboard.notices.length > 0 && (
        <ul className="ts-notices">
          {storyboard.notices.map(n => <li key={n}><Info size={12} /> {n}</li>)}
        </ul>
      )}
    </div>
  )
}
