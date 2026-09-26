'use client'

/**
 * 旅行地图工作台：看地图 → 加入行程 → 到达地点 → 打卡 → 自动进入时间轴。
 * selectedDay / selectedKey 两个状态由地图、旅程面板、时间轴共用；打卡走全局快速打卡，
 * 保存后 checkinVersion 变化即静默刷新数据（不整页刷新）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Camera, Plus, RefreshCcw, TriangleAlert } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { LiveTripSubnav } from '@/components/trip/LiveTripSubnav'
import { useQuickCheckIn, type QuickCheckInPrefill } from '@/components/checkin/QuickCheckInProvider'
import { TripMapCanvas, type PreviewPoint } from '@/components/map/workspace/TripMapCanvas'
import { DaySelector, JourneyPanel } from '@/components/map/workspace/JourneyPanel'
import { TravelTimeline } from '@/components/map/workspace/TravelTimeline'
import { AddPlaceDialog } from '@/components/map/workspace/AddPlaceDialog'
import { hasSession } from '@/services/api'
import { destinationApi, tripApi, userApi, type DistanceUnit, type ItineraryView, type PlaceView, type TimelineDay, type TripView } from '@/services/tabitrace-api'
import { distanceKm, formatKm } from '@/utils/explore'
import { localDateKey } from '@/lib/time'
import { buildMapPoints, buildStops, defaultDay, getNextStop, stopsOfDay, tripDays, type DayKey, type JourneyStop } from '@/utils/travel-map'

export default function TripMapWorkspace() {
  const params = useParams<{ id: string }>()
  const tripId = Number(params.id)
  const { openQuickCheckIn, checkinVersion } = useQuickCheckIn()
  const [trip, setTrip] = useState<TripView | null>(null)
  const [places, setPlaces] = useState<PlaceView[]>([])
  const [itinerary, setItinerary] = useState<ItineraryView[]>([])
  const [timeline, setTimeline] = useState<TimelineDay[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [day, setDay] = useState<DayKey | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  /** 每次选择都自增：重复点击同一项也会让地图重新飞过去 */
  const [selectNonce, setSelectNonce] = useState(0)
  const [adding, setAdding] = useState(false)
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null)
  const [preview, setPreview] = useState<PreviewPoint | null>(null)
  const [toast, setToast] = useState('')
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [unit, setUnit] = useState<DistanceUnit>('KM')
  const [destination, setDestination] = useState<{ center: [number, number]; official: { code: string; name: string } | null } | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const seenVersion = useRef(checkinVersion)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setLoadError('') }
    try {
      const [t, p, i, tl] = await Promise.all([tripApi.get(tripId), tripApi.places(tripId), tripApi.itinerary(tripId), tripApi.timeline(tripId)])
      setTrip(t); setPlaces(p); setItinerary(i); setTimeline(tl); setLoadError('')
      setDay(d => d ?? defaultDay(tripDays(t), localDateKey(new Date())))
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : '请稍后再试'
      if (quiet) showToast(`刷新失败：${msg}`); else setLoadError(msg)
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [tripId, showToast])

  useEffect(() => { localStorage.setItem('tabitrace-live-trip-id', String(tripId)); void load() }, [tripId, load])
  // 快速打卡保存成功 → 刷新 Marker、面板和时间轴
  useEffect(() => {
    if (checkinVersion === seenVersion.current) return
    seenVersion.current = checkinVersion
    showToast('打卡已保存，已更新地图和时间轴')
    void load(true)
  }, [checkinVersion, load, showToast])

  // 距离：只在用户已经授权定位时计算，不主动弹出授权
  useEffect(() => {
    if (hasSession()) userApi.me().then(u => setUnit(u.distanceUnit === 'MI' ? 'MI' : 'KM')).catch(() => {})
    if (!navigator.geolocation || !navigator.permissions?.query) return
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(r => {
      if (r.state === 'granted') navigator.geolocation.getCurrentPosition(p => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { timeout: 8000 })
    }).catch(() => {})
  }, [])

  // 目的地：地图的初始中心 + 是否有官方推荐探索（复用创建旅行的目的地库，只查一次）
  const destName = trip ? trip.city || trip.destinationName : ''
  useEffect(() => {
    if (!destName) return
    destinationApi.search(destName, 1).then(r => {
      const d = r[0]
      if (!d || (d.name !== destName && d.nameEn.toLowerCase() !== destName.toLowerCase())) return
      setDestination({ center: [Number(d.longitude), Number(d.latitude)], official: d.official ? { code: d.official.code, name: d.official.name } : null })
    }).catch(() => {})
  }, [destName])

  const days = useMemo(() => (trip ? tripDays(trip) : []), [trip])
  const selectedDay: DayKey = day ?? 'ALL'
  const stops = useMemo(() => buildStops(itinerary, timeline, places), [itinerary, timeline, places])
  const dayStops = useMemo(() => stopsOfDay(stops, selectedDay), [stops, selectedDay])
  const points = useMemo(() => buildMapPoints(stops, places, selectedDay), [stops, places, selectedDay])
  const route = useMemo(() => dayStops.filter(s => s.status === 'done' && s.lat !== undefined && s.lng !== undefined).map(s => [s.lng!, s.lat!] as [number, number]), [dayStops])
  const next = useMemo(() => getNextStop(dayStops, new Date()), [dayStops])
  const inTrip = useMemo(() => new Set(places.map(p => p.id)), [places])
  const readOnly = trip?.status === 'ARCHIVED'

  const distance = useCallback((s: JourneyStop) => (geo && s.lat !== undefined && s.lng !== undefined ? formatKm(distanceKm(geo, { latitude: s.lat, longitude: s.lng } as PlaceView), unit) : null), [geo, unit])

  const select = useCallback((key: string) => { setPreview(null); setSelectedKey(key); setSelectNonce(n => n + 1) }, [])
  const changeDay = (d: DayKey) => { setDay(d); setSelectedKey(null); setPreview(null) }

  const checkin = (s: JourneyStop) => openQuickCheckIn(tripId, { placeId: s.placeId, placeName: s.name, area: s.area, itineraryItemId: s.itineraryId, date: s.date })
  const quickCheckin = (prefill?: QuickCheckInPrefill) => { setAdding(false); openQuickCheckIn(tripId, prefill) }

  const removePlan = async (s: JourneyStop) => {
    if (!s.itineraryId) return
    try { await tripApi.deleteItinerary(tripId, s.itineraryId); showToast(`已从行程移除 · ${s.name}`); await load(true) }
    catch (e) { showToast(e instanceof Error && e.message ? e.message : '移除失败，请重试') }
  }
  const undo = async (s: JourneyStop) => {
    if (!s.checkinId) return
    try { await tripApi.deleteCheckin(s.checkinId); showToast(`已撤销打卡 · ${s.name}`); await load(true) }
    catch (e) { showToast(e instanceof Error && e.message ? e.message : '撤销失败，请重试') }
  }
  const showRecord = (s: JourneyStop) => {
    setSelectedKey(s.selectKey)
    document.getElementById(`tl-${s.key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  if (loadError) {
    return (
      <main><SiteHeader />
        <section className="tm-page">
          <div className="tm-fail" role="alert">
            <TriangleAlert size={22} />
            <p>旅行地图加载失败</p>
            <small>{loadError}</small>
            <button type="button" className="tm-btn is-primary" onClick={() => void load()}><RefreshCcw size={14} /> 重新加载</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main>
      <SiteHeader />
      <section className="tm-page">
        <header className="tm-head">
          <p className="tm-eyebrow">TRAVEL MAP</p>
          <h1>{trip?.title ?? '旅行地图'}</h1>
          <LiveTripSubnav tripId={tripId} />
        </header>

        {loading || !trip ? <WorkspaceSkeleton /> : (
          <>
            {days.length > 0 && <DaySelector days={days} value={selectedDay} onChange={changeDay} />}
            {readOnly && <p className="tm-readonly">这段旅行已归档，只能查看。取消归档后才能继续安排和打卡。</p>}
            <div className="tm-layout">
              <div className="tm-map-area">
                <TripMapCanvas
                  points={points} route={route} selectedKey={selectedKey} selectNonce={selectNonce} onSelect={select} fitKey={String(selectedDay)} center={destination?.center}
                  preview={preview} picking={picking}
                  onPick={(lat, lng) => { setPicked({ lat, lng }); setPicking(false) }}
                />
                <ul className="tm-legend" aria-label="图例">
                  <li><span className="tm-marker is-checkedIn" aria-hidden="true" /> 已打卡</li>
                  <li><span className="tm-marker is-planned" aria-hidden="true">1</span> 计划（按时间编号）</li>
                  <li><span className="tm-marker is-saved" aria-hidden="true" /> 收藏 / 自定义</li>
                </ul>
              </div>
              <aside className="tm-panel-area">
                <JourneyPanel
                  days={days} day={selectedDay} stops={dayStops} next={next} distance={distance} selectedKey={selectedKey} readOnly={readOnly}
                  onSelect={select} onCheckin={checkin} onAdd={() => setAdding(true)} onRemove={s => void removePlan(s)} onShowRecord={showRecord}
                />
              </aside>
              <div className="tm-timeline-area">
                <TravelTimeline days={days} stops={dayStops} selectedKey={selectedKey} readOnly={readOnly} onSelect={select} onUndo={s => void undo(s)} />
              </div>
            </div>

            {!readOnly && (
              <div className="tm-mobile-actions">
                <button type="button" className="tm-btn" onClick={() => setAdding(true)}><Plus size={16} /> 添加地点</button>
                <button type="button" className="tm-btn is-primary" onClick={() => quickCheckin(next ? { placeId: next.stop.placeId, placeName: next.stop.name, area: next.stop.area, itineraryItemId: next.stop.itineraryId, date: next.stop.date } : undefined)}>
                  <Camera size={16} /> 快速打卡
                </button>
              </div>
            )}

            {adding && (
              <AddPlaceDialog
                trip={trip} official={destination?.official ?? null} days={days} day={selectedDay} inTrip={inTrip} hidden={picking} picked={picked}
                onRequestPick={() => { setPicked(null); setPicking(true); showToast('点击地图选择位置') }}
                onClose={() => { setAdding(false); setPicking(false); setPicked(null) }}
                onDone={(msg, focus) => {
                  setAdding(false); setPicked(null); showToast(msg)
                  if (focus) { setDay(focus.day); setSelectedKey(focus.selectKey ?? null) }
                  void load(true)
                }}
                onCheckin={prefill => quickCheckin(prefill)}
                onPreview={p => { setAdding(false); setSelectedKey(null); setPreview(p) }}
              />
            )}
          </>
        )}
        {toast && <div className="ts-toast" role="status" aria-live="polite">{toast}</div>}
      </section>
    </main>
  )
}

function WorkspaceSkeleton() {
  return (
    <div aria-busy="true" aria-label="正在加载旅行地图">
      <div className="tm-days">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ width: 76, height: 46, borderRadius: 12 }} />)}</div>
      <div className="tm-layout">
        <div className="tm-map-area"><div className="skeleton tm-map-sk" /></div>
        <aside className="tm-panel-area">
          <div className="tm-panel">
            <div className="skeleton" style={{ width: 120, height: 22, borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 54, borderRadius: 12, marginTop: 14 }} />
            <div className="skeleton" style={{ height: 96, borderRadius: 14, marginTop: 14 }} />
            {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 12, marginTop: 10 }} />)}
          </div>
        </aside>
        <div className="tm-timeline-area">
          <div className="tm-timeline">{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginTop: 10 }} />)}</div>
        </div>
      </div>
    </div>
  )
}
