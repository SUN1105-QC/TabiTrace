'use client'

/**
 * 搜索框：输入时只更新本地显示，停顿 250ms 后才把关键词交给页面筛选（不随每个字符刷新列表）。
 * 回车直接跳到「全部地点」看结果；清空按钮同时清掉筛选关键词。
 */

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

export const SEARCH_DEBOUNCE_MS = 250

export function ExploreSearch({ value, onChange, onSubmit }: { value: string; onChange: (q: string) => void; onSubmit: () => void }) {
  const [text, setText] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 外部清空（例如「清除筛选」）时同步输入框
  const [synced, setSynced] = useState(value)
  if (value !== synced) { setSynced(value); setText(value) }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const update = (next: string) => {
    setText(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(next.trim()), SEARCH_DEBOUNCE_MS)
  }

  return (
    <form className="xp-search" role="search" onSubmit={e => { e.preventDefault(); if (timer.current) clearTimeout(timer.current); onChange(text.trim()); onSubmit() }}>
      <Search size={17} aria-hidden="true" />
      <input type="search" value={text} onChange={e => update(e.target.value)} placeholder="搜索地点、区域或关键词…" aria-label="搜索地点、区域或关键词" enterKeyHint="search" />
      {text && <button type="button" className="xp-search-clear" onClick={() => { update(''); onChange('') }} aria-label="清空搜索"><X size={15} /></button>}
    </form>
  )
}
