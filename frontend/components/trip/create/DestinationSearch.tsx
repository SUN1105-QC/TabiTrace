'use client'

/**
 * 目的地搜索（combobox）：输入后 250ms 防抖请求，新请求会取消上一次；
 * 结果来自目的地库，列表末尾始终可以“直接使用输入的名称”，因此任何城市都能创建。
 * 失焦时：输入与某个结果同名则选中它，否则按输入的名称作为自定义目的地。
 */

import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin, Search, Sparkles, X } from 'lucide-react'
import { destinationApi, type DestinationView } from '@/services/tabitrace-api'
import { customDestination, fromDestination, type PickedDestination } from '@/utils/journey'

export function DestinationSearch({ id, value, onChange, error }: { id: string; value: PickedDestination | null; onChange: (d: PickedDestination | null) => void; error?: string }) {
  const listId = useId()
  const [query, setQuery] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<DestinationView[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(-1)
  const abort = useRef<AbortController | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const typed = useRef(false)

  // 外部改变选中值时同步输入框
  useEffect(() => { if (value && !typed.current) setQuery(value.name) }, [value])

  const run = (q: string) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      abort.current?.abort()
      const ctrl = new AbortController()
      abort.current = ctrl
      setLoading(true); setFailed(false)
      try {
        const rows = await destinationApi.search(q, 8, ctrl.signal)
        if (!ctrl.signal.aborted) { setResults(rows); setActive(rows.length ? 0 : -1) }
      } catch {
        if (!ctrl.signal.aborted) { setResults([]); setFailed(true); setActive(-1) }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 250)
  }
  useEffect(() => () => { window.clearTimeout(timer.current); abort.current?.abort() }, [])

  const q = query.trim()
  const exact = results.find(r => r.name === q || r.nameEn.toLowerCase() === q.toLowerCase())
  const showCustom = q.length > 0 && !exact
  const options = results.length + (showCustom ? 1 : 0)

  const pick = (d: PickedDestination) => {
    typed.current = false
    setQuery(d.name); setOpen(false); onChange(d)
  }
  const pickIndex = (i: number) => {
    if (i < results.length && i >= 0) pick(fromDestination(results[i]))
    else if (showCustom) pick(customDestination(q))
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { setOpen(true); run(q) } else setActive(a => (options ? (a + 1) % options : -1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (options ? (a - 1 + options) % options : -1)) }
    else if (e.key === 'Enter' && open) { e.preventDefault(); pickIndex(active >= 0 ? active : results.length) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const onBlur = () => window.setTimeout(() => {
    setOpen(false)
    if (!typed.current) return
    if (!q) { typed.current = false; onChange(null); return }
    pick(exact ? fromDestination(exact) : customDestination(q))
  }, 160)

  const optionId = (i: number) => `${listId}-opt-${i}`

  return (
    <div className={`cj-dest${error ? ' has-error' : ''}`}>
      <div className="cj-dest-box">
        <Search size={17} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete="off"
          placeholder="搜索城市，例如 东京、京都、巴黎"
          value={query}
          onChange={e => { typed.current = true; setQuery(e.target.value); setOpen(true); run(e.target.value.trim()); if (value) onChange(null) }}
          onFocus={() => { setOpen(true); run(q) }}
          onBlur={onBlur}
          onKeyDown={onKey}
        />
        {loading && <Loader2 size={16} className="cj-spin" aria-label="正在搜索" />}
        {!loading && query && (
          <button type="button" className="cj-dest-clear" aria-label="清除目的地" onMouseDown={e => e.preventDefault()} onClick={() => { typed.current = false; setQuery(''); onChange(null); setOpen(true); run('') }}>
            <X size={15} />
          </button>
        )}
      </div>
      {value && !open && (
        <p className="cj-dest-picked">
          <MapPin size={13} aria-hidden="true" />
          {value.custom ? '自定义目的地' : [value.countryName, value.nameEn].filter(Boolean).join(' · ')}
          {value.official && <span className="cj-badge"><Sparkles size={11} aria-hidden="true" /> 官方探索</span>}
        </p>
      )}
      {open && (
        <ul id={listId} role="listbox" className="cj-dest-list" aria-label="目的地">
          {!q && results.length > 0 && <li className="cj-dest-hint" role="presentation">热门目的地</li>}
          {results.map((r, i) => (
            <li
              key={r.id}
              id={optionId(i)}
              role="option"
              aria-selected={active === i}
              className={active === i ? 'is-active' : ''}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pickIndex(i)}
            >
              <b>{r.name}</b>
              <small>{r.nameEn} · {r.countryName}</small>
              {r.official && <span className="cj-badge"><Sparkles size={11} aria-hidden="true" /> 官方探索</span>}
            </li>
          ))}
          {showCustom && (
            <li
              id={optionId(results.length)}
              role="option"
              aria-selected={active === results.length}
              className={`cj-dest-custom${active === results.length ? ' is-active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setActive(results.length)}
              onClick={() => pickIndex(results.length)}
            >
              <b>使用「{q}」作为目的地</b>
              <small>{failed ? '目的地搜索暂时不可用，可以直接使用输入的名称' : results.length ? '没有找到完全一致的城市' : '目的地库里还没有这座城市'}</small>
            </li>
          )}
          {!showCustom && !loading && results.length === 0 && (
            <li className="cj-dest-hint" role="presentation">{failed ? '目的地搜索暂时不可用，请直接输入城市名称' : '输入城市名称开始搜索'}</li>
          )}
        </ul>
      )}
      {error && <p id={`${id}-error`} className="cj-error" role="alert">⚠ {error}</p>}
    </div>
  )
}
