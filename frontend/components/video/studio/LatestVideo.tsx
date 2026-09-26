'use client'

/**
 * LATEST VIDEO：当前关注的视频项目。16:9 封面 + 状态 + 信息，
 * 完成后「播放」在卡片里展开真实 MP4；排队 / 生成中显示后端真实进度；失败可重试。
 */

import { useEffect, useRef, useState } from 'react'
import { Download, Film, Pencil, Play, RefreshCw, RotateCcw, Share2, Trash2, TriangleAlert, X } from 'lucide-react'
import type { VideoProject, VideoTemplate } from '@/types/video'
import { STATUS_LABEL, errorTitle, formatDateTime, isMock, isPlayable, isRunning } from '@/utils/video-status'
import { VideoRenderProgress } from '../VideoRenderProgress'

export type ProjectActions = {
  onRender: (id: number) => void
  onEdit: (p: VideoProject) => void
  onDelete: (p: VideoProject) => void
  onShare: (p: VideoProject) => void
  onDuplicate: (id: number) => void
  onFocus: (id: number) => void
}

export function LatestVideo({ project, template, cover, busy, actions, playSignal }: {
  project: VideoProject | null
  template?: VideoTemplate
  cover?: string
  busy: boolean
  actions: ProjectActions
  playSignal: number
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [open, setOpen] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  useEffect(() => { setOpen(false); setLoadFailed(false) }, [project?.id, project?.outputUrl])

  // 「我的视频」里点播放：展开播放器并开始播放
  useEffect(() => { if (playSignal) setOpen(true) }, [playSignal])
  useEffect(() => {
    if (!open || !videoRef.current) return
    videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    videoRef.current.play().catch(() => {})
  }, [open, playSignal])

  if (!project) {
    return (
      <section className="vs-card vs-latest">
        <p className="vs-kicker">LATEST VIDEO</p>
        <div className="vs-latest-empty"><Film size={20} /><p>还没有生成过视频。完成左侧步骤后，点「生成旅行视频」。</p></div>
      </section>
    )
  }

  const playable = isPlayable(project)
  const info = [`${project.duration} 秒`, project.quality.toUpperCase(), formatDateTime(project.completedAt || project.updatedAt || project.createdAt)]

  return (
    <section className="vs-card vs-latest" id="vs-latest">
      <p className="vs-kicker">LATEST VIDEO</p>

      {open && playable ? (
        <div className="vs-latest-player">
          <video ref={videoRef} key={project.id} controls playsInline preload="metadata" poster={cover} src={project.outputUrl!} onError={() => setLoadFailed(true)} />
          <button type="button" className="vs-latest-close" onClick={() => setOpen(false)} aria-label="收起播放器"><X size={14} /></button>
        </div>
      ) : (
        <button type="button" className="vs-latest-cover" onClick={() => playable && setOpen(true)} disabled={!playable} aria-label={playable ? '播放视频' : undefined}>
          {cover ? <img src={cover} alt="" /> : <Film size={22} />}
          {playable && <span className="vs-play-dot"><Play size={16} /></span>}
          {isRunning(project) && <i className="vs-cover-progress" style={{ width: `${project.progress}%` }} />}
        </button>
      )}
      {loadFailed && <p className="vs-hint is-warn">视频文件加载失败：渲染产物可能已被清理，可以点「重新生成」。</p>}

      <h3 className="vs-latest-title">{project.name || '旅行视频'}{template && !project.name?.includes(template.englishName) && <small> · {template.englishName}</small>}</h3>
      <p className={`vs-status is-${project.status.toLowerCase()}`}><i />{STATUS_LABEL[project.status]}{project.status === 'COMPLETED' && isMock(project) ? ' · 模拟渲染' : ''}</p>
      <p className="vs-latest-info">{info.join(' · ')}{project.watermark ? ' · 水印' : ''}</p>

      {isRunning(project) && <VideoRenderProgress project={project} />}

      {project.status === 'COMPLETED' && playable && (
        <div className="vs-latest-actions">
          <button type="button" className="vs-btn is-primary" onClick={() => { setOpen(true); videoRef.current?.play().catch(() => {}) }}><Play size={13} /> 播放</button>
          <a className="vs-btn" href={project.outputUrl!} download><Download size={13} /> 下载 MP4</a>
          <button type="button" className="vs-btn" onClick={() => actions.onEdit(project)}><Pencil size={13} /> 再次编辑</button>
          <div className="vs-latest-links">
            <button type="button" className="vs-text-btn" onClick={() => actions.onShare(project)}><Share2 size={12} /> 分享</button>
            <button type="button" className="vs-text-btn" disabled={busy} onClick={() => actions.onRender(project.id)}><RefreshCw size={12} /> 重新生成</button>
          </div>
        </div>
      )}

      {project.status === 'COMPLETED' && isMock(project) && (
        <>
          <p className="vs-hint">本地模拟渲染器只走完了状态流程，没有生成真实 MP4。启动 video-worker（需要 FFmpeg）后点「重新生成」即可得到真实视频。</p>
          <div className="vs-latest-actions">
            <button type="button" className="vs-btn is-primary" disabled={busy} onClick={() => actions.onRender(project.id)}><RefreshCw size={13} /> 重新生成</button>
            <button type="button" className="vs-btn" onClick={() => actions.onEdit(project)}><Pencil size={13} /> 再次编辑</button>
          </div>
        </>
      )}

      {project.status === 'DRAFT' && (
        <div className="vs-latest-actions">
          <button type="button" className="vs-btn is-primary" disabled={busy} onClick={() => actions.onRender(project.id)}><Film size={13} /> 生成视频</button>
          <button type="button" className="vs-btn" onClick={() => actions.onEdit(project)}><Pencil size={13} /> 继续编辑</button>
        </div>
      )}

      {project.status === 'FAILED' && (
        <div className="vs-latest-failed">
          <p className="vs-failed-title"><TriangleAlert size={14} /> {errorTitle(project.errorCode)}</p>
          {project.errorMessage && (
            <details>
              <summary>{project.errorMessage.split('\n')[0]}</summary>
              {project.errorMessage.includes('\n') && <pre>{project.errorMessage.split('\n').slice(1).join('\n')}</pre>}
            </details>
          )}
          <div className="vs-latest-actions">
            <button type="button" className="vs-btn is-primary" disabled={busy} onClick={() => actions.onRender(project.id)}><RotateCcw size={13} /> 重试</button>
            <button type="button" className="vs-btn" onClick={() => actions.onEdit(project)}><Pencil size={13} /> 返回编辑</button>
            <button type="button" className="vs-text-btn is-danger" disabled={busy} onClick={() => actions.onDelete(project)}><Trash2 size={12} /> 删除</button>
          </div>
        </div>
      )}
    </section>
  )
}
