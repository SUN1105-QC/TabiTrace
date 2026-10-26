'use client'

/**
 * LIVE PREVIEW：按后端分镜逐段播放的预览（VideoPreview），画面比例跟随分镜（9:16 / 4:5 / 16:9），并套上当前视觉风格的色调。
 * 顶部的比例切换与「视频设置」里的比例是同一个设置。
 * compact（移动端）：页面顶部一行 —— 左侧缩小的 9:16 画面，右侧是「效果预览 ≠ 成片」说明与当前配置；
 * 「展开预览」把同一个预览放大成全屏浮层（不重新挂载，播放进度保持）。
 */

import { useEffect, useState, type ComponentProps } from 'react'
import { LoaderCircle, Maximize2, RefreshCw, X } from 'lucide-react'
import type { VisualStyle } from '@/types/video'
import { styleOf } from '@/utils/video-studio'
import { VideoPreview } from '../VideoPreview'

const RATIOS: [string, string][] = [['9:16', '竖屏'], ['4:5', '4:5'], ['16:9', '横屏']]

export function PreviewPanel({ style, compact = false, title, info = [], aspectRatio, onAspect, ...preview }: {
  style: VisualStyle
  compact?: boolean
  /** 成片比例；onAspect 切换（与视频设置里的比例同步） */
  aspectRatio?: string
  onAspect?: (ratio: string) => void
  title?: string
  info?: [string, string][]
} & ComponentProps<typeof VideoPreview>) {
  const s = styleOf(style)
  const [expanded, setExpanded] = useState(false)
  const open = compact && expanded

  // 全屏预览：锁住页面滚动，Esc 关闭；回到桌面布局时自动收起
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  const state = preview.loading ? '正在按最新设置更新预览…'
    : preview.error ? preview.error
    : !preview.storyboard ? '还没有预览'
    : preview.dirty ? '设置已变化，预览即将自动更新'
    : ''

  return (
    <section className={`vs-card vs-preview${compact ? ' is-compact' : ''}${open ? ' is-expanded' : ''}`} id="vs-preview"
      role={open ? 'dialog' : undefined} aria-modal={open || undefined} aria-label={open ? '效果预览' : undefined}>
      {!compact && (
        <header className="vs-side-head">
          <p className="vs-kicker">LIVE PREVIEW</p>
          <div className="vs-mini-seg" role="radiogroup" aria-label="成片比例">
            {RATIOS.map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={aspectRatio === value} className={aspectRatio === value ? 'is-active' : ''}
                onClick={() => onAspect?.(value)} title={value}>{label}</button>
            ))}
          </div>
        </header>
      )}
      {open && (
        <header className="vs-preview-top">
          <span><b>效果预览</b><small>网页模拟分镜与转场，最终以生成的 MP4 为准</small></span>
          <button type="button" onClick={() => setExpanded(false)} aria-label="关闭全屏预览"><X size={18} /></button>
        </header>
      )}
      <div className="vs-preview-body">
        <div className={`vs-preview-stage grade-${s.code.toLowerCase()}`} style={{ ['--grade' as string]: s.filter }}>
          <VideoPreview {...preview} aspectRatio={aspectRatio} />
        </div>
        {compact && !open && (
          <div className="vs-preview-info">
            <p className="vs-preview-tag">效果预览</p>
            <small className="vs-preview-note">网页模拟分镜与转场，<b>不等于成片</b>；最终以生成的 MP4 为准。</small>
            {title && <b className="vs-preview-title">{title}</b>}
            <dl>
              {info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {state && (
              <p className={`vs-preview-state${preview.error ? ' is-error' : ''}`}>
                {preview.loading && <LoaderCircle size={12} className="animate-spin" />}{state}
              </p>
            )}
            <div className="vs-preview-actions">
              {!preview.storyboard || preview.error
                ? <button type="button" className="vs-btn" onClick={preview.onRefresh} disabled={preview.loading}><RefreshCw size={13} /> 生成预览</button>
                : <button type="button" className="vs-btn" onClick={() => setExpanded(true)}><Maximize2 size={13} /> 展开预览</button>}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
