'use client'

/**
 * 「音乐与氛围」：用旅迹精选的音乐，或者带上属于你自己的声音。
 * - 一级入口：旅迹音乐（系统曲库，免费精选）｜ 我的音乐（会员上传；未开通也能进入，看到锁定说明）
 * - 试听：整页共用一个音频（useMusicPlayer），同一时间只播一首，旅迹音乐与我的音乐互相切换也一样
 * - 无音乐是正式选项：选择为 null，成片跳过混音
 * - 选择只记录来源 + 代码 / id，不保存音乐地址；会员、套餐、主人校验后端都会再做一次
 */

import { useEffect, useState } from 'react'
import { Lock, TriangleAlert, Volume2 } from 'lucide-react'
import type { Plan, VideoMusic } from '@/types/video'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'
import { useUserMusic } from '@/hooks/useUserMusic'
import { hasFeature } from '@/utils/membership'
import { selectionLabel, selectionProblem, type MusicContext, type MusicSelection } from '@/utils/video-music'
import { SystemMusicTab, type MusicLoadState } from './SystemMusicTab'
import { UserMusicTab } from './UserMusicTab'

export type { MusicLoadState } from './SystemMusicTab'
type SourceTab = 'SYSTEM' | 'USER'

export function MusicSelector({ music, status, onRetry, selection, plan, context, volume, onVolume, onChange }: {
  music: VideoMusic[]
  status: MusicLoadState
  onRetry: () => void
  /** 当前选择；null = 无音乐 */
  selection: MusicSelection
  plan: Plan
  context: MusicContext
  volume: number
  onVolume: (v: number) => void
  onChange: (sel: MusicSelection) => void
}) {
  const { state: player, toggle, stop, setVolume } = useMusicPlayer()
  const mine = useUserMusic()
  const [source, setSource] = useState<SourceTab>(selection?.source === 'USER' ? 'USER' : 'SYSTEM')
  useEffect(() => { setVolume(volume) }, [volume, setVolume])
  // 选择器卸载（关闭手机底部面板、离开视频页）时停止试听，即使「当前音乐」卡片还在页面上
  useEffect(() => () => stop(), [stop])

  const member = hasFeature(mine.library?.membership, 'CUSTOM_MUSIC')
  const selectedSystem = selection?.source === 'SYSTEM' ? music.find(m => m.code === selection.code) ?? null : null
  const selectedMine = selection?.source === 'USER' ? mine.library?.items.find(m => m.id === selection.id) ?? null : null
  const problem = selectionProblem(selection, { music, musicReady: status === 'ready', plan, mine: mine.library })
  const hasMusic = !!selectedSystem || !!selectedMine

  return (
    <div className="vm-selector">
      <div className="vm-head">
        <h3>音乐与氛围</h3>
        <span className="vm-current">{selection == null ? '无音乐' : `已选：${selectionLabel(selection, music, mine.library?.items ?? null)}`}</span>
      </div>
      <p className="vm-tagline">用旅迹精选的音乐，或者带上属于你自己的声音。</p>

      <div className="vm-source" role="tablist" aria-label="音乐来源">
        <button type="button" role="tab" aria-selected={source === 'SYSTEM'} className={source === 'SYSTEM' ? 'is-active' : ''} onClick={() => setSource('SYSTEM')}>旅迹音乐</button>
        <button type="button" role="tab" aria-selected={source === 'USER'} className={source === 'USER' ? 'is-active' : ''} onClick={() => setSource('USER')}>
          我的音乐{!member && mine.status === 'ready' && <Lock size={12} aria-label="会员专属" />}
        </button>
      </div>

      {problem && <p className="vm-warn" role="alert"><TriangleAlert size={13} /> {problem}{/已下架|已被删除/.test(problem) ? '。已生成的视频不受影响。' : ''}</p>}

      {source === 'SYSTEM'
        ? <SystemMusicTab music={music} status={status} onRetry={onRetry} selection={selection} plan={plan} context={context}
            player={player} toggle={toggle} stop={stop} onChange={onChange} />
        : <UserMusicTab selection={selection} player={player} toggle={toggle} stop={stop}
            onSelect={id => onChange({ source: 'USER', id })} onBrowseSystem={() => setSource('SYSTEM')} />}

      {hasMusic && (
        <div className="vs-music-volume">
          <label htmlFor="vm-volume"><Volume2 size={13} /> 音乐音量</label>
          <input id="vm-volume" type="range" min={0} max={100} step={5} value={volume} onChange={e => onVolume(Number(e.target.value))} aria-valuetext={`${volume}%`} />
          <output htmlFor="vm-volume">{volume}%</output>
        </div>
      )}
      {hasMusic && <p className="vm-note">成片会自动统一响度，片头淡入 1 秒、片尾淡出 1.8 秒；音乐比视频短时自动循环。</p>}
      {selectedSystem?.attributionRequired && (
        <p className="vs-music-credit">
          「{selectedSystem.name}」由 {selectedSystem.artist} 以 {selectedSystem.license} 授权：生成的视频会在片尾注明作者；发布到 YouTube 等平台时，请把完成页提供的署名贴进视频描述。
        </p>
      )}
      {selectedMine && <p className="vs-music-credit">「{selectedMine.title}」是你上传的音乐，只用于你自己的旅行视频；请确保你拥有它的使用授权。</p>}
    </div>
  )
}
