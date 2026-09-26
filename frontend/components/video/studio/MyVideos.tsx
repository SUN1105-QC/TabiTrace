'use client'

/**
 * 我的视频：这趟旅行的全部视频版本，横向 4 列卡片。
 * 操作只在鼠标悬停（或键盘聚焦）时出现：播放 / 编辑 / 下载 / 更多（分享、复制版本、重新生成、删除）。
 */

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Copy, Download, Film, MoreHorizontal, Pencil, Play, RotateCcw, Share2, Trash2 } from 'lucide-react'
import type { VideoProject, VideoTemplate } from '@/types/video'
import { STATUS_LABEL, errorTitle, formatDateTime, isPlayable, isRunning } from '@/utils/video-status'
import type { ProjectActions } from './LatestVideo'

const PAGE = 4

export function MyVideos({ projects, templates, coverOf, focusedId, busyId, actions, onPlay }: {
  projects: VideoProject[]
  templates: VideoTemplate[]
  coverOf: (p: VideoProject) => string | undefined
  focusedId: number | null
  busyId: number | null
  actions: ProjectActions
  onPlay: (id: number) => void
}) {
  const [all, setAll] = useState(false)
  const shown = all ? projects : projects.slice(0, PAGE)

  return (
    <section className="vs-videos">
      <header className="vs-videos-head">
        <h2>我的视频 <small>{projects.length} 个版本</small></h2>
        {projects.length > PAGE && (
          <button type="button" className="vs-text-btn" onClick={() => setAll(a => !a)}>{all ? '收起' : '查看全部'} <ArrowRight size={12} /></button>
        )}
      </header>
      {projects.length === 0 ? (
        <p className="vs-hint">还没有旅行视频。完成上面的步骤，生成这趟旅行的第一支旅行故事。</p>
      ) : (
        <div className="vs-videos-grid">
          {shown.map(p => (
            <VideoCard key={p.id} project={p} template={templates.find(t => t.code === p.templateCode)} cover={coverOf(p)}
              active={focusedId === p.id} busy={busyId === p.id} actions={actions} onPlay={onPlay} />
          ))}
        </div>
      )}
    </section>
  )
}

function VideoCard({ project: p, template, cover, active, busy, actions, onPlay }: {
  project: VideoProject
  template?: VideoTemplate
  cover?: string
  active: boolean
  busy: boolean
  actions: ProjectActions
  onPlay: (id: number) => void
}) {
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLElement | null>(null)
  const playable = isPlayable(p)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  return (
    <article ref={ref} className={`vs-video${active ? ' is-active' : ''}${menu ? ' is-menu' : ''}`}>
      <div className="vs-video-cover">
        <button type="button" className="vs-video-focus" onClick={() => actions.onFocus(p.id)} aria-label={`在右侧查看「${p.name || '旅行视频'}」`}>
          {cover ? <img src={cover} alt="" /> : <Film size={20} />}
        </button>
        <span className={`vs-video-pill is-${p.status.toLowerCase()}`}>{STATUS_LABEL[p.status]}{isRunning(p) ? ` ${p.progress}%` : ''}</span>
        {isRunning(p) && <i className="vs-cover-progress" style={{ width: `${p.progress}%` }} />}
        <div className="vs-video-hover">
          {playable && <button type="button" onClick={() => onPlay(p.id)} aria-label="播放"><Play size={14} /><span>播放</span></button>}
          <button type="button" onClick={() => actions.onEdit(p)} aria-label="编辑"><Pencil size={14} /><span>编辑</span></button>
          {playable && <a href={p.outputUrl!} download aria-label="下载"><Download size={14} /><span>下载</span></a>}
          <button type="button" onClick={() => setMenu(m => !m)} aria-label="更多操作" aria-expanded={menu}><MoreHorizontal size={14} /><span>更多</span></button>
        </div>
        {menu && (
          <div className="vs-video-menu" role="menu">
            {playable && <button type="button" role="menuitem" onClick={() => { setMenu(false); actions.onShare(p) }}><Share2 size={13} /> 分享</button>}
            {p.status !== 'DRAFT' && !isRunning(p) && <button type="button" role="menuitem" disabled={busy} onClick={() => { setMenu(false); actions.onRender(p.id) }}><RotateCcw size={13} /> 重新生成</button>}
            {p.status === 'DRAFT' && <button type="button" role="menuitem" disabled={busy} onClick={() => { setMenu(false); actions.onRender(p.id) }}><Film size={13} /> 生成视频</button>}
            <button type="button" role="menuitem" disabled={busy} onClick={() => { setMenu(false); actions.onDuplicate(p.id) }}><Copy size={13} /> 复制为新版本</button>
            <button type="button" role="menuitem" className="is-danger" disabled={busy} onClick={() => { setMenu(false); actions.onDelete(p) }}><Trash2 size={13} /> 删除</button>
          </div>
        )}
      </div>
      <b className="vs-video-title" title={p.name ?? ''}>{p.name || '旅行视频'}</b>
      <small>{formatDateTime(p.createdAt).slice(0, 10)}{p.status === 'FAILED' ? ` · ${errorTitle(p.errorCode)}` : ''}</small>
      <small>{p.duration} 秒 · {p.quality.toUpperCase()}{template ? ` · ${template.name}` : ''}</small>
    </article>
  )
}
