'use client'

/**
 * 「我的音乐」里的一首：试听（与旅迹音乐共用同一个播放器，只会同时播一首）· 名称 · 时长 · 格式与大小 · 上传时间 ·
 * 使用 · 更多（重命名 / 删除）。处理中、处理失败也在这里显示。
 */

import { useState } from 'react'
import { Check, Loader2, MoreHorizontal, Pause, Play, Plus, RotateCcw, TriangleAlert } from 'lucide-react'
import type { MusicPlayerState } from '@/hooks/useMusicPlayer'
import { userMusicKey } from '@/hooks/useUserMusic'
import type { UserMusic } from '@/types/user-music'
import { mb } from '@/services/user-music'
import { clock } from '@/utils/video-music'
import { toDate, zonedParts } from '@/lib/time'

const uploadedOn = (iso: string) => {
  const d = toDate(iso)
  if (!d) return ''
  const p = zonedParts(d)
  return `${p.year}年${p.month}月${p.day}日上传`
}

export function UserMusicCard({ track, selected, canUse, canUpload, player, onToggle, onUse, onRename, onDelete, onReupload }: {
  track: UserMusic
  selected: boolean
  /** 会员有效时才能用于视频（到期后只读） */
  canUse: boolean
  /** 会员有效时才能重新上传（到期后只读） */
  canUpload: boolean
  player: MusicPlayerState
  onToggle: () => void
  onUse: () => void
  onRename: (title: string) => Promise<unknown>
  onDelete: () => void
  onReupload: () => void
}) {
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(track.title)
  const [saving, setSaving] = useState(false)
  const [renameError, setRenameError] = useState('')
  const key = userMusicKey(track.id)
  const loaded = player.code === key
  const playing = loaded && player.playing
  const ready = track.status === 'READY'
  const failedPlay = player.failed.includes(key)
  const total = loaded && player.duration ? player.duration : track.durationSeconds ?? null
  const pct = loaded && total ? Math.min(100, (player.current / total) * 100) : 0

  async function save() {
    const t = name.trim()
    if (!t) { setRenameError('请输入音乐名称'); return }
    setSaving(true); setRenameError('')
    try { await onRename(t); setEditing(false) } catch (e) { setRenameError(e instanceof Error ? e.message : '重命名失败') } finally { setSaving(false) }
  }

  return (
    <li className={`vm-card um-card${selected ? ' is-selected' : ''}${playing ? ' is-playing' : ''}${track.status === 'FAILED' ? ' is-failed' : ''}`}>
      <div className="vm-card-row">
        <button type="button" className="vm-play" onClick={onToggle} disabled={!ready || failedPlay}
          aria-label={!ready ? `${track.title} 暂时不能试听` : playing ? `暂停试听 ${track.title}` : `试听 ${track.title}`}>
          {track.status === 'PROCESSING' || track.status === 'UPLOADING' || (loaded && player.loading)
            ? <Loader2 size={16} className="vm-spin" />
            : !ready || failedPlay ? <TriangleAlert size={16} /> : playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="vm-main um-main">
          {editing ? (
            <span className="um-rename">
              <input value={name} maxLength={60} onChange={e => setName(e.target.value)} aria-label="音乐名称" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') { setEditing(false); setName(track.title) } }} />
              <button type="button" className="vs-btn is-primary" onClick={() => void save()} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
              <button type="button" className="vs-btn" onClick={() => { setEditing(false); setName(track.title); setRenameError('') }}>取消</button>
            </span>
          ) : (
            <span className="vm-title"><b>{track.title}</b></span>
          )}
          <span className="vm-sub">{[track.format, mb(track.fileSize), uploadedOn(track.createdAt)].filter(Boolean).join(' · ')}</span>
          {track.status === 'PROCESSING' || track.status === 'UPLOADING' ? <span className="um-state">正在处理音乐…</span> : null}
          {track.status === 'FAILED' && <span className="vm-error">音乐处理失败：{track.failureMessage ?? '请重新上传'}</span>}
          {failedPlay && <span className="vm-error">这首音乐暂时无法试听</span>}
          {renameError && <span className="vm-error">{renameError}</span>}
        </div>
        <span className="vm-side">
          <time>{loaded ? `${clock(player.current)} / ${clock(total)}` : clock(track.durationSeconds)}</time>
        </span>
      </div>
      {loaded && <span className="vm-progress" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
      <div className="um-actions">
        {track.status === 'FAILED'
          ? canUpload && <button type="button" className="vs-btn" onClick={onReupload}><RotateCcw size={14} /> 重新上传</button>
          : <button type="button" className={`vs-btn${selected ? ' is-selected' : ' is-primary'}`} onClick={onUse} disabled={!ready || !canUse || selected} aria-pressed={selected}>
              {selected ? <><Check size={14} /> 已使用</> : <><Plus size={14} /> 使用</>}
            </button>}
        <span className="um-more">
          <button type="button" className="vs-btn um-more-btn" onClick={() => setMenu(v => !v)} aria-expanded={menu} aria-label={`更多操作：${track.title}`}><MoreHorizontal size={16} /></button>
          {menu && (
            <span className="um-menu" role="menu">
              {canUse && track.status !== 'FAILED' && <button type="button" role="menuitem" onClick={() => { setMenu(false); setEditing(true) }}>重命名</button>}
              <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenu(false); onDelete() }}>删除</button>
            </span>
          )}
        </span>
      </div>
    </li>
  )
}
