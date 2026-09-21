'use client'

/**
 * 音乐选择 + 试听。
 * 音频文件来自 public/music/<MUSIC_CODE>.(mp3|wav)，与 video-worker 渲染时读取的是同一批文件，
 * 所以「试听到的」就是「最终会混进视频的」。文件缺失时按钮会置灰并给出说明，不会变成死按钮。
 */

import { useEffect, useRef, useState } from 'react'
import { Check, Music2, Pause, Play, TriangleAlert, VolumeX } from 'lucide-react'

export type MusicTrack = { code: string; label: string; mood: string }

export const MUSIC_TRACKS: MusicTrack[] = [
  { code: 'NONE', label: '无音乐', mood: '只保留画面，适合后期自己配音' },
  { code: 'WARM_JOURNEY', label: 'Warm Journey', mood: '温暖舒缓 · 适合日常旅行记录' },
  { code: 'TOKYO_NIGHT', label: 'Tokyo Night', mood: '夜色感 · 适合城市夜景' },
  { code: 'SLOW_MORNING', label: 'Slow Morning', mood: '清晨轻柔 · 适合散步与早餐' },
  { code: 'CITY_WALK', label: 'City Walk', mood: '轻快有节奏 · 适合街拍剪辑' },
  { code: 'MEMORIES', label: 'Memories', mood: '怀旧 · 适合旅行总结片尾' }
]

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '--:--')

export function MusicPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const audios = useRef<Record<string, HTMLAudioElement | null>>({})
  const [playing, setPlaying] = useState('')
  const [at, setAt] = useState(0)
  const [len, setLen] = useState(0)
  const [broken, setBroken] = useState<string[]>([])

  function stopOthers(except?: string) {
    Object.entries(audios.current).forEach(([code, el]) => {
      if (!el || code === except) return
      el.pause()
      el.currentTime = 0
    })
  }

  // 离开页面时停掉声音
  useEffect(() => () => stopOthers(), [])

  // 切换到「无音乐」时，试听也一并停止
  useEffect(() => { if (value === 'NONE') { stopOthers(); setPlaying('') } }, [value])

  async function toggle(code: string) {
    const el = audios.current[code]
    if (!el) return
    if (playing === code) { el.pause(); setPlaying(''); return }
    stopOthers(code)
    setAt(0)
    try {
      await el.play()
      setPlaying(code)
    } catch {
      setBroken(b => (b.includes(code) ? b : [...b, code]))
      setPlaying('')
    }
  }

  return (
    <ul className="music-list">
      {MUSIC_TRACKS.map(track => {
        const selected = value === track.code
        const isPlaying = playing === track.code
        const missing = broken.includes(track.code)
        return (
          <li key={track.code} className={`music-row${selected ? ' is-selected' : ''}`}>
            <button type="button" className="music-pick" onClick={() => onChange(track.code)} aria-pressed={selected}>
              <span className="music-icon">
                {selected ? <Check size={15} /> : track.code === 'NONE' ? <VolumeX size={15} /> : <Music2 size={15} />}
              </span>
              <span className="music-body">
                <b>{track.label}</b>
                <small>{missing ? '音频文件缺失，渲染时会报错' : track.mood}</small>
              </span>
            </button>

            {track.code !== 'NONE' && (
              <button
                type="button"
                className={`music-preview${isPlaying ? ' is-playing' : ''}`}
                onClick={() => toggle(track.code)}
                disabled={missing}
                aria-label={isPlaying ? `暂停试听 ${track.label}` : `试听 ${track.label}`}
              >
                {missing ? <TriangleAlert size={15} /> : isPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>
            )}

            {track.code !== 'NONE' && (
              <audio
                ref={el => { audios.current[track.code] = el }}
                preload="none"
                loop
                onTimeUpdate={e => {
                  if (playing !== track.code) return
                  setAt(e.currentTarget.currentTime)
                  setLen(e.currentTarget.duration)
                }}
                onError={() => setBroken(b => (b.includes(track.code) ? b : [...b, track.code]))}
              >
                <source src={`/music/${track.code}.mp3`} type="audio/mpeg" />
                <source src={`/music/${track.code}.wav`} type="audio/wav" />
              </audio>
            )}

            {isPlaying && (
              <div className="music-progress">
                <i><span style={{ width: `${len ? Math.min(100, (at / len) * 100) : 0}%` }} /></i>
                <em>{fmt(at)} / {fmt(len)}</em>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
