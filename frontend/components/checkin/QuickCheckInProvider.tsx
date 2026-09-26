'use client'

/**
 * 全局快速打卡：Header、Hero、今天可以做、移动端悬浮按钮都调用同一个 openQuickCheckIn()，
 * 业务逻辑只有这一份（复用 tripApi.addCheckin / uploadTripPhoto，不新建打卡模型）。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Camera, Crosshair, Loader2, MapPin, X } from 'lucide-react'
import { tripApi, uploadTripPhoto, type PlaceView, type TripView } from '@/services/tabitrace-api'
import { localDateKey, offsetIso, pad } from '@/lib/time'

/** 预填：从地图工作台“到达打卡”进入时带上地点 / 行程项，打卡会自动完成对应行程 */
export type QuickCheckInPrefill = {
  placeId?: number
  placeName?: string
  area?: string
  itineraryItemId?: number
  /** 今天不在旅行日期内时使用的日期（例如计划的日期） */
  date?: string
  note?: string
  latitude?: number
  longitude?: number
}

type QuickCheckInContextValue = {
  openQuickCheckIn: (tripId?: number, prefill?: QuickCheckInPrefill) => void
  /** 每次打卡成功后自增，首页等页面据此刷新数据 */
  checkinVersion: number
}

const QuickCheckInContext = createContext<QuickCheckInContextValue>({ openQuickCheckIn: () => {}, checkinVersion: 0 })

export function useQuickCheckIn() {
  return useContext(QuickCheckInContext)
}

export function QuickCheckInProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [requestedTripId, setRequestedTripId] = useState<number | null>(null)
  const [prefill, setPrefill] = useState<QuickCheckInPrefill | null>(null)
  const [version, setVersion] = useState(0)

  const openQuickCheckIn = useCallback((tripId?: number, p?: QuickCheckInPrefill) => {
    setRequestedTripId(tripId ?? null)
    setPrefill(p ?? null)
    setOpen(true)
  }, [])

  const value = useMemo(() => ({ openQuickCheckIn, checkinVersion: version }), [openQuickCheckIn, version])

  return (
    <QuickCheckInContext.Provider value={value}>
      {children}
      {open && (
        <QuickCheckInModal
          preferredTripId={requestedTripId}
          prefill={prefill}
          onClose={() => setOpen(false)}
          onSaved={() => { setVersion(v => v + 1); setOpen(false) }}
        />
      )}
    </QuickCheckInContext.Provider>
  )
}

