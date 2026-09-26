'use client'

/**
 * 背景音乐：分类标签 + 曲目卡（圆形试听按钮、名称、风格、时长、FREE / PRO）。
 * 选中的曲目浅橙底、左侧橙色细线并显示波形；试听同一时间只放一首。
 * 音频取 public/music/<CODE>.(mp3|wav)，与 video-worker 渲染时读取的是同一批文件。
 */

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, TriangleAlert, VolumeX } from 'lucide-react'
import type { Plan, VideoMusic } from '@/types/video'
import { MUSIC_TABS, clock, musicFor } from '@/utils/video-studio'
import { PlanBadge, VideoProGate } from '../VideoProGate'

/** 固定形状的波形条，只做装饰；播放时逐条起伏 */
const WAVE = [6, 11, 16, 9, 14, 20, 12, 7, 15, 18, 10, 6, 13, 17, 9, 12, 19, 8, 14, 10, 6, 11, 16, 9]

export function MusicPicker({ music, value, plan, templateCode, onChange }: {
  music: VideoMusic[]
  value: string
  plan: Plan
  templateCode: string
  onChange: (code: string) => void
}) {
  const audios = useRef<Record<string, HTMLAudioElement | null>>({})
  const [tab, setTab] = useState('REC')
  const [playing, setPlaying] = useState('')
  const [at, setAt] = useState(0)
  const [broken, setBroken] = useState<string[]>([])
  const [gate, setGate] = useState<VideoMusic | null>(null)

  const tabs = MUSIC_TABS.filter(t => t.key === 'REC' || music.some(m => m.category === t.key))
  const shown = musicFor(tab, music, templateCode)

  function stopAll(except?: string) {
    Object.entries(audios.current).forEach(([code, el]) => { if (el && code !== except) { el.pause(); el.currentTime = 0 } })
  }
  useEffect(() => () => stopAll(), [])

  async function toggle(code: string) {
    const el = audios.current[code]
    if (!el) return
    if (playing === code) { el.pause(); setPlaying(''); return }
    stopAll(code)
    setAt(0)
    try { await el.play(); setPlaying(code) } catch { setBroken(b => (b.includes(code) ? b : [...b, code])); setPlaying('') }
  }

  function pick(m: VideoMusic) {
    if (plan === 'FREE' && m.plan === 'PRO') { setGate(m); return }
    setGate(null)
    onChange(m.code)
  }

  return (
    <div className="vs-music">
      <div className="vs-music-head">
        <h3>背景音乐</h3>
        <button type="button" className={`vs-text-btn${value === 'NONE' ? ' is-on' : ''}`} onClick={() => { stopAll(); setPlaying(''); onChange('NONE') }}>
          <VolumeX size={12} /> {value === 'NONE' ? '已选择无音乐' : '不使用音乐'}
        </button>
      </div>
      <div className="vs-chips" role="tablist">
        {tabs.map(t => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>

      <ul className="vs-tracks">
        {shown.map(m => {
          const selected = value === m.code
          const isPlaying = playing === m.code
          const missing = broken.includes(m.code)
          return (
            <li key={m.code} className={`vs-track${selected ? ' is-selected' : ''}${isPlaying ? ' is-playing' : ''}`}>
              <button type="button" className="vs-track-play" onClick={() => toggle(m.code)} disabled={missing} aria-label={isPlaying ? `停止试听 ${m.name}` : `试听 ${m.name}`}>
                {missing ? <TriangleAlert size={14} /> : isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button type="button" className="vs-track-body" onClick={() => pick(m)} aria-pressed={selected}>
                <span className="vs-track-text">
                  <b>{m.name}</b>
                  <small>{missing ? '音频文件缺失，请换一首' : m.mood}</small>
                </span>
                {selected && (
                  <span className="vs-wave" aria-hidden>
                    {WAVE.map((h, i) => <i key={i} style={{ height: h, animationDelay: `${(i % 6) * 0.12}s` }} />)}
                  </span>
                )}
                <span className="vs-track-meta">
                  <em>{isPlaying ? clock(at) : clock(m.durationSeconds)}</em>
                  <PlanBadge plan={m.plan} />
                </span>
              </button>
              <audio ref={el => { audios.current[m.code] = el }} preload="none" loop
                onTimeUpdate={e => { if (playing === m.code) setAt(e.currentTarget.currentTime) }}
                onError={() => setBroken(b => (b.includes(m.code) ? b : [...b, m.code]))}>
                <source src={`/music/${m.code}.mp3`} type="audio/mpeg" />
                <source src={`/music/${m.code}.wav`} type="audio/wav" />
              </audio>
            </li>
          )
        })}
      </ul>
      {gate && <VideoProGate compact message={`「${gate.name}」是 Trip Pro 音乐，可以先试听；Free 旅行可以使用 FREE 曲目。`} />}
    </div>
  )
}
