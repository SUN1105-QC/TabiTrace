'use client'

/**
 * STEP 4 视频设置：比例（图形预览卡）、时长、清晰度三组。
 * 只有后端真正支持的选项可以选：比例 9:16 / 4:5 / 16:9 都可以导出（Worker 按比例重新排版，不是裁切）；2K 暂未支持。
 * 时长、清晰度、水印的 Free / Pro 差异来自后端方案配置（GET /plans/trip-pro 的 storyFree / storyPro），不在这里写死。
 * compact（移动端）：只列出 Worker 真正能导出的选项，「即将支持」的 2K 不出现。
 */

import { useState } from 'react'
import type { Plan } from '@/types/video'
import type { StoryTier } from '@/utils/plan'
import { VideoProGate } from '../VideoProGate'

const RATIOS = [
  { value: '9:16', w: 18, h: 32, desc: '竖屏 · 手机全屏', ready: true },
  { value: '4:5', w: 26, h: 32, desc: '社交信息流', ready: true },
  { value: '16:9', w: 36, h: 20, desc: '横屏 · 电脑 / 电视', ready: true }
]
const QUALITY_RANK: Record<string, number> = { '720p': 1, '1080p': 2, '2k': 3 }
const rank = (q: string) => QUALITY_RANK[q.toLowerCase()] ?? 0

export function VideoSpecs({ plan, tiers, compact = false, aspectRatio, duration, quality, onChange }: {
  plan: Plan
  tiers: { FREE: StoryTier; PRO: StoryTier }
  compact?: boolean
  aspectRatio: string
  duration: number
  quality: string
  onChange: (patch: { aspectRatio?: string; duration?: number; quality?: string }) => void
}) {
  const [gate, setGate] = useState('')
  const pro = plan === 'PRO'
  const mine = tiers[plan]
  const free = tiers.FREE
  // 全部可选时长 = 两档的并集；不在 Free 档里的需要 Trip Pro
  const durations = Array.from(new Set([...free.durations, ...tiers.PRO.durations])).sort((a, b) => a - b)
    .map(v => ({ value: v, pro: !free.durations.includes(v) }))
  // 清晰度：每档给出的是最高清晰度，低于等于它的都可以选；2K 暂未支持，只在桌面端作为「即将支持」展示
  const qualities = [
    ...Array.from(new Set([free.quality, tiers.PRO.quality].map(q => q.toLowerCase()))).sort((a, b) => rank(a) - rank(b))
      .map(q => ({ value: q, label: q.toUpperCase(), pro: rank(q) > rank(free.quality), ready: true })),
    { value: '2k', label: '2K', pro: true, ready: false }
  ]
  const ratios = compact ? RATIOS.filter(r => r.ready) : RATIOS
  const qualityOptions = compact ? qualities.filter(q => q.ready) : qualities
  const longest = Math.max(...free.durations)

  return (
    <div className={`vs-specs${compact ? ' is-compact' : ''}`}>
      <div className="vs-spec">
        <p className="vs-label">视频比例{compact && <small>按比例重新排版，不是裁切</small>}</p>
        <div className="vs-ratios">
          {ratios.map(r => (
            <button key={r.value} type="button" disabled={!r.ready} title={r.ready ? r.desc : '即将支持'}
              className={`vs-ratio${aspectRatio === r.value ? ' is-active' : ''}`} onClick={() => onChange({ aspectRatio: r.value })}>
              <span className="vs-ratio-shape"><i style={{ width: r.w, height: r.h }} /></span>
              <b>{r.value}</b>
              <small>{r.ready ? r.desc : '即将支持'}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="vs-spec">
        <p className="vs-label">视频时长</p>
        <div className="vs-pills">
          {durations.map(d => {
            const locked = d.pro && !pro
            return (
              <button key={d.value} type="button" className={`${duration === d.value ? 'is-active' : ''}${locked ? ' is-locked' : ''}`} aria-pressed={duration === d.value}
                onClick={() => { if (locked) { setGate(`${d.value} 秒视频需要 Trip Pro，Free 旅行最长 ${longest} 秒。`); return } setGate(''); onChange({ duration: d.value }) }}>
                {d.value} 秒{d.pro && <em>PRO</em>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="vs-spec">
        <p className="vs-label">清晰度</p>
        <div className="vs-pills">
          {qualityOptions.map(q => {
            const locked = q.pro && !pro
            return (
              <button key={q.value} type="button" disabled={!q.ready} title={q.ready ? undefined : '即将支持'} aria-pressed={quality === q.value}
                className={`${quality === q.value ? 'is-active' : ''}${locked && q.ready ? ' is-locked' : ''}`}
                onClick={() => { if (locked) { setGate(`${q.label}${tiers.PRO.watermark ? '' : ' 无水印'}导出需要 Trip Pro，Free 旅行导出 ${free.quality.toUpperCase()}${free.watermark ? '（带水印）' : ''}。`); return } setGate(''); onChange({ quality: q.value }) }}>
                {q.label}{q.pro && <em>{q.ready ? 'PRO' : '即将支持'}</em>}
              </button>
            )
          })}
        </div>
      </div>

      {gate && <VideoProGate compact message={gate} />}
      <p className="vs-specs-now">当前设置 <b>{aspectRatio} · {duration} 秒 · {quality.toUpperCase()}</b>{mine.watermark ? ' · 带 TabiTrace 水印' : ' · 无水印'}</p>
    </div>
  )
}
