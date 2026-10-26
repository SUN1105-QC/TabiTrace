'use client'

/**
 * 移动端背景音乐：一张「当前音乐」卡（试听 / 更换音乐 / 音量），更换时打开底部面板里的「音乐与氛围」（MusicSelector）。
 * 当前音乐可以是旅迹音乐，也可以是「我的音乐」（会员上传）。
 * - 与选择器共用同一个试听播放器（useMusicPlayer）：任何时候只有一首在响
 * - 淡入淡出由后端按曲目统一处理（片头淡入 1 秒、片尾淡出 1.8 秒），这里只做说明，不提供假的调节项
 */

import { useEffect, type ReactNode } from 'react'
import { Loader2, Music2, Pause, Play, Repeat2, TriangleAlert, Volume2, X } from 'lucide-react'
import type { VideoMusic } from '@/types/video'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'
import { useUserMusic, userMusicKey } from '@/hooks/useUserMusic'
import { MUSIC_CATEGORY_LABEL, clock, licenseTag, type MusicSelection } from '@/utils/video-music'
import { PlanBadge } from '../VideoProGate'

export function MusicCard({ music, selection, volume, onVolume, onOpen }: {
  music: VideoMusic[]
  /** 当前选择；null = 无音乐 */
  selection: MusicSelection
  volume: number
  onVolume: (v: number) => void
  onOpen: () => void
}) {
  const { state: player, toggle, stop, setVolume } = useMusicPlayer()
  const mine = useUserMusic()
  const system = selection?.source === 'SYSTEM' ? music.find(m => m.code === selection.code) : undefined
  const own = selection?.source === 'USER' ? mine.library?.items.find(m => m.id === selection.id) : undefined
  useEffect(() => { setVolume(volume) }, [volume, setVolume])

  // 旅迹音乐与我的音乐统一成一张卡：名称、副标题、播放器代码、总时长
  const track = system
    ? { key: system.code, name: system.name, plan: system.plan, seconds: system.durationSeconds,
        sub: [system.artist, MUSIC_CATEGORY_LABEL[system.category]], tag: licenseTag(system), url: async () => system.previewUrl }
    : own
      ? { key: userMusicKey(own.id), name: own.title, plan: null, seconds: own.durationSeconds ?? null,
          sub: ['我的音乐', own.format ?? ''], tag: null, url: async () => (own.status === 'READY' ? mine.playUrl(own.id) : null) }
      : null
  const loaded = !!track && player.code === track.key
  const playing = loaded && player.playing
  const missing = !track || (system ? !system.previewUrl : own?.status !== 'READY') || player.failed.includes(track.key)
  const gone = selection != null && !track && (selection.source === 'SYSTEM' ? music.length > 0 : mine.status === 'ready')
  const goneText = selection?.source === 'USER' ? '原音乐已被删除' : '原音乐已下架'
  return (
    <div className="vs-music-card">
      <div className="vs-music-now">
        <span className={`vs-music-icon${playing ? ' is-playing' : ''}`}><Music2 size={18} /></span>
        <span className="vs-music-now-text">
          <small>当前音乐</small>
          <b>{track ? track.name : gone ? goneText : selection ? '正在读取音乐…' : '无音乐'}</b>
          <em>{track ? [...track.sub, loaded ? `${clock(player.current)} / ${clock(player.duration || track.seconds)}` : clock(track.seconds), track.tag].filter(Boolean).join(' · ')
            : gone ? '请点「更换音乐」重新选择' : selection ? '' : '成片只有画面与转场，没有背景音乐'}</em>
        </span>
        {track?.plan && <PlanBadge plan={track.plan} />}
      </div>
      {loaded && <span className="vm-progress" aria-hidden="true"><i style={{ width: `${player.duration ? Math.min(100, (player.current / player.duration) * 100) : 0}%` }} /></span>}
      <div className="vs-music-card-actions">
        {track && (
          <button type="button" className="vs-btn" onClick={() => void (async () => toggle(track.key, await track.url()))()} disabled={missing} aria-label={playing ? `暂停试听 ${track.name}` : `试听 ${track.name}`}>
            {missing ? <TriangleAlert size={14} /> : loaded && player.loading ? <Loader2 size={14} className="vm-spin" /> : playing ? <Pause size={14} /> : <Play size={14} />} {missing ? '试听不可用' : playing ? '暂停' : loaded ? '继续' : '试听'}
          </button>
        )}
        <button type="button" className="vs-btn is-primary" onClick={() => { stop(); onOpen() }}><Repeat2 size={14} /> 更换音乐</button>
      </div>
      {track && (
        <>
          <div className="vs-music-volume">
            <label htmlFor="vs-music-volume-card"><Volume2 size={13} /> 音乐音量</label>
            <input id="vs-music-volume-card" type="range" min={0} max={100} step={5} value={volume} onChange={e => onVolume(Number(e.target.value))} aria-valuetext={`${volume}%`} />
            <output htmlFor="vs-music-volume-card">{volume}%</output>
          </div>
          <p className="vs-music-fade">成片会自动片头淡入 1 秒、片尾淡出 1.8 秒，并统一响度。</p>
        </>
      )}
    </div>
  )
}

/** 底部面板：遮罩点击、关闭按钮、Esc 都会关闭；打开时锁住页面滚动。关闭即卸载内容。 */
export function BottomSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="vs-sheet-root">
      <button type="button" className="vs-sheet-scrim" onClick={onClose} aria-label="关闭" tabIndex={-1} />
      <div className="vs-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="vs-sheet-head">
          <i aria-hidden />
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="vs-sheet-body">{children}</div>
      </div>
    </div>
  )
}
