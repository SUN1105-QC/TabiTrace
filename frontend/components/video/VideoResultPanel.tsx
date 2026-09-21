'use client'

/**
 * 视频任务面板：渲染进度 + 内嵌播放器 + 历史版本切换。
 * 只有拿到真实可播放的 outputUrl 才渲染 <video>；mock 渲染器返回的 example.invalid
 * 不是真实地址，这里明确提示而不是塞一个放不出来的播放器。
 */

import { useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, LoaderCircle, Play, RefreshCw } from 'lucide-react'
import type { PhotoView, VideoProjectView } from '@/services/tabitrace-api'
import { MUSIC_TRACKS } from './MusicPicker'

const TEMPLATE_TEXT: Record<string, string> = { JOURNAL: '旅行日记', MINIMAL: '极简杂志', CITY: '城市节奏' }
const STATUS_TEXT: Record<string, string> = { DRAFT: '草稿', QUEUED: '排队中', PROCESSING: '渲染中', COMPLETED: '已完成', FAILED: '失败' }

/** mock 渲染器写的是占位域名，不能真的播放 */
export function isPlayable(p: VideoProjectView | undefined | null) {
  return !!p?.outputUrl && !p.outputUrl.includes('example.invalid')
}

export function VideoResultPanel({
  projects, photos, onReload
}: {
  projects: VideoProjectView[]
  photos: PhotoView[]
  onReload: () => void
}) {
  const latest = useMemo(
    () => projects.find(p => ['QUEUED', 'PROCESSING'].includes(p.status)) || projects[0],
    [projects]
  )
  const playable = useMemo(() => projects.filter(isPlayable), [projects])
  const [activeId, setActiveId] = useState<number | null>(null)

  // 新视频渲染完成后自动切到最新一条
  useEffect(() => {
    if (playable.length && !playable.some(p => p.id === activeId)) setActiveId(playable[0].id)
  }, [playable, activeId])

  const current = playable.find(p => p.id === activeId) || playable[0] || null
  const poster = current ? photos.find(p => p.id === current.photoIds[0])?.imageUrl : undefined
  const running = latest && ['QUEUED', 'PROCESSING'].includes(latest.status)

  // 文件被清理或 worker 没在跑时，outputUrl 会 404，这里明确说明而不是留一块黑屏
  const [loadFailed, setLoadFailed] = useState(false)
  useEffect(() => { setLoadFailed(false) }, [current?.id])

  if (!latest) {
    return (
      <div className="video-panel">
        <p className="video-panel-empty">还没有生成过视频。选好模板、音乐和照片后点击下方按钮，渲染任务会出现在这里。</p>
      </div>
    )
  }

  return (
    <div className="video-panel">
      <div className="video-panel-head">
        <div>
          <p className="video-panel-kicker">LATEST VIDEO PROJECT</p>
          <h3>{TEMPLATE_TEXT[latest.templateCode] || latest.templateCode} · {STATUS_TEXT[latest.status] || latest.status}</h3>
        </div>
        {running
          ? <LoaderCircle className="animate-spin text-warm" />
          : <button onClick={onReload} className="video-icon-button" aria-label="刷新渲染状态"><RefreshCw size={14} /></button>}
      </div>

      <div className="video-progress"><span style={{ width: `${latest.progress}%` }} /></div>
      <p className="video-progress-note">{latest.progress}% · {latest.photoIds.length} 张照片 · {latest.duration} 秒 · {latest.aspectRatio}</p>

      {latest.status === 'FAILED' && (
        <p className="video-alert">{latest.errorMessage || '渲染失败，可以调整照片或模板后重新生成。'}</p>
      )}

      {current ? (
        <>
          <div className="video-stage">
            <video
              key={current.id}
              className="video-player"
              controls
              playsInline
              preload="metadata"
              poster={poster}
              src={current.outputUrl!}
              onError={() => setLoadFailed(true)}
            />
          </div>

          {loadFailed && (
            <p className="video-alert">
              视频文件加载失败：<code>{current.outputUrl}</code><br />
              渲染产物可能已被清理，或 <code>video-worker</code> 没有在运行。重新生成一次即可。
            </p>
          )}

          <div className="video-meta">
            <span>{TEMPLATE_TEXT[current.templateCode] || current.templateCode}</span>
            <span>{MUSIC_TRACKS.find(m => m.code === current.musicCode)?.label || current.musicCode}</span>
            <span>{current.duration} 秒 · {current.aspectRatio}</span>
          </div>

          <div className="video-actions">
            <a className="warm-button" href={current.outputUrl!} download>
              <Download size={14} /> 下载 MP4
            </a>
            <a className="hero-ghost-button" href={current.outputUrl!} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> 新窗口打开
            </a>
          </div>
        </>
      ) : latest.status === 'COMPLETED' ? (
        <p className="video-notice">
          本地 Mock 渲染已完成，返回的是占位地址（{latest.outputUrl}），无法播放。
          启动 <code>video-worker</code> 并安装 FFmpeg 后重新生成，这里会直接出现可播放的视频。
        </p>
      ) : null}

      {playable.length > 1 && (
        <div className="video-history">
          <p className="video-history-title">历史版本</p>
          <ul>
            {playable.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  className={p.id === current?.id ? 'is-active' : ''}
                  onClick={() => setActiveId(p.id)}
                >
                  <span className="video-history-icon"><Play size={12} /></span>
                  <span className="video-history-body">
                    <b>{TEMPLATE_TEXT[p.templateCode] || p.templateCode} · {p.photoIds.length} 张</b>
                    <small>{(p.completedAt || p.createdAt || '').replace('T', ' ').slice(0, 16)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
