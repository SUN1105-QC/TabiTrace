'use client'

/**
 * 「我的音乐」：个人旅行歌单。
 * - 未开通会员：锁定卡片（说明权益 + 开通会员），下面仍可以继续使用旅迹免费音乐
 * - 会员：上传音乐（全宽按钮）· 用量 · 歌单（试听 / 使用 / 重命名 / 删除）· 空状态
 * - 会员到期：只读（可以查看、试听、删除，不能上传和用于新视频）+ 续费提示
 */

import { useState } from 'react'
import { Loader2, Music4, Plus, RotateCcw, TriangleAlert } from 'lucide-react'
import type { MusicPlayerState } from '@/hooks/useMusicPlayer'
import { useUserMusic, userMusicKey } from '@/hooks/useUserMusic'
import { mb } from '@/services/user-music'
import type { MusicSelection } from '@/utils/video-music'
import { MembershipGate } from '@/components/membership/MembershipGate'
import { UploadMusicDialog } from './UploadMusicDialog'
import { UserMusicCard } from './UserMusicCard'

export function UserMusicTab({ selection, player, toggle, stop, onSelect, onDeselect, onBrowseSystem }: {
  selection: MusicSelection
  player: MusicPlayerState
  toggle: (code: string, url: string | null | undefined) => Promise<void>
  stop: () => void
  onSelect: (id: number) => void
  /** 正在使用的音乐被删除时，草稿保留引用并提示重新选择；这里只用来停掉试听 */
  onDeselect?: () => void
  onBrowseSystem: () => void
}) {
  const { status, library, error, reload, rename, remove, uploaded, playUrl } = useUserMusic()
  const [uploading, setUploading] = useState(false)
  const [actionError, setActionError] = useState('')

  async function play(id: number) {
    // 试听地址是限时签名地址（有缓存）；同一首再点就是暂停 / 继续
    try { await toggle(userMusicKey(id), await playUrl(id)) } catch (e) { setActionError(e instanceof Error ? e.message : '试听失败') }
  }

  async function del(id: number, title: string) {
    if (!window.confirm(`删除「${title}」？\n已经生成的视频不受影响；正在使用它的草稿需要重新选择音乐。`)) return
    setActionError('')
    if (player.code === userMusicKey(id)) stop()
    try {
      await remove(id)
      if (selection?.source === 'USER' && selection.id === id) onDeselect?.()
    } catch (e) { setActionError(e instanceof Error ? e.message : '删除失败，请稍后再试') }
  }

  if (status === 'loading' || (status === 'idle' && !library)) return <p className="vm-state"><Loader2 size={16} className="vm-spin" /> 正在读取我的音乐…</p>
  if (status === 'error' || !library) {
    return (
      <div className="vm-state is-error" role="alert">
        <TriangleAlert size={16} /> 我的音乐加载失败{error ? `：${error}` : ''}
        <button type="button" className="vs-btn" onClick={() => void reload()}><RotateCcw size={13} /> 重新加载</button>
      </div>
    )
  }

  const { membership, canUpload, canUse, limits, usage, items } = library
  const selectedId = selection?.source === 'USER' ? selection.id : null

  return (
    <div className="um-tab">
      <div className="um-intro">
        <h4>我的音乐</h4>
        <p>你上传的声音，也可以成为旅途的一部分。</p>
      </div>
      <MembershipGate feature="CUSTOM_MUSIC" membership={membership} readOnlyChildren
        footer={<button type="button" className="um-link" onClick={onBrowseSystem}>继续使用旅迹免费音乐 →</button>}>
        {canUpload && !uploading && (
          <button type="button" className="vs-btn is-primary um-add" onClick={() => setUploading(true)}>
            <Plus size={16} /> 上传音乐
          </button>
        )}
        {canUpload && <p className="um-usage">{usage.tracks} / {limits.maxTracks} 首 · 已用 {mb(usage.bytes)} / {mb(limits.maxTotalBytes)}</p>}
        {uploading && <UploadMusicDialog limits={limits} onClose={() => setUploading(false)} onDone={() => void uploaded()} />}
        {actionError && <p className="vm-warn" role="alert"><TriangleAlert size={13} /> {actionError}</p>}

        {items.length === 0 && !uploading && (
          canUpload ? (
            <div className="um-empty">
              <span aria-hidden="true"><Music4 size={26} /></span>
              <b>还没有自己的音乐</b>
              <p>上传一首喜欢的音乐，让它陪你记录这趟旅行。</p>
              <button type="button" className="vs-btn is-primary" onClick={() => setUploading(true)}><Plus size={14} /> 上传第一首音乐</button>
            </div>
          ) : <p className="vm-state">还没有上传过音乐。</p>
        )}
        {items.length > 0 && (
          <ul className="vm-list um-list">
            {items.map(m => (
              <UserMusicCard key={m.id} track={m} selected={selectedId === m.id} canUse={canUse} canUpload={canUpload} player={player}
                onToggle={() => void play(m.id)}
                onUse={() => onSelect(m.id)}
                onRename={t => rename(m.id, t)}
                onDelete={() => void del(m.id, m.title)}
                onReupload={() => { void remove(m.id); setUploading(true) }} />
            ))}
          </ul>
        )}
      </MembershipGate>
    </div>
  )
}
