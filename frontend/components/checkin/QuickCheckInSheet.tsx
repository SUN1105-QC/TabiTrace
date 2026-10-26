'use client'

/**
 * 快速打卡 · 拍照优先、自动记录、一步保存。
 * 顺序：标题 → 当前旅行 → 拍照 / 相册 → 照片预览 → 此刻心情（选填）→ 自动记录（地点 / 时间 / 天气）→ 保存这一刻。
 * - 时间：拍照 / 选图的那一刻（相册 JPEG 优先用照片自带的拍摄时间），按用户时区显示；同时记录设备时区
 * - 地点：浏览器定位（需要用户授权）→ 后端逆地理编码到街区级（「浅草 · 臺東區」），不擅自认定具体店铺
 * - 天气：打卡时刻的真实天气（Open-Meteo 实况 / 历史整点），拿不到就显示「暂未获取」，从不编造
 * - 地点、天气、心情都不阻止保存；「修改记录信息」里保留手动修改地点与时间的能力
 * - 保存：照片先上传到存储，再由 POST /trips/{id}/quick-checkins 在同一事务里写入打卡 + 天气 + 照片；任何一步失败都不会显示成功
 * 打卡时刻不是「此刻」（旧照片、旅行日期不含今天）时，不自动套用当前位置与天气，由用户决定。
 */

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, Check, ChevronDown, Clock3, CloudSun, Images, Loader2, MapPin, Plus, RefreshCw, RotateCcw, X } from 'lucide-react'
import { geoApi, stageTripPhoto, tripApi, PHOTO_MAX_BYTES, type PlaceView, type ReverseGeo, type StagedPhoto, type TripView, type WeatherSnapshot } from '@/services/tabitrace-api'
import { localDateKey, offsetIso, pad, toDate, zonedParts } from '@/lib/time'
import { readExifDate } from '@/utils/gallery'
import type { QuickCheckInPrefill } from './QuickCheckInProvider'

type Source = 'camera' | 'album'
type Photo = { id: string; file: File; url: string; takenAt: Date; exif: boolean }
type LocState = { status: 'locating' | 'ok' | 'denied' | 'unavailable' | 'timeout' | 'insecure' | 'off'; lat?: number; lng?: number; accuracy?: number }
type Load<T> = { status: 'idle' | 'loading' | 'ok' | 'failed'; data?: T | null }
export type IncomingPhotos = { files: File[]; source: Source; nonce: number }

const MAX_PHOTOS = 9
/** 打卡时刻与现在相差超过这么久，就不是「此刻」：不自动使用当前位置和天气 */
const LIVE_WINDOW_MS = 3 * 3600_000
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const deviceZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined } catch { return undefined } }
const partsOf = (d: Date) => { const p = zonedParts(d); return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` } }
const dayLabel = (date: string, time: string) => {
  const [y, m, d] = date.split('-').map(Number)
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}月${d}日 周${WEEK[w]} ${time}`
}
const clampDate = (d: string, t: TripView) => (d < t.startDate ? t.startDate : d > t.endDate ? t.endDate : d)
const friendly = (e: unknown) => (e instanceof Error && e.message ? e.message : '保存失败，请检查网络后重试')

