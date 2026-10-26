'use client'

/**
 * 一首旅行音乐：试听按钮（≥ 44px）· 曲名 · 艺术家 · 氛围标签 · 时长 / 试听进度 · FREE / PRO · 授权标签。
 * 点卡片主体选中；点授权标签展开授权详情（协议、来源、署名、能否商用 / 改编）。
 */

import { useState } from 'react'
import { ExternalLink, Loader2, Pause, Play, TriangleAlert } from 'lucide-react'
import type { VideoMusic } from '@/types/video'
import type { MusicPlayerState } from '@/hooks/useMusicPlayer'
import { MUSIC_CATEGORY_LABEL, clock, licenseTag, moodLabels } from '@/utils/video-music'
import { PlanBadge } from '../VideoProGate'

export function MusicLicenseInfo({ track }: { track: VideoMusic }) {
  return (
    <dl className="vm-license">
      <div><dt>授权协议</dt><dd>{track.licenseUrl ? <a href={track.licenseUrl} target="_blank" rel="noopener noreferrer">{track.license}<ExternalLink size={11} aria-hidden="true" /></a> : track.license ?? '—'}</dd></div>
      {track.source && <div><dt>来源</dt><dd>{track.sourceUrl ? <a href={track.sourceUrl} target="_blank" rel="noopener noreferrer">{track.source}<ExternalLink size={11} aria-hidden="true" /></a> : track.source}</dd></div>}
      <div><dt>使用范围</dt><dd>{[track.commercialUse ? '可商用' : '不可商用', track.derivativesAllowed ? '可剪辑改编' : '不可改编'].join(' · ')}</dd></div>
      <div><dt>署名</dt><dd>{track.attributionRequired ? <>需要署名：成片片尾会自动注明；发布到 YouTube 等平台时请把署名贴进描述。<em>{track.attributionText}</em></> : '不需要署名'}</dd></div>
    </dl>
  )
}

export function MusicTrackCard({ track, selected, player, reasons, onToggle, onSelect }: {
  track: VideoMusic
  selected: boolean
  player: MusicPlayerState
  /** 推荐理由（只在「为这趟旅行推荐」里显示） */
  reasons?: string[]
  onToggle: () => void
  onSelect: () => void
}) {
  const [license, setLicense] = useState(false)
  const loaded = player.code === track.code
  const playing = loaded && player.playing
  const loading = loaded && player.loading
  const failed = player.failed.includes(track.code) || !track.previewUrl
  const total = loaded && player.duration ? player.duration : null
  const pct = loaded && total ? Math.min(100, (player.current / total) * 100) : 0
  const tags = [MUSIC_CATEGORY_LABEL[track.category], ...moodLabels(track).filter(x => x !== MUSIC_CATEGORY_LABEL[track.category]).slice(0, 2)].filter(Boolean)

  return (
    <li className={`vm-card${selected ? ' is-selected' : ''}${playing ? ' is-playing' : ''}`}>
      <div className="vm-card-row">
        <button type="button" className="vm-play" onClick={onToggle} disabled={failed}
          aria-label={failed ? `${track.name} 暂时无法试听` : playing ? `暂停试听 ${track.name}` : `试听 ${track.name}`}>
          {failed ? <TriangleAlert size={16} /> : loading ? <Loader2 size={16} className="vm-spin" /> : playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button type="button" className="vm-main" onClick={onSelect} aria-pressed={selected}>
          <span className="vm-title"><b>{track.name}</b><PlanBadge plan={track.plan} /></span>
          <span className="vm-sub">{track.artist}{tags.length > 0 && <> · {tags.join(' · ')}</>}</span>
          {reasons && reasons.length > 0 && <span className="vm-reasons">{reasons.map(r => <i key={r}>{r}</i>)}</span>}
          {failed && <span className="vm-error">这首音乐暂时无法试听</span>}
        </button>
        <span className="vm-side">
          <time>{loaded ? `${clock(player.current)} / ${clock(total ?? track.durationSeconds)}` : clock(track.durationSeconds)}</time>
          <button type="button" className={`vm-license-tag${license ? ' is-open' : ''}`} onClick={() => setLicense(v => !v)} aria-expanded={license}>{licenseTag(track)}</button>
        </span>
      </div>
      {loaded && <span className="vm-progress" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
      {license && <MusicLicenseInfo track={track} />}
    </li>
  )
}
