'use client'

/**
 * STEP 1 视频模板：模板来自后端目录（目前 3 个）。封面用当前视频的封面照片，套上各模板的版式预览。
 * FREE 旅行点 PRO 模板只提示、不切换；每个模板可以用当前素材看 10 秒风格预览。
 */

import { useState } from 'react'
import { Check, Lock, Play } from 'lucide-react'
import type { Plan, VideoTemplate } from '@/types/video'
import { PlanBadge, VideoProGate } from '../VideoProGate'

export function TemplatePicker({ templates, value, plan, cover, onChange, onPreview }: {
  templates: VideoTemplate[]
  value: string
  plan: Plan
  cover?: string
  onChange: (code: string) => void
  onPreview: (code: string) => void
}) {
  const [blocked, setBlocked] = useState<VideoTemplate | null>(null)
  return (
    <>
      <div className="vs-templates" style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(templates.length, 1))}, minmax(0, 1fr))` }}>
        {templates.map(t => {
          const selected = value === t.code
          const locked = plan === 'FREE' && t.plan === 'PRO'
          return (
            <div key={t.code} className={`vs-template${selected ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`}>
              <button type="button" className="vs-template-pick" aria-pressed={selected}
                onClick={() => { if (locked) { setBlocked(t); return } setBlocked(null); onChange(t.code) }}>
                <span className={`vs-template-cover tpl-${t.code.toLowerCase()}`}>
                  {cover && <img src={cover} alt="" />}
                  <span className="vs-template-cover-text">
                    <small>{t.englishName.toUpperCase()}</small>
                    <b>{t.name}</b>
                  </span>
                  {selected && <span className="vs-template-check"><Check size={13} strokeWidth={3} /></span>}
                  {locked && <span className="vs-template-lock"><Lock size={12} /></span>}
                </span>
                <span className="vs-template-body">
                  <span className="vs-template-name">
                    <b>{t.name}</b>
                    <PlanBadge plan={t.plan} />
                  </span>
                  <em>{t.englishName.toUpperCase()}</em>
                  <small>{t.description}</small>
                </span>
              </button>
              <button type="button" className="vs-text-btn vs-template-demo" onClick={() => onPreview(t.code)}>
                <Play size={11} /> 10 秒预览
              </button>
            </div>
          )
        })}
      </div>
      {blocked && <VideoProGate message={`「${blocked.name}」是 Trip Pro 模板，Free 旅行可以使用「旅行日记」模板。`} />}
    </>
  )
}
