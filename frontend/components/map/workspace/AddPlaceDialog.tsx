'use client'

/**
 * 统一的“添加地点”：搜索官方地点 / 自定义地点 / 推荐探索（复用推荐探索的官方地点接口）。
 * 结果都可以：加入行程（安排到某天某时）、立即打卡（走统一的快速打卡）、在地图上查看。
 * 自定义地点的经纬度收在“高级位置设置”里，也可以回到地图上点选。
 */

import { useEffect, useId, useRef, useState } from 'react'
import { CalendarPlus, Check, Crosshair, Loader2, MapPin, Search, Sparkles, Star, X } from 'lucide-react'
import type { QuickCheckInPrefill } from '@/components/checkin/QuickCheckInProvider'
import { tripApi, type PlaceView, type TripView } from '@/services/tabitrace-api'
import { dayLabel, dayTitle, type DayKey } from '@/utils/travel-map'
import type { PreviewPoint } from './TripMapCanvas'

type Tab = 'search' | 'custom' | 'explore'
type Custom = { name: string; area: string; note: string; lat: string; lng: string }

const hasCoords = (p: PlaceView) => typeof p.latitude === 'number' && typeof p.longitude === 'number'

export function AddPlaceDialog({ trip, official, days, day, inTrip, hidden, picked, onRequestPick, onClose, onDone, onCheckin, onPreview }: {
  trip: TripView
  /** 目的地的官方探索（由页面查询一次后传入）；没有时不显示“推荐探索” */
  official: { code: string; name: string } | null
  days: string[]
  day: DayKey
  inTrip: Set<number>
  hidden: boolean
  picked: { lat: number; lng: number } | null
  onRequestPick: () => void
  onClose: () => void
  onDone: (message: string, focus?: { day: string; selectKey?: string }) => void
  onCheckin: (prefill: QuickCheckInPrefill) => void
  onPreview: (p: PreviewPoint) => void
}) {
  const titleId = useId()
  const [tab, setTab] = useState<Tab>('search')
  const [date, setDate] = useState(day !== 'ALL' ? day : days[0] ?? trip.startDate)
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  // 搜索
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PlaceView[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const seq = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  // 推荐探索
  const [picks, setPicks] = useState<PlaceView[] | null>(null)
  const [exploreError, setExploreError] = useState('')
  // 自定义
  const [custom, setCustom] = useState<Custom>({ name: '', area: '', note: '', lat: '', lng: '' })
  const [customError, setCustomError] = useState('')
  const [advanced, setAdvanced] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !hidden) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, hidden])

  useEffect(() => {
    if (tab !== 'explore' || !official || picks) return
    tripApi.officialPlaces(official.code)
      .then(rows => setPicks([...rows].sort((a, b) => (a.editorRank ?? 999) - (b.editorRank ?? 999))))
      .catch(e => setExploreError(e instanceof Error && e.message ? e.message : '推荐探索加载失败'))
  }, [tab, official, picks])

  // 地图上选好点后回填坐标
  useEffect(() => {
    if (!picked) return
    setCustom(c => ({ ...c, lat: String(picked.lat), lng: String(picked.lng) }))
    setAdvanced(true); setTab('custom')
  }, [picked])

  const search = (value: string) => {
    setQ(value)
    window.clearTimeout(timer.current)
    const text = value.trim()
    if (!text) { setResults([]); setSearchError(''); setSearching(false); return }
    timer.current = window.setTimeout(async () => {
      const mine = ++seq.current
      setSearching(true); setSearchError('')
      try {
        const rows = await tripApi.searchPlaces(text)
        if (mine === seq.current) setResults(rows)
      } catch (e) {
        if (mine === seq.current) { setResults([]); setSearchError(e instanceof Error && e.message ? `地点搜索失败：${e.message}` : '地点搜索失败，请稍后再试') }
      } finally {
        if (mine === seq.current) setSearching(false)
      }
    }, 300)
  }

  const schedule = async (key: string, run: () => Promise<{ selectKey?: string }>, name: string) => {
    setBusy(key); setError('')
    try {
      const r = await run()
      onDone(`已加入 ${dayLabel(days, date)} 行程 · ${name}`, { day: date, selectKey: r.selectKey })
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : '加入行程失败，请重试')
    } finally {
      setBusy(null)
    }
  }

  const addPlaceToPlan = (p: PlaceView) => schedule(`plan-${p.id}`, async () => {
    await tripApi.addItinerary(trip.id, { placeId: p.id, plannedDate: date, plannedTime: time || undefined, status: 'PLANNED' })
    return { selectKey: `p${p.id}` }
  }, p.name)

  const savePlace = async (p: PlaceView) => {
    setBusy(`save-${p.id}`); setError('')
    try { await tripApi.addPlace(trip.id, p.id); onDone(`已收藏到这段旅行 · ${p.name}`) }
    catch (e) { setError(e instanceof Error && e.message ? e.message : '收藏失败，请重试') }
    finally { setBusy(null) }
  }

  const customCoords = (): { lat?: number; lng?: number } | null => {
    const hasLat = custom.lat.trim() !== '', hasLng = custom.lng.trim() !== ''
    if (!hasLat && !hasLng) return {}
    const lat = Number(custom.lat), lng = Number(custom.lng)
    if (!hasLat || !hasLng || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setCustomError('坐标需要同时填写：纬度 -90～90，经度 -180～180'); setAdvanced(true); return null
    }
    return { lat, lng }
  }

  const customAction = async (kind: 'plan' | 'checkin' | 'save') => {
    setCustomError('')
    const name = custom.name.trim()
    if (!name) { setCustomError('请填写地点名称'); document.getElementById('tm-custom-name')?.focus(); return }
    const c = customCoords()
    if (!c) return
    if (kind === 'checkin') { onCheckin({ placeName: name, area: custom.area.trim() || undefined, note: custom.note.trim() || undefined, date, latitude: c.lat, longitude: c.lng }); return }
    if (kind === 'plan') {
      await schedule('custom', async () => {
        const it = await tripApi.addItinerary(trip.id, { customPlaceName: name, area: custom.area.trim() || undefined, note: custom.note.trim() || undefined, plannedDate: date, plannedTime: time || undefined, latitude: c.lat, longitude: c.lng, status: 'PLANNED' })
        return { selectKey: `i${it.id}` }
      }, name)
      return
    }
    setBusy('custom-save')
    try { const p = await tripApi.customPlace(trip.id, { name, area: custom.area.trim() || undefined, latitude: c.lat, longitude: c.lng, category: '自定义' }); onDone(`已收藏自定义地点 · ${p.name}`) }
    catch (e) { setCustomError(e instanceof Error && e.message ? e.message : '保存失败，请重试') }
    finally { setBusy(null) }
  }

  const placeRow = (p: PlaceView) => (
    <li key={p.id} className="tm-result">
      <div className="tm-result-text">
        <b>{p.name}{inTrip.has(p.id) && <em>已在旅行中</em>}</b>
        <small>{[p.area, p.category, p.tagline].filter(Boolean).join(' · ')}</small>
      </div>
      <div className="tm-result-actions">
        <button type="button" className="tm-btn is-primary" onClick={() => void addPlaceToPlan(p)} disabled={busy !== null}>
          {busy === `plan-${p.id}` ? <Loader2 size={13} className="tm-spin" /> : <CalendarPlus size={13} />} 加入行程
        </button>
        <button type="button" className="tm-btn" onClick={() => onCheckin({ placeId: p.id, placeName: p.name, area: p.area, date })} disabled={busy !== null}><Check size={13} /> 立即打卡</button>
        {hasCoords(p) && <button type="button" className="tm-btn" onClick={() => onPreview({ lat: p.latitude!, lng: p.longitude!, name: p.name })}><MapPin size={13} /> 查看地图</button>}
        {!inTrip.has(p.id) && <button type="button" className="tm-icon" onClick={() => void savePlace(p)} disabled={busy !== null} aria-label={`收藏 ${p.name} 到这段旅行`}><Star size={14} /></button>}
      </div>
    </li>
  )

  const tabs: [Tab, string][] = [['search', '搜索地点'], ['custom', '自定义地点'], ...(official ? [['explore', '推荐探索'] as [Tab, string]] : [])]

  return (
    <div className="modal-backdrop tm-dialog-backdrop" hidden={hidden} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel tm-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <div>
            <p className="tm-eyebrow">ADD PLACE</p>
            <h2 id={titleId}>添加地点</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </div>

        <div className="tm-dialog-when">
          <label htmlFor="tm-when-day">安排到</label>
          <select id="tm-when-day" className="tm-input" value={date} onChange={e => setDate(e.target.value)}>
            {days.map(d => <option key={d} value={d}>{dayLabel(days, d)} · {dayTitle(d)}</option>)}
          </select>
          <label htmlFor="tm-when-time" className="sr-only">时间（可选）</label>
          <input id="tm-when-time" type="time" className="tm-input" value={time} onChange={e => setTime(e.target.value)} aria-describedby="tm-when-hint" />
          <small id="tm-when-hint">时间可不填</small>
        </div>

        <div className="tm-tabs" role="tablist" aria-label="添加方式">
          {tabs.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
              {k === 'explore' && <Sparkles size={13} aria-hidden="true" />}{l}
            </button>
          ))}
        </div>

        {error && <p className="tm-error" role="alert">⚠ {error}</p>}

        <div className="tm-dialog-body" role="tabpanel">
          {tab === 'search' && (
            <>
              <div className="tm-search">
                <Search size={16} aria-hidden="true" />
                <input autoFocus value={q} onChange={e => search(e.target.value)} placeholder="搜索官方地点，例如 浅草寺、涩谷" aria-label="搜索地点" />
                {searching && <Loader2 size={15} className="tm-spin" aria-label="正在搜索" />}
              </div>
              {searchError && <p className="tm-error" role="alert">⚠ {searchError}</p>}
              {!searchError && q.trim() && !searching && results.length === 0 && (
                <p className="tm-hint">没有找到“{q.trim()}”。可以切换到“自定义地点”直接添加。</p>
              )}
              {!q.trim() && <p className="tm-hint">目前可以搜索官方精选地点；找不到的地方，用“自定义地点”添加。</p>}
              <ul className="tm-results">{results.map(placeRow)}</ul>
            </>
          )}

          {tab === 'explore' && official && (
            <>
              <p className="tm-hint">{official.name}官方推荐探索里的地点，按编辑推荐排序。</p>
              {exploreError && <p className="tm-error" role="alert">⚠ {exploreError}</p>}
              {!picks && !exploreError && <p className="tm-hint"><Loader2 size={14} className="tm-spin" /> 正在加载推荐…</p>}
              <ul className="tm-results">{picks?.slice(0, 15).map(placeRow)}</ul>
            </>
          )}

          {tab === 'custom' && (
            <div className="tm-custom">
              <label htmlFor="tm-custom-name">地点名称</label>
              <input id="tm-custom-name" className="tm-input" value={custom.name} maxLength={200} onChange={e => setCustom(c => ({ ...c, name: e.target.value }))} placeholder="例如：巷子里的咖啡店" aria-invalid={Boolean(customError && !custom.name.trim())} />
              <label htmlFor="tm-custom-area">区域</label>
              <input id="tm-custom-area" className="tm-input" value={custom.area} maxLength={100} onChange={e => setCustom(c => ({ ...c, area: e.target.value }))} placeholder="例如：中目黑" />
              <label htmlFor="tm-custom-note">备注</label>
              <input id="tm-custom-note" className="tm-input" value={custom.note} maxLength={2000} onChange={e => setCustom(c => ({ ...c, note: e.target.value }))} placeholder="可选" />
              <details className="tm-advanced" open={advanced} onToggle={e => setAdvanced((e.target as HTMLDetailsElement).open)}>
                <summary>高级位置设置{custom.lat && custom.lng ? ` · ${custom.lat}, ${custom.lng}` : ''}</summary>
                <div className="tm-advanced-body">
                  <label htmlFor="tm-custom-lat">纬度</label>
                  <input id="tm-custom-lat" className="tm-input" inputMode="decimal" value={custom.lat} onChange={e => setCustom(c => ({ ...c, lat: e.target.value }))} placeholder="-90 ~ 90" />
                  <label htmlFor="tm-custom-lng">经度</label>
                  <input id="tm-custom-lng" className="tm-input" inputMode="decimal" value={custom.lng} onChange={e => setCustom(c => ({ ...c, lng: e.target.value }))} placeholder="-180 ~ 180" />
                  <button type="button" className="tm-btn" onClick={onRequestPick}><Crosshair size={13} /> 在地图上选点</button>
                </div>
              </details>
              {customError && <p className="tm-error" role="alert">⚠ {customError}</p>}
              <div className="tm-custom-actions">
                <button type="button" className="tm-btn is-primary" onClick={() => void customAction('plan')} disabled={busy !== null}>
                  {busy === 'custom' ? <Loader2 size={13} className="tm-spin" /> : <CalendarPlus size={13} />} 加入行程
                </button>
                <button type="button" className="tm-btn" onClick={() => void customAction('checkin')} disabled={busy !== null}><Check size={13} /> 立即打卡</button>
                <button type="button" className="tm-btn" onClick={() => void customAction('save')} disabled={busy !== null}><Star size={13} /> 只收藏</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
