'use client'

/**
 * 轻量的创作流程导航：01 模板 → 05 生成。
 * 当前步骤（滚动到的那一张卡）用橙色编号，已完成的步骤显示小勾；点击跳到对应卡片。
 */

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

export type StepItem = { id: string; label: string; done: boolean }

/**
 * 以视口上部 1/3 处为准，判断正在看的是哪一张步骤卡。
 * spy = false（移动端分步模式）时不跟随滚动，当前步骤只由导航和底部「上一步 / 下一步」切换。
 */
export function useActiveStep(ids: string[], spy = true) {
  const [active, setActive] = useState(ids[0])
  const key = ids.join('|')
  useEffect(() => {
    if (!spy) return
    const visible = new Map<string, boolean>()
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => visible.set(e.target.id, e.isIntersecting))
      const first = key.split('|').find(id => visible.get(id))
      if (first) setActive(first)
    }, { rootMargin: '-28% 0px -62% 0px' })
    key.split('|').forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [key, spy])
  return [active, setActive] as const
}

export function StudioSteps({ steps, active, onJump }: { steps: StepItem[]; active: string; onJump: (id: string) => void }) {
  const nav = useRef<HTMLElement | null>(null)
  // 横向滚动时让当前步骤保持在可见范围内（移动端导航放不下五步）
  useEffect(() => {
    const box = nav.current
    const el = box?.querySelector<HTMLElement>('[aria-current="step"]')
    if (!box || !el || box.scrollWidth <= box.clientWidth) return
    const left = el.offsetLeft - box.offsetLeft
    if (left < box.scrollLeft || left + el.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollTo({ left: Math.max(0, left - 24), behavior: 'smooth' })
  }, [active])
  return (
    <nav ref={nav} className="vs-steps" aria-label="创作步骤">
      {steps.map((s, i) => {
        const current = s.id === active
        return (
          <button key={s.id} type="button" onClick={() => onJump(s.id)} aria-current={current ? 'step' : undefined}
            className={`vs-steps-item${current ? ' is-active' : ''}${s.done ? ' is-done' : ''}`}>
            <span className="vs-steps-no">{s.done && !current ? <Check size={11} strokeWidth={3} /> : String(i + 1).padStart(2, '0')}</span>
            <b>{s.label}</b>
          </button>
        )
      })}
    </nav>
  )
}
