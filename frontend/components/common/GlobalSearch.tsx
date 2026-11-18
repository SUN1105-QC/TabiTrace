'use client'

import { officialExploreHref } from '@/constants/explore-cities'

/** 全局搜索：Ctrl/⌘K 唤起，搜索真实的旅行 / 地点 / 打卡 / 照片，并可直接跳转。 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, MapPin, Route, Search, type LucideIcon } from 'lucide-react'
import { tripApi, type CheckinView, type PhotoView, type PlaceView, type TripView } from '@/services/tabitrace-api'
import { dateKeyOf } from '@/lib/time'

type Group = '旅行' | '地点' | '打卡' | '照片' | '功能'
type Result = { group: Group; label: string; hint: string; href: string; icon: LucideIcon }

const FEATURES: Result[] = [
  { group: '功能', label: '我的旅行', hint: '查看全部旅行', href: '/trips', icon: Route },
  { group: '功能', label: '创建旅行', hint: '开始一段新旅程', href: '/trips/new', icon: Route },
  { group: '功能', label: '推荐探索', hint: '按国家与城市发现目的地', href: '/explore', icon: MapPin },
  { group: '功能', label: '东京官方探索', hint: '日本 · 东京精选地点', href: '/explore/tokyo', icon: MapPin },
  { group: '功能', label: '旅行回忆', hint: '已完成的旅行作品', href: '/memories', icon: Camera },
  { group: '功能', label: '旅行活动', hint: '查看打卡、照片与旅行动态', href: '/activities', icon: Route },
  { group: '功能', label: '联系管理员', hint: '留言、账号权限与旅程备份', href: '/support', icon: Route },
  { group: '功能', label: '个人设置', hint: '资料、偏好与账号安全', href: '/profile', icon: Route },
  { group: '功能', label: 'Trip Pro', hint: '查看方案与当前开放权益', href: '/pricing', icon: Route }
]

export function GlobalSearch({ activeTripId, onClose }: { activeTripId: number | null; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [trips, setTrips] = useState<TripView[]>([])
  const [places, setPlaces] = useState<PlaceView[]>([])
  const [checkins, setCheckins] = useState<CheckinView[]>([])
  const [photos, setPhotos] = useState<PhotoView[]>([])
  const [official, setOfficial] = useState<PlaceView[]>([])
  const [searchingOfficial, setSearchingOfficial] = useState(false)
  const [officialQuery, setOfficialQuery] = useState('')
  const [loadedTripId, setLoadedTripId] = useState<number | null>(null)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    return () => { document.body.style.overflow = overflow; opener?.focus() }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setLoadError(''); setTrips([]); setPlaces([]); setCheckins([]); setPhotos([]); setLoadedTripId(null)
    void (async () => {
      try {
        const rows = await tripApi.list()
        if (cancelled) return
        setTrips(rows)
        const id = rows.find(t => t.id === activeTripId)?.id || rows.find(t => t.status !== 'ARCHIVED')?.id || rows[0]?.id
        if (id) {
          const failed: string[] = []
          const [p, c, ph] = await Promise.all([
            tripApi.places(id).catch(() => { failed.push('地点'); return [] }),
            tripApi.checkins(id).catch(() => { failed.push('打卡'); return [] }),
            tripApi.photos(id).catch(() => { failed.push('照片'); return [] })
          ])
          if (cancelled) return
          setPlaces(p); setCheckins(c); setPhotos(ph); setLoadedTripId(id)
          if (failed.length) setLoadError(`${failed.join('、')}读取失败，搜索结果可能不完整。`)
        }
      } catch { if (!cancelled) setLoadError('旅行数据读取失败，可以重试或使用下方功能入口。') } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [activeTripId, retry])

  // 官方地点搜索走后端接口，输入超过 1 个字符后才请求
  useEffect(() => {
    const q = query.trim()
    setOfficial([]); setOfficialQuery('')
    if (q.length < 2) { setSearchingOfficial(false); return }
    let cancelled = false
    setSearchingOfficial(true)
    const timer = setTimeout(() => { void (async () => {
      try {
        const rows = await tripApi.searchPlaces(q)
        if (!cancelled) { setOfficial(rows.slice(0, 5)); setOfficialQuery(q) }
      } catch { if (!cancelled) setOfficial([]) } finally { if (!cancelled) setSearchingOfficial(false) }
    })() }, 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    const match = (s?: string | null) => !q || (s || '').toLowerCase().includes(q)
    const list: Result[] = []
    trips.filter(t => match(t.title) || match(t.destinationName) || match(t.city)).slice(0, 5)
      .forEach(t => list.push({ group: '旅行', label: t.title, hint: `${t.destinationName} · ${t.startDate} — ${t.endDate}`, href: `/trips/${t.id}/map`, icon: Route }))
    places.filter(p => match(p.name) || match(p.area) || match(p.category)).slice(0, 5)
      .forEach(p => list.push({ group: '地点', label: p.name, hint: [p.area, p.city, p.sourceType === 'OFFICIAL' ? '官方地点' : '自定义地点'].filter(Boolean).join(' · '), href: `/trips/${loadedTripId}/map`, icon: MapPin }))
    official.filter(p => officialQuery === query.trim() && !places.some(x => x.id === p.id)).slice(0, 4)
      .forEach(p => list.push({ group: '地点', label: p.name, hint: `官方地点 · ${[p.area, p.city].filter(Boolean).join(' · ')}`, href: `${officialExploreHref(p.city)}#place-${p.id}`, icon: MapPin }))
    checkins.filter(c => match(c.placeName) || match(c.area) || match(c.note)).slice(0, 5)
      .forEach(c => list.push({ group: '打卡', label: c.placeName, hint: `${dateKeyOf(c.checkinTime) || ''}${c.area ? ' · ' + c.area : ''}`, href: `/trips/${c.tripId}/map`, icon: MapPin }))
    photos.filter(p => {
      const linked = checkins.find(c => c.id === p.checkinId)
      const description = [p.featured ? '精选照片' : '旅行照片', dateKeyOf(p.capturedAt || p.createdAt), linked?.placeName, linked?.area, linked?.note].filter(Boolean).join(' ')
      return Boolean(q) && match(description)
    }).slice(0, 4)
      .forEach(p => list.push({ group: '照片', label: p.featured ? '精选照片' : '旅行照片', hint: `${dateKeyOf(p.capturedAt || p.createdAt) || ''}`, href: `/trips/${p.tripId}/gallery`, icon: Camera }))
    FEATURES.filter(f => match(f.label) || match(f.hint)).forEach(f => list.push(f))
    return list.slice(0, 18)
  }, [query, trips, places, checkins, photos, official, officialQuery, loadedTripId])

  const go = (href: string) => {
    onClose()
    // 目标就在当前页面、只是锚点不同（例如在推荐探索里搜到另一个地点）：只改 hash，页面通过 hashchange 打开对应内容
    const [path, hash] = href.split('#')
    if (hash && path === window.location.pathname) { window.location.hash = hash; return }
    router.push(href)
  }

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => { (acc[r.group] ||= []).push(r); return acc }, {})

  return (
    <div className="command-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panelRef} className="command-panel" role="dialog" aria-modal="true" aria-label="全局搜索" onKeyDown={e => {
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Escape') { e.preventDefault(); onClose() }
        if (e.key === 'Tab') {
          const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>('input,button:not([disabled]),a[href]') ?? [])]
          const first = controls[0], last = controls.at(-1)
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
        }
      }}>
        <div className="command-input">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索地点、行程、照片或旅行…"
            aria-label="搜索地点、行程、照片或旅行"
            onKeyDown={e => { if (!e.nativeEvent.isComposing && e.key === 'Enter' && results[0]) go(results[0].href) }}
          />
          {(loading || (query.trim().length >= 2 && searchingOfficial)) && <Loader2 size={15} className="animate-spin text-warm" aria-label="正在搜索" />}
          <button onClick={onClose} aria-label="关闭搜索">ESC</button>
        </div>
        <div className="command-results">
          {loadError && <p className="command-error" role="alert">{loadError} <button type="button" onClick={() => setRetry(n => n + 1)}>重新读取</button></p>}
          {results.length === 0 ? (
            <div className="command-empty">{loading ? '正在读取你的旅行数据…' : '没有匹配结果'}</div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="command-group">{group}</p>
                {items.map((r, i) => (
                  <button className="command-result" key={`${group}-${r.label}-${i}`} onClick={() => go(r.href)}>
                    <span className="command-result-content">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-orangeSoft text-warm"><r.icon size={15} /></span>
                      <span className="command-result-copy"><b>{r.label}</b><small>{r.hint}</small></span>
                    </span>
                    <span className="command-result-arrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
