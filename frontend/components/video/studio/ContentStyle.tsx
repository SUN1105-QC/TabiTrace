'use client'

/**
 * STEP 3 内容与风格：左边是标题、结束语与信息显示开关，右边是视觉风格（成片调色）。
 * 开关缺数据时由后端分镜自动跳过（例如没有记录天气）；路线动画 Free 为简洁路线图，Pro 可逐站延伸。
 */

import { useState } from 'react'
import type { MapMode, Plan, StorySettings, VisualStyle } from '@/types/video'
import { VISUAL_STYLES } from '@/utils/video-studio'
import { VideoProGate } from '../VideoProGate'

type BoolKey = 'showDate' | 'showPlaceNames' | 'showWeather' | 'showCheckinText' | 'showStats' | 'showAchievements' | 'showEnding'

const TOGGLES: { key: BoolKey; label: string }[] = [
  { key: 'showDate', label: '旅行日期' },
  { key: 'showPlaceNames', label: '地点名称' },
  { key: 'showWeather', label: '天气' },
  { key: 'showCheckinText', label: '旅行文字' },
  { key: 'showStats', label: '旅行数据' },
  { key: 'showAchievements', label: '旅行成就' },
  { key: 'showEnding', label: '片尾' }
]

export function ContentStyle({ value, plan, tripTitle, cover, onChange }: {
  value: StorySettings
  plan: Plan
  tripTitle: string
  cover?: string
  onChange: (next: StorySettings) => void
}) {
  const [mapGate, setMapGate] = useState(false)
  const set = (patch: Partial<StorySettings>) => onChange({ ...value, ...patch })
  const mapOn = value.mapMode !== 'OFF'
  const style = value.visualStyle ?? 'NATURAL'

  function setMap(mode: MapMode) {
    if (mode === 'FULL' && plan === 'FREE') { setMapGate(true); return }
    setMapGate(false)
    set({ mapMode: mode })
  }

  return (
    <div className="vs-content">
      <div className="vs-content-col">
        <label className="vs-field">
          <span>视频标题</span>
          <input value={value.title ?? ''} maxLength={60} placeholder={tripTitle} onChange={e => set({ title: e.target.value || null })} />
        </label>
        <label className="vs-field">
          <span>结束语 <small>显示在片尾</small></span>
          <input value={value.endingText ?? ''} maxLength={60} placeholder="例如：东京，下次再见。" onChange={e => set({ endingText: e.target.value || null })} />
        </label>

        <p className="vs-label">信息显示</p>
        <div className="vs-toggles">
          {TOGGLES.map(t => (
            <label key={t.key} className="vs-toggle">
              <span>{t.label}</span>
              <input type="checkbox" className="vs-switch" checked={Boolean(value[t.key])} onChange={e => set({ [t.key]: e.target.checked })} />
            </label>
          ))}
          <label className="vs-toggle">
            <span>路线动画</span>
            <input type="checkbox" className="vs-switch" checked={mapOn} onChange={e => setMap(e.target.checked ? (plan === 'PRO' ? 'FULL' : 'SIMPLE') : 'OFF')} />
          </label>
        </div>
        {mapOn && (
          <div className="vs-mini-seg" role="radiogroup" aria-label="路线动画样式">
            <button type="button" role="radio" aria-checked={value.mapMode === 'SIMPLE'} className={value.mapMode === 'SIMPLE' ? 'is-active' : ''} onClick={() => setMap('SIMPLE')}>简洁路线图</button>
            <button type="button" role="radio" aria-checked={value.mapMode === 'FULL'} className={value.mapMode === 'FULL' ? 'is-active' : ''} onClick={() => setMap('FULL')}>逐站延伸 <em>PRO</em></button>
          </div>
        )}
        {mapGate && <VideoProGate compact message="逐站延伸的路线动画需要 Trip Pro，Free 旅行可以使用简洁路线图。" />}
      </div>

      <div className="vs-content-col">
        <p className="vs-label">视觉风格 <small>会应用到整支成片的色调</small></p>
        <div className="vs-styles" role="radiogroup" aria-label="视觉风格">
          {VISUAL_STYLES.map(s => (
            <button key={s.code} type="button" role="radio" aria-checked={style === s.code}
              className={`vs-style${style === s.code ? ' is-selected' : ''}`} onClick={() => set({ visualStyle: s.code as VisualStyle })}>
              <span className={`vs-style-img grade-${s.code.toLowerCase()}`}>
                {cover ? <img src={cover} alt="" style={{ filter: s.filter }} /> : <i />}
              </span>
              <b>{s.name}</b>
              <small>{s.desc}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
