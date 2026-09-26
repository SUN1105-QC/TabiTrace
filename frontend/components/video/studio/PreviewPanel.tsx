'use client'

/**
 * LIVE PREVIEW：按后端分镜逐段播放的 9:16 预览（VideoPreview），并套上当前视觉风格的色调。
 * 横屏成片暂未支持，切换按钮只做说明，不假装能预览。
 */

import type { ComponentProps } from 'react'
import type { VisualStyle } from '@/types/video'
import { styleOf } from '@/utils/video-studio'
import { VideoPreview } from '../VideoPreview'

export function PreviewPanel({ style, ...preview }: { style: VisualStyle } & ComponentProps<typeof VideoPreview>) {
  const s = styleOf(style)
  return (
    <section className="vs-card vs-preview" id="vs-preview">
      <header className="vs-side-head">
        <p className="vs-kicker">LIVE PREVIEW</p>
        <div className="vs-mini-seg" role="radiogroup" aria-label="预览方向">
          <button type="button" role="radio" aria-checked className="is-active">竖屏</button>
          <button type="button" role="radio" aria-checked={false} disabled title="横屏成片即将支持">横屏</button>
        </div>
      </header>
      <div className={`vs-preview-stage grade-${s.code.toLowerCase()}`} style={{ ['--grade' as string]: s.filter }}>
        <VideoPreview {...preview} />
      </div>
    </section>
  )
}
