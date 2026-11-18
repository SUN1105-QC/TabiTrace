'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import type { TripView } from '@/services/tabitrace-api'

/** 标题和菜单分别设置字号；菜单放到顶层，避免被旅行横幅的裁切区域挡住。 */
export function HomeTripSwitcher({ trip, trips, onSelect }: { trip: TripView; trips: TripView[]; onSelect: (id: number) => void }) {
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const label = (row: TripView) => `${row.title}${row.status === 'ARCHIVED' ? ' · 已归档' : ''}`

  function close(restoreFocus = false) {
    setPosition(null)
    if (restoreFocus) trigger.current?.focus()
  }
  function open(last = false) {
    const rect = trigger.current!.getBoundingClientRect()
    const width = Math.min(Math.max(rect.width, 320), 480, innerWidth - 32)
    const below = innerHeight - rect.bottom - 24
    const above = below < 180 && rect.top > below
    const maxHeight = Math.max(80, Math.min(320, above ? rect.top - 24 : below))
    setPosition({ left: Math.max(16, Math.min(rect.left, innerWidth - width - 16)), top: above ? rect.top - maxHeight - 8 : rect.bottom + 8, width, maxHeight })
    requestAnimationFrame(() => {
      const options = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
      const selected = trips.findIndex(row => row.id === trip.id)
      options?.[last ? options.length - 1 : Math.max(0, selected)]?.focus()
    })
  }
  useEffect(() => {
    if (!position) return
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setPosition(null)
    }
    // 页面滚动或尺寸变化后收起，避免浮层停留在旧标题位置。
    const dismiss = (e: Event) => { if (!menu.current?.contains(e.target as Node)) setPosition(null) }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [position])

  function navigate(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return }
    if (e.key === 'Tab') { close(true); return }
    const options = [...menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')]
    const current = options.indexOf(document.activeElement as HTMLButtonElement)
    let next = current
    if (e.key === 'ArrowDown') next = (current + 1) % options.length
    else if (e.key === 'ArrowUp') next = (current - 1 + options.length) % options.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    else return
    e.preventDefault()
    options[next]?.focus()
  }

  if (trips.length < 2) return <h2 className="hw-trip-single">{trip.title}</h2>
  return <>
    <div className="hw-trip-title hw-trip-native">
      <label className="sr-only" htmlFor="hw-trip">切换旅行</label>
      <span className="hw-trip-mobile-title" aria-hidden="true">{trip.title}</span>
      <select id="hw-trip" value={trip.id} onChange={e => onSelect(Number(e.target.value))}>
        {trips.map(row => <option key={row.id} value={row.id}>{label(row)}</option>)}
      </select>
      <ChevronDown size={20} aria-hidden="true" />
    </div>
    <div className="hw-trip-title hw-trip-desktop">
      <button ref={trigger} className="hw-trip-trigger" type="button" aria-label={`切换旅行，当前：${trip.title}`} aria-haspopup="menu" aria-expanded={!!position} aria-controls={position ? id : undefined} onClick={() => position ? close() : open()} onKeyDown={e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(e.key === 'ArrowUp') }
      }}>
        <span title={trip.title}>{trip.title}</span><ChevronDown size={20} aria-hidden="true" />
      </button>
    </div>
    {position && createPortal(<div ref={menu} id={id} role="menu" aria-label="切换旅行" className="hw-trip-menu" style={position} onKeyDown={navigate}>
      <p className="hw-trip-menu-label">切换旅行 · {trips.length} 段旅程</p>
      {trips.map(row => <button key={row.id} type="button" role="menuitemradio" aria-checked={row.id === trip.id} onClick={() => {
        close(true)
        if (row.id !== trip.id) onSelect(row.id)
      }}>
        <span>{label(row)}</span><Check size={16} aria-hidden="true" style={{ visibility: row.id === trip.id ? 'visible' : 'hidden' }} />
      </button>)}
    </div>, document.body)}
  </>
}
