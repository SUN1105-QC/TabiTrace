'use client'

/**
 * 旅迹音乐（系统曲库）：推荐 · 温暖旅程 · 城市夜色 · 清晨治愈 · Lo-fi · 电影感 · 无音乐。
 * 「为这趟旅行推荐」3 首是规则推荐（utils/video-music），下面是按匹配度排序的其余曲目。
 */

import { useMemo, useState } from 'react'
import { Loader2, RotateCcw, Sparkles, TriangleAlert, VolumeX } from 'lucide-react'
import type { Plan, VideoMusic } from '@/types/video'
import type { MusicPlayerState } from '@/hooks/useMusicPlayer'
import { MUSIC_TABS, rankMusic, type MusicContext, type MusicSelection, type MusicTabKey } from '@/utils/video-music'
import { VideoProGate } from '../VideoProGate'
import { MusicTrackCard } from './MusicTrackCard'

export type MusicLoadState = 'loading' | 'error' | 'ready'

export function MusicCategoryTabs({ value, counts, onChange }: { value: MusicTabKey; counts: Partial<Record<MusicTabKey, number>>; onChange: (k: MusicTabKey) => void }) {
  return (
    <div className="vm-tabs" role="tablist" aria-label="音乐氛围">
      {MUSIC_TABS.map(t => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key} className={value === t.key ? 'is-active' : ''} onClick={() => onChange(t.key)}>
          {t.label}{counts[t.key] != null && t.key !== 'REC' && t.key !== 'NONE' && <small>{counts[t.key]}</small>}
        </button>
      ))}
    </div>
  )
}

export function SystemMusicTab({ music, status, onRetry, selection, plan, context, player, toggle, stop, onChange }: {
  music: VideoMusic[]
  status: MusicLoadState
  onRetry: () => void
  selection: MusicSelection
  plan: Plan
  context: MusicContext
  player: MusicPlayerState
  toggle: (code: string, url: string | null | undefined) => Promise<void>
  stop: () => void
  onChange: (sel: MusicSelection) => void
}) {
  const [tab, setTab] = useState<MusicTabKey>('REC')
  const [gate, setGate] = useState<VideoMusic | null>(null)
  const ranked = useMemo(() => rankMusic(music, context), [music, context])
  const picks = ranked.slice(0, 3)
  const counts = useMemo(() => {
    const c: Partial<Record<MusicTabKey, number>> = {}
    music.forEach(m => { c[m.category] = (c[m.category] ?? 0) + 1 })
    return c
  }, [music])
  const value = selection?.source === 'SYSTEM' ? selection.code : null

  function pick(m: VideoMusic) {
    if (plan === 'FREE' && m.plan === 'PRO') { setGate(m); return }
    setGate(null)
    onChange({ source: 'SYSTEM', code: m.code })
  }
  const card = (m: VideoMusic, reasons?: string[]) => (
    <MusicTrackCard key={m.code} track={m} selected={value === m.code} player={player} reasons={reasons}
      onToggle={() => void toggle(m.code, m.previewUrl)} onSelect={() => pick(m)} />
  )

  let body: React.ReactNode
  if (status === 'loading') body = <p className="vm-state"><Loader2 size={16} className="vm-spin" /> 正在加载旅行音乐…</p>
  else if (status === 'error') body = (
    <div className="vm-state is-error" role="alert">
      <TriangleAlert size={16} /> 音乐加载失败
      <button type="button" className="vs-btn" onClick={onRetry}><RotateCcw size={13} /> 重新加载</button>
    </div>
  )
  else if (tab === 'NONE') body = (
    <button type="button" className={`vm-none${selection == null ? ' is-selected' : ''}`} onClick={() => { stop(); setGate(null); onChange(null) }} aria-pressed={selection == null}>
      <VolumeX size={18} />
      <span><b>{selection == null ? '已选择无音乐' : '不使用背景音乐'}</b><small>成片只有画面与转场，适合之后自己配乐或配音。</small></span>
    </button>
  )
  else if (tab === 'REC') body = music.length === 0 ? <p className="vm-state">这个分类暂时还没有音乐。</p> : (
    <>
      <section className="vm-recommend" aria-label="为这趟旅行推荐">
        <h4><Sparkles size={14} /> 为这趟旅行推荐</h4>
        <ul className="vm-list">{picks.map(x => card(x.m, x.reasons))}</ul>
      </section>
      {ranked.length > 3 && (
        <section aria-label="更多音乐">
          <h4 className="vm-more">更多音乐</h4>
          <ul className="vm-list">{ranked.slice(3).map(x => card(x.m))}</ul>
        </section>
      )}
    </>
  )
  else {
    const list = music.filter(m => m.category === tab)
    body = list.length === 0 ? <p className="vm-state">这个分类暂时还没有音乐。</p> : <ul className="vm-list">{list.map(m => card(m))}</ul>
  }

  return (
    <>
      <MusicCategoryTabs value={tab} counts={counts} onChange={k => { setTab(k); setGate(null) }} />
      {body}
      {gate && <VideoProGate compact message={`「${gate.name}」是 Trip Pro 音乐，可以先试听；Free 旅行可以使用标有 FREE 的音乐。`} />}
    </>
  )
}
