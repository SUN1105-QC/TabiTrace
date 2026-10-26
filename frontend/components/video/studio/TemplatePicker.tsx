'use client'

/**
 * STEP 1 视频模板：模板来自后端目录（目前 3 个）。封面用当前视频的封面照片，套上各模板的版式预览。
 * FREE 旅行点 PRO 模板只提示、不切换；每个模板可以用当前素材看 10 秒风格预览。
 * 移动端是横向滑动的卡片：选中的模板始终完整滚进可见范围；放不下时显示分页圆点（可点击）与左右箭头（鼠标设备）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Lock, Play } from 'lucide-react'
import type { Plan, VideoTemplate } from '@/types/video'
import { PlanBadge, VideoProGate } from '../VideoProGate'

const PACE: Record<string, string> = { SLOW: '舒缓', MEDIUM: '适中', FAST: '明快' }

export function TemplatePicker({ templates, value, plan, cover, onChange, onPreview }: {
  templates: VideoTemplate[]
  value: string
  plan: Plan
  cover?: string
  onChange: (code: string) => void
  onPreview: (code: string) => void
}) {
  const [blocked, setBlocked] = useState<VideoTemplate | null>(null)
  const box = useRef<HTMLDivElement | null>(null)
  const [overflow, setOverflow] = useState(false)
  const [current, setCurrent] = useState(0)

  /** 把第 i 张卡片完整滚进可见范围（只滚动卡片行，不带动整个页面） */
  const reveal = useCallback((i: number, smooth = true) => {
    const el = box.current
    const card = el?.children[i] as HTMLElement | undefined
    if (!el || !card || el.scrollWidth <= el.clientWidth) return
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0
    const b = el.getBoundingClientRect(), c = card.getBoundingClientRect()
    const delta = c.left < b.left + pad ? c.left - b.left - pad : c.right > b.right - pad ? c.right - b.right + pad : 0
    if (delta) el.scrollBy({ left: delta, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  /** 当前停在哪一张：可见面积最大的那张 */
  const sync = useCallback(() => {
    const el = box.current
    if (!el) return
    setOverflow(el.scrollWidth > el.clientWidth + 1)
    const b = el.getBoundingClientRect()
    let best = 0, bestArea = -1
    Array.from(el.children).forEach((node, i) => {
      const r = node.getBoundingClientRect()
      const area = Math.min(r.right, b.right) - Math.max(r.left, b.left)
      if (area > bestArea) { bestArea = area; best = i }
    })
    setCurrent(best)
  }, [])

  // 尺寸变化（旋转屏幕、窗口缩放）时重新判断是否需要滑动
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [sync])

  // 进入页面和切换模板时，让选中的卡片完整可见（首次不做动画）
  const first = useRef(true)
  useEffect(() => {
    const i = templates.findIndex(t => t.code === value)
    if (i < 0) return
    reveal(i, !first.current)
    first.current = false
  }, [value, templates, reveal])

  return (
    <>
      <div ref={box} className="vs-templates" onScroll={sync}
          style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(templates.length, 1))}, minmax(0, 1fr))`, ['--n' as string]: Math.max(templates.length, 1) }}>
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
                    {/* 移动端卡片额外显示成片比例与节奏（桌面端隐藏）：三个模板都支持 9:16 / 4:5 / 16:9 */}
                    <span className="vs-template-meta">9:16 · 4:5 · 16:9 · {PACE[t.pace] ?? '适中'}节奏</span>
                  </span>
                </button>
                <button type="button" className="vs-text-btn vs-template-demo" onClick={() => onPreview(t.code)}>
                  <Play size={11} /> 10 秒预览
                </button>
              </div>
            )
          })}
      </div>
      {overflow && (
        <div className="vs-template-dots" role="group" aria-label="切换查看模板">
          <button type="button" className="vs-templates-arrow" onClick={() => reveal(Math.max(0, current - 1))} disabled={current === 0} aria-label="上一个模板"><ChevronLeft size={15} /></button>
          {templates.map((t, i) => (
            <button key={t.code} type="button" className={`vs-template-dot${i === current ? ' is-active' : ''}${value === t.code ? ' is-picked' : ''}`}
              aria-label={`查看第 ${i + 1} 个模板：${t.name}`} aria-current={i === current} onClick={() => reveal(i)} />
          ))}
          <button type="button" className="vs-templates-arrow" onClick={() => reveal(Math.min(templates.length - 1, current + 1))} disabled={current === templates.length - 1} aria-label="下一个模板"><ChevronRight size={15} /></button>
        </div>
      )}
      {blocked && <VideoProGate message={`「${blocked.name}」是 Trip Pro 模板，Free 旅行可以使用「旅行日记」模板。`} />}
    </>
  )
}
