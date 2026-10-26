'use client'

/**
 * 开发数据源切换器（只在开发环境由 DevDataRoot 动态加载，生产构建里不存在）。
 * 刻意使用与旅迹产品不同的开发工具样式（深色 + 黄色标签），一眼能看出这是 Developer Tool。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE, resetDataCaches } from '@/services/api'
import { resetDevData } from '@/dev/data/adapter'
import { DATA_SOURCE_KEY, DATA_SOURCE_MODES, DEV_DATA_NOTICE, readMode, writeMode, type DataSourceMode } from '@/dev/data/mode'

const META: Record<DataSourceMode, { tag: string; label: string; hint: string }> = {
  local: { tag: 'LOCAL', label: '本地数据库', hint: '使用本地后端与数据库里的真实数据' },
  mock: { tag: 'MOCK', label: 'Mock 数据', hint: '固定演示数据，写操作只保存在当前标签页内存' },
  empty: { tag: 'EMPTY', label: '无数据', hint: '所有列表为空，用来检查 Empty State；写操作被拦截' }
}

type Health = 'checking' | 'online' | 'offline'

export function DevDataSwitcher({ onSwitched }: { onSwitched: () => void }) {
  const [mode, setMode] = useState<DataSourceMode>('local')
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<DataSourceMode | null>(null)
  const [toast, setToast] = useState('')
  const [health, setHealth] = useState<Health>('checking')
  const root = useRef<HTMLDivElement | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const say = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 3200)
  }, [])

  // 清缓存 → 重新挂载应用子树（所有页面按新数据源重新取数）
  const apply = useCallback((next: DataSourceMode, announce: boolean) => {
    setSwitching(next)
    resetDevData()
    resetDataCaches()
    setMode(next)
    onSwitched()
    window.setTimeout(() => { setSwitching(null); if (announce) say(`已切换至${META[next].label}`) }, 450)
  }, [onSwitched, say])

  useEffect(() => { setMode(readMode()) }, [])

  // 其他标签页切换了数据源：这个标签页同步切换，避免同一浏览器里两个标签页数据来源不一致
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === DATA_SOURCE_KEY) apply(readMode(), true) }
    const onNotice = (e: Event) => say((e as CustomEvent<string>).detail)
    window.addEventListener('storage', onStorage)
    window.addEventListener(DEV_DATA_NOTICE, onNotice)
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(DEV_DATA_NOTICE, onNotice) }
  }, [apply, say])

  // 本地模式显示后端连接状态；后端没启动时明确提示 Offline，不会自动改用 Mock
  useEffect(() => {
    if (mode !== 'local') return
    let alive = true
    const ping = async () => {
      try { const r = await fetch(`${API_BASE}/plans/trip-pro`, { cache: 'no-store' }); if (alive) setHealth(r.ok ? 'online' : 'offline') }
      catch { if (alive) setHealth('offline') }
    }
    setHealth('checking'); void ping()
    const t = window.setInterval(() => { void ping() }, 10000)
    return () => { alive = false; window.clearInterval(t) }
  }, [mode])

  // 浏览器标题前加 [MOCK] / [EMPTY]，切到别的窗口也不会忘记当前模式
  useEffect(() => {
    const prefix = mode === 'local' ? '' : `[${META[mode].tag}] `
    const fix = () => {
      const bare = document.title.replace(/^\[(MOCK|EMPTY)\] /, '')
      const want = prefix + bare
      if (document.title !== want) document.title = want
    }
    fix()
    const obs = new MutationObserver(fix)
    obs.observe(document.head, { subtree: true, childList: true, characterData: true })
    return () => { obs.disconnect(); document.title = document.title.replace(/^\[(MOCK|EMPTY)\] /, '') }
  }, [mode])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const pick = (next: DataSourceMode) => {
    setOpen(false)
    if (next === mode) return
    writeMode(next)
    apply(next, true)
  }

  const status = health === 'online' ? 'Connected' : health === 'offline' ? 'Offline' : '…'

  return (
    <div ref={root} className={`devds devds-${mode}`} data-dev-data-switcher="">
      <style>{CSS}</style>
      <button type="button" className="devds-pill" onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`开发数据源：${META[mode].label}`}>
        <span className="devds-dev">DEV</span>
        <span className="devds-full">DATA</span>
        <b>{META[mode].tag}</b>
        {mode === 'local' && <><i className={`devds-dot is-${health}`} aria-hidden="true" /><span className="devds-full devds-status">{status}</span></>}
        <span className="devds-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <>
          <div className="devds-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="devds-menu" role="menu" aria-label="开发数据源">
            <p className="devds-title">DEV DATA SOURCE <span>仅开发环境</span></p>
            {DATA_SOURCE_MODES.map(m => (
              <button key={m} type="button" role="menuitemradio" aria-checked={m === mode} className={`devds-opt${m === mode ? ' is-on' : ''}`} onClick={() => pick(m)}>
                <span className="devds-radio" aria-hidden="true">{m === mode ? '●' : '○'}</span>
                <span className="devds-opt-text">
                  <b>{META[m].label} <em>{META[m].tag}</em></b>
                  <small>{META[m].hint}</small>
                </span>
              </button>
            ))}
            {mode === 'local' && health === 'offline' && <p className="devds-warn">本地服务连接失败：{API_BASE} 没有响应。页面会显示连接错误，不会自动改用 Mock 数据。</p>}
          </div>
        </>
      )}

      {switching && <div className="devds-overlay" role="status">正在切换到{META[switching].label}…</div>}
      {toast && <div className="devds-toast" role="status">{toast}</div>}
    </div>
  )
}

const CSS = `
.devds{position:fixed;top:0;right:max(12px,env(safe-area-inset-right));z-index:2147483000;font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#f5f5f5}
.devds *{box-sizing:border-box}
.devds-pill{display:flex;align-items:center;gap:6px;height:16px;padding:0 8px;border:0;border-radius:0 0 7px 7px;background:rgba(17,17,17,.88);color:#f5f5f5;cursor:pointer;font:inherit;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.devds-pill:focus-visible{outline:2px solid #facc15;outline-offset:1px}
.devds-dev{background:#facc15;color:#111;font-weight:700;padding:0 3px;border-radius:3px;font-size:9px;line-height:12px}
.devds-pill b{letter-spacing:.04em}
.devds-mock .devds-pill b{color:#c4b5fd}
.devds-empty .devds-pill b{color:#fda4af}
.devds-mock .devds-pill{background:rgba(76,29,149,.92)}
.devds-empty .devds-pill{background:rgba(136,19,55,.92)}
.devds-status{opacity:.75}
.devds-caret{opacity:.7}
.devds-dot{width:7px;height:7px;border-radius:50%;background:#a3a3a3}
.devds-dot.is-online{background:#4ade80}
.devds-dot.is-offline{background:#f87171}
.devds-scrim{position:fixed;inset:0;background:transparent}
.devds-menu{position:absolute;top:22px;right:0;width:300px;padding:8px;border-radius:10px;background:#171717;border:1px solid #404040;box-shadow:0 12px 32px rgba(0,0,0,.35)}
.devds-title{margin:2px 4px 8px;font-size:10px;letter-spacing:.08em;color:#a3a3a3;display:flex;justify-content:space-between}
.devds-title span{color:#facc15}
.devds-opt{display:flex;gap:8px;width:100%;min-height:44px;padding:8px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}
.devds-opt:hover,.devds-opt:focus-visible{background:#262626;outline:none}
.devds-opt.is-on{background:#262626}
.devds-radio{color:#facc15;width:12px}
.devds-opt-text{display:flex;flex-direction:column;gap:2px}
.devds-opt-text b{font-weight:600}
.devds-opt-text em{font-style:normal;font-size:10px;color:#a3a3a3;margin-left:4px}
.devds-opt-text small{color:#a3a3a3;font-size:11px}
.devds-warn{margin:6px 4px 2px;color:#fca5a5;font-size:11px}
.devds-overlay{position:fixed;inset:0;display:grid;place-items:center;background:rgba(10,10,10,.55);color:#fff;font-size:13px;backdrop-filter:blur(2px)}
.devds-toast{position:fixed;top:24px;right:max(12px,env(safe-area-inset-right));max-width:min(360px,calc(100vw - 24px));padding:8px 10px;border-radius:8px;background:#171717;border:1px solid #facc15;color:#fef9c3;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.3)}
@media (max-width:767px){
  .devds{right:auto;left:50%;top:env(safe-area-inset-top)}
  .devds-pill{transform:translateX(-50%)}
  .devds-full{display:none}
  .devds .devds-pill{height:16px;padding:0 6px;gap:4px;font-size:10px}
  .devds-menu{position:fixed;top:auto;right:0;left:0;bottom:0;width:auto;border-radius:14px 14px 0 0;padding:12px 12px calc(12px + env(safe-area-inset-bottom))}
  .devds-scrim{background:rgba(0,0,0,.4)}
  .devds-toast{left:12px;right:12px;top:24px;max-width:none}
}
`