function nowTime() {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function QuickCheckInModal({ preferredTripId, prefill, onClose, onSaved }: { preferredTripId: number | null; prefill: QuickCheckInPrefill | null; onClose: () => void; onSaved: () => void }) {
  const [trips, setTrips] = useState<TripView[]>([])
  const [tripId, setTripId] = useState<number | null>(preferredTripId)
  const [places, setPlaces] = useState<PlaceView[]>([])
  const [placeId, setPlaceId] = useState<number | null>(prefill?.placeId ?? null)
  const [placeName, setPlaceName] = useState(prefill?.placeName ?? '')
  const [area, setArea] = useState(prefill?.area ?? '')
  const [date, setDate] = useState('')
  const [time, setTime] = useState(nowTime())
  const [note, setNote] = useState(prefill?.note ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(prefill?.latitude != null && prefill?.longitude != null ? { lat: prefill.latitude, lng: prefill.longitude } : null)
  const [locating, setLocating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDivElement | null>(null)

  const trip = trips.find(t => t.id === tripId) || null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    (async () => {
      try {
        const rows = await tripApi.list()
        setTrips(rows)
        const stored = Number(localStorage.getItem('tabitrace-live-trip-id') || 0)
        const usable = rows.filter(t => t.status !== 'ARCHIVED')
        const picked = rows.find(t => t.id === preferredTripId) || usable.find(t => t.id === stored) || usable[0] || rows[0] || null
        setTripId(picked ? picked.id : null)
      } catch (e: any) {
        setError(e?.message || '无法读取旅行列表')
      } finally {
        setLoading(false)
      }
    })()
  }, [preferredTripId])

  useEffect(() => {
    if (!trip) return
    const today = localDateKey(new Date())
    const inTrip = today >= trip.startDate && today <= trip.endDate
    setDate(inTrip ? today : prefill?.date && prefill.date >= trip.startDate && prefill.date <= trip.endDate ? prefill.date : today < trip.startDate ? trip.startDate : trip.endDate)
    tripApi.places(trip.id).then(setPlaces).catch(() => setPlaces([]))
  }, [trip?.id, trip?.startDate, trip?.endDate])

  function pickPlace(value: string) {
    const id = Number(value)
    if (!id) { setPlaceId(null); return }
    const p = places.find(x => x.id === id)
    setPlaceId(id)
    if (p) { setPlaceName(p.name); setArea(p.area || '') }
  }

  // 已经授权过定位时自动带上当前位置；没有授权时不主动弹出请求，由用户点击“获取我的位置”
  useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions?.query) return
    if (prefill?.latitude != null) return
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(r => { if (r.state === 'granted') locate() }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function locate() {
    if (!navigator.geolocation) { setError('当前浏览器不支持定位'); return }
    setLocating(true); setError('')
    navigator.geolocation.getCurrentPosition(
      pos => { setCoords({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }); setLocating(false) },
      err => { setError(err.code === err.PERMISSION_DENIED ? '定位权限被拒绝，可手动填写地点' : '定位失败，可手动填写地点'); setLocating(false) },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  async function submit() {
    if (!trip) { setError('请先创建一段旅行'); return }
    if (!placeId && !placeName.trim()) { setError('请选择地点或填写地点名称'); return }
    if (!date) { setError('请选择打卡日期'); return }
    if (file && !file.type.startsWith('image/')) { setError('请选择图片文件'); return }
    if (file && file.size > 20 * 1024 * 1024) { setError('单张照片不能超过 20MB'); return }
    setBusy(true); setError('')
    try {
      const checkin = await tripApi.addCheckin(trip.id, {
        placeId: placeId ?? undefined,
        // 从行程进入时一并完成该行程（后端会把行程标记为已完成）；用户改选了别的地点则不再关联
        itineraryItemId: prefill?.itineraryItemId && (placeId ?? null) === (prefill.placeId ?? null) ? prefill.itineraryItemId : undefined,
        placeName: placeId ? undefined : placeName.trim(),
        area: area.trim() || undefined,
        checkinTime: offsetIso(date, time),
        note: note.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng
      })
      if (file) {
        await uploadTripPhoto(trip.id, file, { checkinId: checkin.id, featured: true, capturedAt: offsetIso(date, time) })
      }
      localStorage.setItem('tabitrace-live-trip-id', String(trip.id))
      onSaved()
    } catch (e: any) {
      setError(e?.message || '打卡保存失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" ref={dialogRef} role="dialog" aria-modal="true" aria-label="快速打卡">
        <div className="modal-head">
          <div>
            <p className="text-[10px] font-bold tracking-[.18em] text-warm">QUICK CHECK-IN</p>
            <h2 className="mt-1 font-serif text-2xl">{prefill?.placeName ? `到达打卡 · ${prefill.placeName}` : '快速打卡'}</h2>
          </div>
          <button onClick={onClose} aria-label="关闭快速打卡" className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-black/45">正在准备打卡…</div>
        ) : !trip ? (
          <div className="p-6 text-center">
            <p className="text-sm text-black/55">还没有可记录的旅行。</p>
            <a href="/trips/new" className="warm-button mx-auto mt-4 w-fit">创建旅行</a>
          </div>
        ) : (
          <div className="modal-body">
            {trips.filter(t => t.status !== 'ARCHIVED').length > 1 && (
              <label className="block">
                <span className="field-label">记录到哪段旅行</span>
                <select value={tripId ?? ''} onChange={e => setTripId(Number(e.target.value))} className="field">
                  {trips.filter(t => t.status !== 'ARCHIVED').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </label>
            )}

            <label className="block">
              <span className="field-label">选择旅行中的地点</span>
              <select value={placeId ?? ''} onChange={e => pickPlace(e.target.value)} className="field">
                <option value="">手动填写新地点</option>
                {/* 预填的地点还不在这段旅行里（例如刚从搜索结果打卡）：保存时后端会把它加入旅行 */}
                {prefill?.placeId && !places.some(p => p.id === prefill.placeId) && <option value={prefill.placeId}>{prefill.placeName}{prefill.area ? ` · ${prefill.area}` : ''}</option>}
                {places.map(p => <option key={p.id} value={p.id}>{p.name}{p.area ? ` · ${p.area}` : ''}</option>)}
              </select>
            </label>

            {!placeId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="field-label">地点名称</span>
                  <input value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder="例如：浅草寺" className="field" /></label>
                <label className="block"><span className="field-label">区域 / 城市</span>
                  <input value={area} onChange={e => setArea(e.target.value)} placeholder="例如：浅草" className="field" /></label>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="field-label">日期</span>
                <input type="date" value={date} min={trip.startDate} max={trip.endDate} onChange={e => setDate(e.target.value)} className="field" /></label>
              <label className="block"><span className="field-label">时间</span>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="field" /></label>
            </div>

            <label className="block"><span className="field-label">这一刻的记录</span>
              <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="写点什么，之后回看会很有意思" className="field" /></label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">照片（可选，同时设为精选）</span>
                <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="field !py-2.5 text-xs" />
              </label>
              <div>
                <span className="field-label">当前位置（可选）</span>
                <button type="button" onClick={locate} disabled={locating} className="field flex items-center gap-2 text-left text-xs text-black/55 disabled:opacity-60">
                  {locating ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} className="text-warm" />}
                  {coords ? `${coords.lat}, ${coords.lng}` : locating ? '正在定位…' : '获取我的位置'}
                </button>
              </div>
            </div>

            {error && <p className="rounded-xl bg-warm/10 px-4 py-3 text-xs text-warm">{error}</p>}

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={submit} disabled={busy} className="warm-button flex-1 justify-center py-3.5 disabled:opacity-60">
                {busy ? <><Loader2 size={15} className="animate-spin" /> 正在保存…</> : <><Camera size={15} /> 保存打卡</>}
              </button>
              <a href={`/trips/${trip.id}/map`} className="inline-flex items-center gap-1.5 rounded-[13px] border border-black/10 bg-white px-4 py-3.5 text-xs font-bold text-black/55">
                <MapPin size={14} /> 去地图工作台
              </a>
            </div>
            <p className="text-[11px] leading-5 text-black/35">打卡日期需要在 {trip.startDate} — {trip.endDate} 之间；FREE 旅行最多 10 个打卡。</p>
          </div>
        )}
      </div>
    </div>
  )
}
