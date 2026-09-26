'use client'

/**
 * STEP 5 准备生成：一行简洁摘要 + 预计时间 + 可选的分镜段落调整，
 * 底部左侧「保存草稿」，右侧页面上层级最高的「生成旅行视频」。
 */

import { useState, type ReactNode } from 'react'
import { ChevronDown, Clock3, Save, Sparkles, TriangleAlert } from 'lucide-react'

export function GeneratePanel({ items, blocker, busy, saving, editingDraft, storyboard, onSave, onGenerate }: {
  items: string[]
  blocker: string
  busy: boolean
  saving: boolean
  editingDraft: boolean
  storyboard: ReactNode
  onSave: () => void
  onGenerate: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="vs-generate">
      <ul className="vs-generate-summary">
        {items.map(i => <li key={i}>{i}</li>)}
      </ul>
      <p className="vs-generate-eta"><Clock3 size={13} /> 预计生成时间约 1～3 分钟，生成时可以离开页面，完成后会出现在「我的视频」。</p>

      <div className="vs-disclosure">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <ChevronDown size={14} className={open ? 'is-open' : ''} /> 调整分镜段落 <small>可选 · 调整开场、地图、地点、结尾的顺序与标题</small>
        </button>
        {open && <div className="vs-disclosure-body">{storyboard}</div>}
      </div>

      {blocker && <p className="vs-blocker"><TriangleAlert size={14} /> {blocker}</p>}

      <div className="vs-generate-actions">
        <button type="button" className="vs-btn" onClick={onSave} disabled={saving || busy}>
          <Save size={14} /> {saving ? '保存中…' : editingDraft ? '更新草稿' : '保存草稿'}
        </button>
        <button type="button" className="vs-btn is-primary is-big" onClick={onGenerate} disabled={Boolean(blocker) || busy}>
          <Sparkles size={16} /> {busy ? '正在提交…' : '生成旅行视频'}
        </button>
      </div>
    </div>
  )
}
