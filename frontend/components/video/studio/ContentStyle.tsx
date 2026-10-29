'use client'

/**
 * STEP 3 内容与风格：左边是标题、结束语与信息显示开关，右边是视觉风格（成片调色）。
 * 开关缺数据时由后端分镜自动跳过（例如没有记录天气）。
 * section（移动端）：只渲染其中一块 —— text 基础文案 / display 画面信息 / style 视频风格；桌面为 all。
 */

import type { StorySettings, VisualStyle } from '@/types/video'
import { VISUAL_STYLES } from '@/utils/video-studio'

export type ContentSection = 'all' | 'text' | 'display' | 'style'
type BoolKey = 'showDate' | 'showPlaceNames' | 'showWeather' | 'showCheckinText' | 'showStats' | 'showEnding'

const TOGGLES: { key: BoolKey; label: string; desc: string; real: boolean }[] = [
  { key: 'showDate', label: '旅行日期', desc: '开场日期与每个地点的时间', real: true },
  { key: 'showPlaceNames', label: '地点名称', desc: '每段照片上的地点标题', real: true },
  { key: 'showWeather', label: '天气', desc: '打卡时记录的天气（有记录才显示）', real: true },
  { key: 'showCheckinText', label: '旅行文字', desc: '打卡时写下的文字', real: true },
  { key: 'showStats', label: '旅行数据', desc: '片尾的地点数与照片数', real: true },
  { key: 'showEnding', label: '片尾', desc: '结尾画面与结束语', real: true }
]

export function ContentStyle({ value, tripTitle, cover, section = 'all', onChange }: {
  value: StorySettings
  section?: ContentSection
  tripTitle: string
  cover?: string
  onChange: (next: StorySettings) => void
}) {
  const set = (patch: Partial<StorySettings>) => onChange({ ...value, ...patch })
  const style = value.visualStyle ?? 'NATURAL'

  const all = section === 'all'
  const text = (
    <>
        <label className="vs-field">
          <span>视频标题</span>
          <input value={value.title ?? ''} maxLength={60} placeholder={tripTitle} onChange={e => set({ title: e.target.value || null })} />
        </label>
        <label className="vs-field">
          <span>结束语 <small>显示在片尾</small></span>
          <input value={value.endingText ?? ''} maxLength={60} placeholder="例如：东京，下次再见。" onChange={e => set({ endingText: e.target.value || null })} />
        </label>
    </>
  )
  const display = (
    <>
        {all && <p className="vs-label">信息显示</p>}
        <div className="vs-toggles">
          {TOGGLES.filter(t => all || t.real).map(t => (
            <label key={t.key} className="vs-toggle">
              <span>{t.label}{!all && <small>{t.desc}</small>}</span>
              <input type="checkbox" className="vs-switch" checked={Boolean(value[t.key])} onChange={e => set({ [t.key]: e.target.checked })} />
            </label>
          ))}
        </div>
    </>
  )
  const styles = (
    <>
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
    </>
  )

  if (!all) return <div className={`vs-content is-${section}`}>{section === 'text' ? text : section === 'display' ? display : styles}</div>
  return (
    <div className="vs-content">
      <div className="vs-content-col">
        {text}
        {display}
      </div>
      <div className="vs-content-col">
        {styles}
      </div>
    </div>
  )
}