export function QuickCheckInSheet({ preferredTripId, prefill, incoming, onClose, onSaved }: {
  preferredTripId: number | null
  prefill: QuickCheckInPrefill | null
  incoming: IncomingPhotos | null
  onClose: () => void
  onSaved: () => void
}) {
  // ── 旅行 ──
  const [trips, setTrips] = useState<TripView[]>([])
  const [tripId, setTripId] = useState<number | null>(null)
  const [loadingTrips, setLoadingTrips] = useState(true)
  const [tripError, setTripError] = useState('')
  const [switching, setSwitching] = useState(false)
  const [places, setPlaces] = useState<PlaceView[]>([])
  const trip = trips.find(t => t.id === tripId) ?? null
  const usable = useMemo(() => trips.filter(t => t.status !== 'ARCHIVED'), [trips])

  // ── 照片与时间 ──
  const [photos, setPhotos] = useState<Photo[]>([])
  const [openedAt] = useState(() => new Date())
  const [note, setNote] = useState(prefill?.note ?? '')
  const cameraInput = useRef<HTMLInputElement | null>(null)
  const albumInput = useRef<HTMLInputElement | null>(null)
  const replaceMode = useRef<'add' | 'replace'>('add')

  // ── 自动信息 ──
  const prefillCoords = prefill?.latitude != null && prefill?.longitude != null
  const [loc, setLoc] = useState<LocState>({ status: prefillCoords ? 'ok' : 'locating', lat: prefill?.latitude, lng: prefill?.longitude })
  const [geo, setGeo] = useState<Load<ReverseGeo>>({ status: 'idle' })
  const [weather, setWeather] = useState<Load<WeatherSnapshot>>({ status: 'idle' })
  const [useCurrentAnyway, setUseCurrentAnyway] = useState(false)
  const [nearChosen, setNearChosen] = useState(false)

  // ── 手动修改（折叠） ──
  const [editOpen, setEditOpen] = useState(false)
  const [editPlaceId, setEditPlaceId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editArea, setEditArea] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')

  // ── 保存 ──
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<{ tripId: number; placeName: string; photos: number; when: string } | null>(null)
  const busy = useRef(false)
  const staged = useRef(new Map<string, StagedPhoto>())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  // 关闭时释放照片预览占用的内存
  const urls = useRef<string[]>([])
  useEffect(() => () => { urls.current.forEach(u => URL.revokeObjectURL(u)) }, [])

  // 选择旅行：指定的旅行 → 今天在日期范围内的旅行（多段时优先最近使用的）→ 最近使用的 → 第一段未归档的
  useEffect(() => {
    let alive = true
    tripApi.list().then(rows => {
      if (!alive) return
      setTrips(rows)
      const today = localDateKey(new Date())
      const open = rows.filter(t => t.status !== 'ARCHIVED')
      const current = open.filter(t => t.startDate <= today && today <= t.endDate)
      const stored = Number(localStorage.getItem('tabitrace-live-trip-id') || 0)
      const picked = rows.find(t => t.id === preferredTripId)
        ?? current.find(t => t.id === stored) ?? current[0]
        ?? open.find(t => t.id === stored) ?? open[0] ?? null
      setTripId(picked?.id ?? null)
    }).catch(e => { if (alive) setTripError(friendly(e)) }).finally(() => { if (alive) setLoadingTrips(false) })
    return () => { alive = false }
  }, [preferredTripId])

  useEffect(() => {
    if (!trip) return
    let alive = true
    tripApi.places(trip.id).then(p => { if (alive) setPlaces(p) }).catch(() => { if (alive) setPlaces([]) })
    return () => { alive = false }
  }, [trip])

  // ── 定位：打开时自动请求（浏览器会询问授权）；需要 HTTPS 等安全上下文 ──
  const locate = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!window.isSecureContext) { setLoc({ status: 'insecure' }); return }
    if (!navigator.geolocation) { setLoc({ status: 'unavailable' }); return }
    setLoc({ status: 'locating' })
    navigator.geolocation.getCurrentPosition(
      p => setLoc({ status: 'ok', lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)), accuracy: Math.round(p.coords.accuracy) }),
      err => setLoc({ status: err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }, [])
  useEffect(() => { if (!prefillCoords) locate() }, [prefillCoords, locate])

  // ── 照片 ──
  const addFiles = useCallback(async (files: File[], source: Source, mode: 'add' | 'replace') => {
    const images = files.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name))
    if (images.length < files.length) setError('只能选择图片文件')
    const tooBig = images.find(f => f.size > PHOTO_MAX_BYTES)
    if (tooBig) { setError('单张照片不能超过 20MB'); return }
    const picked = new Date()
    const next: Photo[] = []
    for (const file of images) {
      // 相册里的 JPEG 优先用照片自带的拍摄时间（按设备时区解释），相机现拍用按下快门后返回的时刻
      const exif = source === 'album' ? await readExifDate(file) : null
      const exifAt = exif ? toDate(offsetIso(exif.date, exif.time, deviceZone())) : null
      const url = URL.createObjectURL(file)
      urls.current.push(url)
      next.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, file, url, takenAt: exifAt && exifAt.getTime() <= Date.now() + 60_000 ? exifAt : picked, exif: Boolean(exifAt) })
    }
    if (!next.length) return
    setError('')
    setPhotos(prev => (mode === 'replace' ? next : [...prev, ...next]).slice(0, MAX_PHOTOS))
  }, [])

  useEffect(() => {
    if (incoming?.files.length) void addFiles(incoming.files, incoming.source, 'replace')
  }, [incoming, addFiles])

  function pick(source: Source, mode: 'add' | 'replace') {
    replaceMode.current = mode
    const input = source === 'camera' ? cameraInput.current : albumInput.current
    if (!input) return
    input.value = ''
    input.click()
  }

  // ── 打卡时刻 ──
  const lead = photos[0]
  const whenAt = lead?.takenAt ?? openedAt
  const whenSource = lead ? (lead.exif ? '照片拍摄时间' : '拍照时间') : '打开时间'
  const auto = partsOf(whenAt)
  const inRange = trip ? auto.date >= trip.startDate && auto.date <= trip.endDate : true
  const fallbackDate = trip ? (prefill?.date && prefill.date >= trip.startDate && prefill.date <= trip.endDate ? prefill.date : clampDate(auto.date, trip)) : auto.date
  const effDate = editDate || (inRange ? auto.date : fallbackDate)
  const effTime = editTime || auto.time
  const checkinIso = offsetIso(effDate, effTime)
  const effAt = toDate(checkinIso) ?? whenAt
  const live = Math.abs(effAt.getTime() - openedAt.getTime()) <= LIVE_WINDOW_MS
  const manualTime = Boolean(editDate || editTime) || !inRange

  // 旅行日期不含今天：自动展开「修改记录信息」，把日期放进旅行范围并说明
  useEffect(() => { if (trip && !inRange) setEditOpen(true) }, [trip, inRange])

  // 当前位置只有在「此刻」的打卡里才自动使用；行程带来的地点坐标始终可用
  const coordsUsable = loc.status === 'ok' && loc.lat != null && (prefillCoords || live || useCurrentAnyway)
  const lat = coordsUsable ? loc.lat : undefined
  const lng = coordsUsable ? loc.lng : undefined

  // ── 逆地理编码 ──
  useEffect(() => {
    if (lat == null || lng == null || prefill?.placeName) { setGeo({ status: 'idle' }); return }
    let alive = true
    setGeo({ status: 'loading' })
    geoApi.reverse(lat, lng, loc.accuracy, trip?.id).then(g => { if (alive) setGeo({ status: g ? 'ok' : 'failed', data: g }) }).catch(() => { if (alive) setGeo({ status: 'failed' }) })
    return () => { alive = false }
  }, [lat, lng, loc.accuracy, trip?.id, prefill?.placeName])

  // ── 天气：打卡时刻 + 坐标；时间或坐标变化后重新获取 ──
  useEffect(() => {
    if (lat == null || lng == null) { setWeather({ status: 'idle' }); return }
    let alive = true
    setWeather({ status: 'loading' })
    const t = window.setTimeout(() => {
      geoApi.weather(lat, lng, checkinIso).then(w => { if (alive) setWeather({ status: w ? 'ok' : 'failed', data: w }) }).catch(() => { if (alive) setWeather({ status: 'failed' }) })
    }, 250)
    return () => { alive = false; window.clearTimeout(t) }
  }, [lat, lng, checkinIso])

  // ── 地点（保存时用哪一个） ──
  const editPlace = places.find(p => p.id === editPlaceId)
  const near = geo.data?.nearPlaceId ? geo.data : null
  const place = editPlace ? { placeId: editPlace.id, name: editPlace.name, area: editPlace.area, how: '手动选择' }
    : editName.trim() ? { placeName: editName.trim(), name: editName.trim(), area: editArea.trim() || undefined, how: '手动填写' }
    : nearChosen && near ? { placeId: near.nearPlaceId, name: near.nearPlaceName!, area: geo.data?.area, how: '附近地点' }
    : prefill?.placeId || prefill?.placeName ? { placeId: prefill.placeId, placeName: prefill.placeId ? undefined : prefill.placeName, name: prefill.placeName ?? '', area: prefill.area, how: '来自行程' }
    : geo.status === 'ok' && geo.data?.placeName ? { placeName: geo.data.placeName, name: geo.data.label || geo.data.placeName, area: geo.data.area, how: '自动定位' }
    : null

  const canSave = Boolean(trip) && (photos.length > 0 || note.trim().length > 0 || Boolean(place))

  async function save() {
    if (!trip || busy.current || !canSave) return
    busy.current = true
    setError('')
    try {
      const list: StagedPhoto[] = []
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i]
        let s = staged.current.get(p.id)
        if (!s) {
          setStage(photos.length > 1 ? `正在上传照片 ${i + 1}/${photos.length}…` : '正在上传照片…')
          // 随手拍默认不设为精选：精选仍由用户在照片页决定
          s = await stageTripPhoto(trip.id, p.file, { featured: false, capturedAt: i === 0 && manualTime ? checkinIso : p.takenAt.toISOString() })
          staged.current.set(p.id, s)
        }
        list.push(s)
      }
      setStage('正在保存…')
      const r = await tripApi.quickCheckin(trip.id, {
        checkin: {
          placeId: place?.placeId,
          // 从行程「到达打卡」进入且没有改地点时，一并完成该行程
          itineraryItemId: prefill?.itineraryItemId && place?.how === '来自行程' ? prefill.itineraryItemId : undefined,
          placeName: place?.placeId ? undefined : place?.placeName,
          area: place?.area || undefined,
          checkinTime: checkinIso,
          latitude: lat, longitude: lng,
          accuracyM: lat != null && !prefillCoords ? loc.accuracy : undefined,
          note: note.trim() || undefined,
          timezone: deviceZone()
        },
        photos: list,
        captureWeather: lat != null
      })
      localStorage.setItem('tabitrace-live-trip-id', String(trip.id))
      setSaved({ tripId: trip.id, placeName: r.checkin.placeName, photos: r.photos.length, when: dayLabel(effDate, effTime) })
      onSaved()
    } catch (e) {
      setError(friendly(e))
    } finally {
      busy.current = false
      setStage('')
    }
  }

  function again() {
    setSaved(null); setPhotos([]); setNote(''); setError(''); staged.current.clear()
    setEditPlaceId(null); setEditName(''); setEditArea(''); setEditDate(''); setEditTime(''); setNearChosen(false)
    if (!prefillCoords) locate()
    window.setTimeout(() => pick('camera', 'replace'), 0)
  }

  // ── 自动记录的展示文字 ──
  const locText = (() => {
    if (place && place.how !== '自动定位') return { main: place.name + (place.area && !place.name.includes(place.area) ? ` · ${place.area}` : ''), sub: place.how, state: 'ok' as const }
    if (loc.status === 'ok' && !coordsUsable) return { main: '未使用当前位置', sub: '这条记录不是此刻发生的，当前位置可能不是当时所在的地方', state: 'skip' as const }
    if (loc.status === 'locating') return { main: '定位中…', sub: '', state: 'loading' as const }
    if (loc.status === 'ok') {
      if (geo.status === 'loading') return { main: '正在识别地点…', sub: loc.accuracy ? `定位精度约 ${loc.accuracy} 米` : '', state: 'loading' as const }
      if (geo.status === 'ok' && geo.data) return { main: geo.data.label || geo.data.placeName || '已定位', sub: loc.accuracy ? `自动定位 · 精度约 ${loc.accuracy} 米` : '自动定位', state: 'ok' as const }
      return { main: '已定位，地点名称暂未获取', sub: '会保存坐标；地点名称可在「修改记录信息」里补上', state: 'warn' as const }
    }
    const why = loc.status === 'denied' ? '没有定位权限，可在浏览器设置里允许' : loc.status === 'timeout' ? '定位超时' : loc.status === 'insecure' ? '当前连接不是 HTTPS，浏览器不允许定位' : '设备暂时无法定位'
    return { main: '位置暂未获取', sub: why, state: 'warn' as const }
  })()
  const wxText = weather.status === 'ok' && weather.data ? { main: `${Math.round(weather.data.temperatureC)}°C · ${weather.data.text}`, sub: `数据时间 ${partsOf(toDate(weather.data.observedAt) ?? effAt).time}` }
    : weather.status === 'loading' ? { main: '天气获取中…', sub: '' }
    : lat == null ? { main: '天气暂未获取', sub: '需要位置信息' }
    : { main: '天气暂未获取', sub: '天气服务暂时不可用，不影响保存' }

  const ongoingCount = trip ? usable.length : 0

  return (
    <div className="modal-backdrop qk-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !stage) onClose() }}>
      <div className="modal-panel qc-panel qk-sheet" role="dialog" aria-modal="true" aria-label="快速打卡">
        <i className="qk-grip" aria-hidden="true" />
        <header className="qk-head">
          <div>
            <p className="qk-eyebrow">QUICK CHECK-IN</p>
            <h2>{prefill?.placeName ? `到达打卡 · ${prefill.placeName}` : '快速打卡'}</h2>
          </div>
          <button type="button" className="qk-close" onClick={onClose} aria-label="关闭快速打卡" disabled={Boolean(stage)}><X size={18} /></button>
        </header>

        {/* 两个真实的文件入口：相机（capture=environment，不支持时浏览器会退回普通选图）与相册 */}
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden
          onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) void addFiles(f, 'camera', replaceMode.current) }} />
        <input ref={albumInput} type="file" accept="image/*" multiple hidden
          onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) void addFiles(f, 'album', replaceMode.current) }} />

        {loadingTrips ? (
          <div className="qk-body"><p className="qk-muted"><Loader2 size={14} className="animate-spin" /> 正在准备…</p></div>
        ) : tripError ? (
          <div className="qk-body"><p className="qk-error"><AlertTriangle size={14} /> {tripError}</p></div>
        ) : !trip ? (
          <div className="qk-body qk-empty">
            <p>还没有可以记录的旅行。</p>
            <small>创建一段旅行后，拍下的每个瞬间都会自动整理进它的时间轴和地图。</small>
            <Link href="/trips/new" className="warm-button" onClick={onClose}>创建旅行</Link>
          </div>
        ) : saved ? (
          <div className="qk-body qk-done" role="status">
            <span className="qk-done-mark"><Check size={26} strokeWidth={2.6} /></span>
            <h3>这一刻已保存</h3>
            <p>{saved.placeName} · {saved.when}{saved.photos ? ` · ${saved.photos} 张照片` : ''}</p>
            <div className="qk-done-actions">
              <button type="button" className="warm-button" onClick={again}><Camera size={16} /> 继续拍照</button>
              <Link href={`/trips/${saved.tripId}/map#tm-timeline-title`} className="qk-btn" onClick={onClose}>查看时间轴</Link>
              <button type="button" className="qk-btn" onClick={onClose}>完成</button>
            </div>
          </div>
        ) : (
          <>
            <div className="qk-body">
              <div className="qk-trip">
                <span>记录到</span>
                <b title={trip.title}>{trip.title}</b>
                {ongoingCount > 1 && <button type="button" onClick={() => setSwitching(s => !s)} aria-expanded={switching}>切换 <ChevronDown size={13} className={switching ? 'is-open' : ''} /></button>}
              </div>
              {switching && (
                <div className="qk-trips" role="radiogroup" aria-label="选择旅行">
                  {usable.map(t => (
                    <button key={t.id} type="button" role="radio" aria-checked={t.id === trip.id} className={t.id === trip.id ? 'is-active' : ''}
                      onClick={() => { setTripId(t.id); setSwitching(false); setEditPlaceId(null); setNearChosen(false) }}>
                      <b>{t.title}</b><small>{t.startDate.replace(/-/g, '.')} — {t.endDate.slice(5).replace('-', '.')}</small>
                    </button>
                  ))}
                </div>
              )}

              {photos.length === 0 ? (
                <div className="qk-capture">
                  <button type="button" className="qk-shoot" onClick={() => pick('camera', 'replace')}>
                    <span className="qk-shoot-icon"><Camera size={30} /></span>
                    <b>快速拍照</b>
                    <small>拍下这一刻，时间、地点和天气自动记录</small>
                  </button>
                  <button type="button" className="qk-album" onClick={() => pick('album', 'add')}><Images size={16} /> 从相册选择</button>
                </div>
              ) : (
                <div className="qk-preview">
                  <div className="qk-photo">
                    <img src={photos[0].url} alt="这一刻的照片" />
                    {photos.length > 1 && <span className="qk-count">{photos.length} 张</span>}
                  </div>
                  {photos.length > 1 && (
                    <ul className="qk-thumbs">
                      {photos.map((p, i) => (
                        <li key={p.id}>
                          <img src={p.url} alt={`第 ${i + 1} 张`} />
                          <button type="button" onClick={() => { setPhotos(ps => ps.filter(x => x.id !== p.id)); staged.current.delete(p.id) }} aria-label={`移除第 ${i + 1} 张`}><X size={12} /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="qk-photo-actions">
                    <button type="button" onClick={() => { staged.current.clear(); pick('camera', 'replace') }}><RotateCcw size={14} /> 重拍</button>
                    <button type="button" onClick={() => { staged.current.clear(); pick('album', 'replace') }}><Images size={14} /> 更换照片</button>
                    {photos.length < MAX_PHOTOS && <button type="button" onClick={() => pick('album', 'add')}><Plus size={14} /> 继续添加</button>}
                  </div>
                </div>
              )}

              <label className="qk-note">
                <span>此刻想说点什么？<small>选填 · 不写也可以直接保存</small></span>
                <textarea value={note} maxLength={4000} rows={2} onChange={e => setNote(e.target.value)} placeholder="写点什么，之后回看会很有意思……" />
              </label>

              <section className="qk-meta" aria-label="自动记录">
                <p className="qk-meta-title">自动记录</p>
                <div className={`qk-meta-row is-${locText.state}`}>
                  <MapPin size={16} aria-hidden="true" />
                  <span><b>{locText.main}</b>{locText.sub && <small>{locText.sub}</small>}</span>
                  {(loc.status === 'denied' || loc.status === 'timeout' || loc.status === 'unavailable') && !place && <button type="button" onClick={locate}><RefreshCw size={12} /> 重新定位</button>}
                  {locText.state === 'skip' && <button type="button" onClick={() => setUseCurrentAnyway(true)}>仍使用当前位置</button>}
                  {loc.status === 'locating' && <Loader2 size={14} className="animate-spin qk-spin" aria-hidden="true" />}
                </div>
                {near && !editPlace && !editName.trim() && !prefill?.placeName && (
                  <button type="button" className={`qk-near${nearChosen ? ' is-on' : ''}`} onClick={() => setNearChosen(v => !v)} aria-pressed={nearChosen}>
                    {nearChosen ? <Check size={13} /> : <MapPin size={13} />} {(near.nearPlaceDistanceM ?? 0) < 10 ? `你就在「${near.nearPlaceName}」旁边` : `附近 ${near.nearPlaceDistanceM} 米是「${near.nearPlaceName}」`}{nearChosen ? '，已记为这里' : '，记为这里？'}
                  </button>
                )}
                <div className="qk-meta-row">
                  <Clock3 size={16} aria-hidden="true" />
                  <span><b>{dayLabel(effDate, effTime)}</b><small>{editDate || editTime ? '已手动修改' : !inRange ? '旅行日期不含今天，已调整到旅行期间' : whenSource}</small></span>
                </div>
                <div className={`qk-meta-row is-${weather.status === 'ok' ? 'ok' : weather.status === 'loading' ? 'loading' : 'warn'}`}>
                  <CloudSun size={16} aria-hidden="true" />
                  <span><b>{wxText.main}</b>{wxText.sub && <small>{wxText.sub}</small>}</span>
                  {weather.status === 'loading' && <Loader2 size={14} className="animate-spin qk-spin" aria-hidden="true" />}
                </div>
              </section>

              <details className="qk-edit" open={editOpen} onToggle={e => setEditOpen((e.currentTarget as HTMLDetailsElement).open)}>
                <summary><ChevronDown size={14} /> 修改记录信息<small>地点或时间不对时再改</small></summary>
                {!inRange && <p className="qk-hint">这段旅行是 {trip.startDate.replace(/-/g, '.')} — {trip.endDate.replace(/-/g, '.')}，今天不在其中，已记为 {fallbackDate.replace(/-/g, '.')}，可以在这里改。</p>}
                <div className="qk-edit-grid">
                  {places.length > 0 && (
                    <label className="is-wide"><span>旅行中的地点</span>
                      <select value={editPlaceId ?? ''} onChange={e => setEditPlaceId(Number(e.target.value) || null)}>
                        <option value="">不选择</option>
                        {places.map(p => <option key={p.id} value={p.id}>{p.name}{p.area ? ` · ${p.area}` : ''}</option>)}
                      </select>
                    </label>
                  )}
                  {!editPlace && (
                    <>
                      <label><span>地点名称</span><input value={editName} maxLength={200} onChange={e => setEditName(e.target.value)} placeholder={geo.data?.placeName ?? '例如：浅草寺'} /></label>
                      <label><span>区域 / 城市</span><input value={editArea} maxLength={100} onChange={e => setEditArea(e.target.value)} placeholder={geo.data?.area ?? '例如：浅草'} /></label>
                    </>
                  )}
                  <label><span>日期</span><input type="date" value={effDate} min={trip.startDate} max={trip.endDate} onChange={e => setEditDate(e.target.value)} /></label>
                  <label><span>时间</span><input type="time" value={effTime} onChange={e => setEditTime(e.target.value)} /></label>
                </div>
              </details>

              {error && <p className="qk-error" role="alert"><AlertTriangle size={14} /> {error}{!stage && canSave && <span> 可以直接再点一次保存重试。</span>}</p>}
            </div>

            <footer className="qc-actions qk-foot">
              {!canSave && <p className="qk-foot-hint">拍一张照片，或写一句话，就可以保存</p>}
              <button type="button" className="warm-button qk-save" onClick={() => void save()} disabled={!canSave || Boolean(stage)} aria-busy={Boolean(stage)}>
                {stage ? <><Loader2 size={16} className="animate-spin" /> {stage}</> : <>保存这一刻</>}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
