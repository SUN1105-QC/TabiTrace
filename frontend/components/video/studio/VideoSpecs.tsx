'use client'

/**
 * STEP 4 视频设置：比例（图形预览卡）、时长、清晰度三组。
 * 只有后端真正支持的选项可以选：目前成片只有 9:16；2K 暂未支持；60 秒与 1080P 需要 Trip Pro。
 */

import { useState } from 'react'
import type { Plan } from '@/types/video'
import { VideoProGate } from '../VideoProGate'

const RATIOS = [
  { value: '9:16', w: 18, h: 32, desc: '竖屏 · 手机全屏', ready: true },
  { value: '4:5', w: 26, h: 32, desc: '社交信息流', ready: false },
  { value: '16:9', w: 36, h: 20, desc: '横屏 · 电脑', ready: false }
]
const DURATIONS = [{ value: 15, pro: false }, { value: 30, pro: false }, { value: 60, pro: true }]
const QUALITIES = [
  { value: '720p', label: '720P', pro: false, ready: true },
  { value: '1080p', label: '1080P', pro: true, ready: true },
  { value: '2k', label: '2K', pro: true, ready: false }
]

export function VideoSpecs({ plan, aspectRatio, duration, quality, onChange }: {
  plan: Plan
  aspectRatio: string
  duration: number
  quality: string
  onChange: (patch: { aspectRatio?: string; duration?: number; quality?: string }) => void
}) {
  const [gate, setGate] = useState('')
  const pro = plan === 'PRO'

  return (
    <div className="vs-specs">
      <div className="vs-spec">
        <p className="vs-label">视频比例</p>
        <div className="vs-ratios">
          {RATIOS.map(r => (
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
          {DURATIONS.map(d => {
            const locked = d.pro && !pro
            return (
              <button key={d.value} type="button" className={`${duration === d.value ? 'is-active' : ''}${locked ? ' is-locked' : ''}`}
                onClick={() => { if (locked) { setGate('60 秒视频需要 Trip Pro，Free 旅行可以选择 15 或 30 秒。'); return } setGate(''); onChange({ duration: d.value }) }}>
                {d.value} 秒{d.pro && <em>PRO</em>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="vs-spec">
        <p className="vs-label">清晰度</p>
        <div className="vs-pills">
          {QUALITIES.map(q => {
            const locked = q.pro && !pro
            return (
              <button key={q.value} type="button" disabled={!q.ready} title={q.ready ? undefined : '即将支持'}
                className={`${quality === q.value ? 'is-active' : ''}${locked && q.ready ? ' is-locked' : ''}`}
                onClick={() => { if (locked) { setGate('1080P 无水印导出需要 Trip Pro，Free 旅行导出 720P（带水印）。'); return } setGate(''); onChange({ quality: q.value }) }}>
                {q.label}{q.pro && <em>{q.ready ? 'PRO' : '即将支持'}</em>}
              </button>
            )
          })}
        </div>
      </div>

      {gate && <VideoProGate compact message={gate} />}
      <p className="vs-specs-now">当前设置 <b>{aspectRatio} · {duration} 秒 · {quality.toUpperCase()}</b>{pro ? ' · 无水印' : ' · 带 TabiTrace 水印'}</p>
    </div>
  )
}
