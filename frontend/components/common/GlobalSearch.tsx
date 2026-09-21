'use client'

/** 全局搜索：Ctrl/⌘K 唤起，搜索真实的旅行 / 地点 / 打卡 / 照片，并可直接跳转。 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, MapPin, Route, Search } from 'lucide-react'
import { tripApi, type CheckinView, type PhotoView, type PlaceView, type TripView } from '@/services/tabitrace-api'
import { dateKeyOf } from '@/lib/time'

type Group = '旅行' | '地点' | '打卡' | '照片' | '功能'
type Result = { group: Group; label: string; hint: string; href: string; icon: any }

const FEATURES: Result[] = [
  { group: '功能', label: '我的旅行', hint: '查看全部旅行', href: '/trips', icon: Route },
  { group: '功能', label: '创建旅行', hint: '开始一段新旅程', href: '/trips/new', icon: Route },
  { group: '功能', label: '东京官方探索', hint: '官方精选地点', href: '/explore/tokyo', icon: MapPin },
  { group: '功能', label: '旅行回忆', hint: '已完成的旅行作品', href: '/memories', icon: Camera },
  { group: '功能', label: 'Trip Pro', hint: '单次旅行升级', href: '/pricing', icon: Route }
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
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 20) }, [])

  useEffect(() => {
    (async () => {
      try {
        const rows = await tripApi.list()
        setTrips(rows)
        const id = activeTripId || rows.find(t => t.status !== 'ARCHIVED')?.id || rows[0]?.id
        if (id) {
          const [p, c, ph] = await Promise.all([
            tripApi.places(id).catch(() => []),
            tripApi.checkins(id).catch(() => []),
            tripApi.photos(id).catch(() => [])
          ])
          setPlaces(p); setCheckins(c); setPhotos(ph)
        }
      } catch { /* 未登录时仅提供功能入口 */ } finally { setLoading(false) }
    })()
  }, [activeTripId])

  // 官方地点搜索走后端接口，输入超过 1 个字符后才请求
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setOfficial([]); return }
    let cancelled = false
    setSearchingOfficial(true)
    const timer = setTimeout(async () => {
      try {
        const rows = await tripApi.searchPlaces(q)
        if (!cancelled) setOfficial(rows.slice(0, 5))
      } catch { if (!cancelled) setOfficial([]) } finally { if (!cancelled) setSearchingOfficial(false) }
    }, 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const tripIdFor = (id?: number) => id || activeTripId || trips[0]?.id

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    const match = (s?: string | null) => !q || (s || '').toLowerCase().includes(q)
    const list: Result[] = []
    trips.filter(t => match(t.title) || match(t.destinationName) || match(t.city)).slice(0, 5)
      .forEach(t => list.push({ group: '旅行', label: t.title, hint: `${t.destinationName} · ${t.startDate} — ${t.endDate}`, href: `/trips/${t.id}`, icon: Route }))
    places.filter(p => match(p.name) || match(p.area) || match(p.category)).slice(0, 5)
      .forEach(p => list.push({ group: '地点', label: p.name, hint: [p.area, p.city, p.sourceType === 'OFFICIAL' ? '官方地点' : '自定义地点'].filter(Boolean).join(' · '), href: `/trips/${tripIdFor()}/map`, icon: MapPin }))
    official.filter(p => !places.some(x => x.id === p.id)).slice(0, 4)
      .forEach(p => list.push({ group: '地点', label: p.name, hint: `官方地点 · ${[p.area, p.city].filter(Boolean).join(' · ')}`, href: '/explore/tokyo', icon: MapPin }))
    checkins.filter(c => match(c.placeName) || match(c.area) || match(c.note)).slice(0, 5)
      .forEach(c => list.push({ group: '打卡', label: c.placeName, hint: `${dateKeyOf(c.checkinTime) || ''}${c.area ? ' · ' + c.area : ''}`, href: `/trips/${c.tripId}/map`, icon: MapPin }))
    photos.filter(() => Boolean(q)).slice(0, 4)
      .forEach(p => list.push({ group: '照片', label: p.featured ? '精选照片' : '旅行照片', hint: `${dateKeyOf(p.capturedAt || p.createdAt) || ''}`, href: `/trips/${p.tripId}/gallery`, icon: Camera }))
    FEATURES.filter(f => match(f.label) || match(f.hint)).forEach(f => list.push(f))
    return list.slice(0, 18)
  }, [query, trips, places, checkins, photos, official, activeTripId])

  const go = (href: string) => { onClose(); router.push(href) }

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => { (acc[r.group] ||= []).push(r); return acc }, {})

  return (
    <div className="command-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="command-panel" role="dialog" aria-modal="true" aria-label="全局搜索">
        <div className="command-input">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索地点、行程、照片或旅行…"
            aria-label="搜索地点、行程、照片或旅行"
            onKeyDown={e => { if (e.key === 'Enter' && results[0]) go(results[0].href); if (e.key === 'Escape') onClose() }}
          />
          {(loading || searchingOfficial) && <Loader2 size={15} className="animate-spin text-warm" />}
          <button onClick={onClose} aria-label="关闭搜索">ESC</button>
        </div>
        <div className="command-results">
          {results.length === 0 ? (
            <div className="command-empty">{loading ? '正在读取你的旅行数据…' : '没有匹配结果'}</div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="command-group">{group}</p>
                {items.map((r, i) => (
                  <button key={`${group}-${r.label}-${i}`} onClick={() => go(r.href)}>
                    <span className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-orangeSoft text-warm"><r.icon size={15} /></span>
                      <span><b>{r.label}</b><small>{r.hint}</small></span>
                    </span>
                    <span>→</span>
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
