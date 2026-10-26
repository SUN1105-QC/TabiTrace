/**
 * Mock 模式的内存数据库：启动时把 dev/mocks 里的固定数据深拷贝一份，写操作只改这份内存，
 * 刷新页面后恢复为原始 Fixture，绝不会写入本地数据库或对象存储。
 *
 * 派生数据（总结、成就、时间线、最近记录、回忆、账户概览、分镜）都按后端的真实规则从基础数据计算，
 * 所以在 Mock 模式下新增打卡 / 照片后，各页面看到的是同一份、互相一致的数据。
 */

import { ApiError } from '@/services/api'
import type {
  AccountOverview, AchievementView, CheckinView, ItineraryView, PaymentView, PhotoView, PlaceView, PublicShareView, RecentRecord,
  ShareLinkView, TimelineDay, TripPlanView, TripSummary, TripView, UserView
} from '@/services/tabitrace-api'
import type { Creation, MemoriesView, MemoryTrip } from '@/services/memories'
import type { Scene, Storyboard, VideoDraft, VideoProject } from '@/types/video'
import { offsetIso, pad, toDate, zonedParts } from '@/lib/time'
import { mockAchievementDefs, MOCK_TOKYO_OFFICIAL_TOTAL } from '@/dev/mocks/achievements'
import { mockCheckins } from '@/dev/mocks/checkins'
import { ID_BASE } from '@/dev/mocks/ids'
import { mockPhotos } from '@/dev/mocks/photos'
import { defaultStorySettings, mockPayments, mockShares, mockVideos } from '@/dev/mocks/stories'
import { mockItinerary, mockTripPlaces, mockTrips } from '@/dev/mocks/trips'
import { mockSessions, mockUser } from '@/dev/mocks/users'

// 与后端一致的免费版规则
const FREE_ACTIVE_TRIP_LIMIT = 1
const FREE_CHECKIN_LIMIT = 10
const FREE_PHOTO_LIMIT = 10
/** 与后端 PaymentService 一致：单次旅行 ¥1.1、买断终身 Pro ¥1000（分） */
const TRIP_PRO_AMOUNT = 400
const LIFETIME_AMOUNT = 100000
const TRIP_PRO_CURRENCY = 'CNY'

type Share = ShareLinkView & { tripId: number }

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
const fail = (status: number, code: string, message: string): never => { throw new ApiError(message, status, code) }
/** 与后端 LocalDateTime 序列化一致：UTC、无时区后缀 */
const nowUtc = () => new Date().toISOString().replace('Z', '').replace(/\.\d+$/, '')

export class MockStore {
  user: UserView = clone(mockUser)
  sessions = clone(mockSessions)
  trips: TripView[] = clone(mockTrips)
  tripPlaces: Record<number, PlaceView[]> = clone(mockTripPlaces)
  itinerary: Record<number, ItineraryView[]> = clone(mockItinerary)
  checkins: CheckinView[] = clone(mockCheckins)
  photos: PhotoView[] = clone(mockPhotos)
  videos: VideoProject[] = clone(mockVideos)
  shares: Share[] = clone(mockShares)
  payments: PaymentView[] = clone(mockPayments)
  favorites = new Set<number>()
  /** Mock 上传的文件：storageKey → 当前标签页里的 object URL */
  uploads = new Map<string, string>()
  private seq = new Map<string, number>()

  constructor(origin: string) {
    for (const s of this.shares) s.url = `${origin}/s/${s.token}`
  }

  private nextId(kind: keyof typeof ID_BASE, existing: { id: number }[]) {
    const cur = this.seq.get(kind) ?? Math.max(ID_BASE[kind] + 100, ...existing.map(x => x.id))
    this.seq.set(kind, cur + 1)
    return cur + 1
  }

  get zone() { return this.user.timezone || 'Asia/Tokyo' }
  dateKey(iso?: string | null) { const d = toDate(iso); if (!d) return null; const p = zonedParts(d, this.zone); return `${p.year}-${pad(p.month)}-${pad(p.day)}` }
  /** 某个时刻在用户时区里的 ISO 字符串（带偏移），与后端返回格式一致 */
  zonedIso(iso: string) { const d = toDate(iso)!; const p = zonedParts(d, this.zone); return offsetIso(`${p.year}-${pad(p.month)}-${pad(p.day)}`, `${pad(p.hour)}:${pad(p.minute)}`, this.zone) }

  // ---------- 旅行 ----------
  trip(id: number) { return this.trips.find(t => t.id === id) ?? fail(404, 'TRIP_NOT_FOUND', '旅行不存在') }
  writable(id: number) { const t = this.trip(id); if (t.status === 'ARCHIVED') fail(409, 'TRIP_ARCHIVED', '旅行已归档，取消归档后才能修改'); return t }
  listTrips() { return [...this.trips].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')) }
  private freeActive() { return this.trips.filter(t => t.planType === 'FREE' && t.status !== 'ARCHIVED').length }

  createTrip(r: Partial<TripView> & { joinOfficialExplore?: boolean }) {
    if (!r.title?.trim() || !r.destinationName?.trim() || !r.startDate || !r.endDate) fail(400, 'VALIDATION_ERROR', '请填写旅行名称、目的地和日期')
    if (r.endDate! < r.startDate!) fail(400, 'INVALID_DATE_RANGE', '结束日期不能早于开始日期')
    // 已买断终身 Pro：新旅行直接是 PRO，不受免费旅行数量限制（与后端一致）
    const lifetime = Boolean(this.user.lifetimePro)
    if (!lifetime && this.freeActive() >= FREE_ACTIVE_TRIP_LIMIT) fail(409, 'FREE_TRIP_LIMIT', '免费版同时只能保留 1 个 FREE 旅行，请升级已有旅行或归档后再创建')
    const t: TripView = {
      id: Math.max(...this.trips.map(x => x.id)) + 1, title: r.title!.trim(), destinationName: r.destinationName!.trim(), countryCode: r.countryCode || undefined, city: r.city || undefined,
      startDate: r.startDate!, endDate: r.endDate!, peopleCount: r.peopleCount || 1, coverImage: r.coverImage || undefined, planType: lifetime ? 'PRO' : 'FREE', status: 'PLANNING', visibility: 'PRIVATE', createdAt: nowUtc()
    }
    this.trips.push(t); this.tripPlaces[t.id] = []; this.itinerary[t.id] = []
    return t
  }
  updateTrip(id: number, r: Partial<TripView>) {
    const t = this.writable(id)
    if (r.startDate && r.endDate && r.endDate < r.startDate) fail(400, 'INVALID_DATE_RANGE', '结束日期不能早于开始日期')
    Object.assign(t, { title: r.title ?? t.title, destinationName: r.destinationName ?? t.destinationName, countryCode: r.countryCode ?? t.countryCode, city: r.city ?? t.city,
      startDate: r.startDate ?? t.startDate, endDate: r.endDate ?? t.endDate, peopleCount: r.peopleCount ?? t.peopleCount, coverImage: r.coverImage || undefined })
    return t
  }
  deleteTrip(id: number) {
    this.trip(id)
    this.trips = this.trips.filter(t => t.id !== id)
    this.checkins = this.checkins.filter(c => c.tripId !== id)
    this.photos = this.photos.filter(p => p.tripId !== id)
    this.videos = this.videos.filter(v => v.tripId !== id)
    this.shares = this.shares.filter(s => s.tripId !== id)
    delete this.tripPlaces[id]; delete this.itinerary[id]
  }
  setStatus(id: number, status: string) {
    const t = this.trip(id)
    if (status === 'COMPLETED') this.writable(id)
    if (t.status === 'ARCHIVED' && status === 'COMPLETED' && t.planType === 'FREE' && this.freeActive() >= FREE_ACTIVE_TRIP_LIMIT)
      fail(409, 'FREE_TRIP_LIMIT', '免费版同时只能保留 1 个 FREE 旅行，请先归档其他旅行或升级 Trip Pro')
    t.status = status
    return t
  }

  // ---------- 地点与行程 ----------
  places(tripId: number) { this.trip(tripId); return this.tripPlaces[tripId] ?? [] }
  addPlace(tripId: number, place: PlaceView) {
    this.writable(tripId)
    const list = this.tripPlaces[tripId] ??= []
    if (!list.some(p => p.id === place.id)) list.push(clone(place))
    return place
  }
  customPlace(tripId: number, r: Partial<PlaceView>) {
    this.writable(tripId)
    if (!r.name?.trim()) fail(400, 'VALIDATION_ERROR', '请填写地点名称')
    const all = Object.values(this.tripPlaces).flat()
    const place: PlaceView = { id: this.nextId('place', all), name: r.name!.trim(), countryCode: r.countryCode, country: r.country, city: r.city, area: r.area, latitude: r.latitude, longitude: r.longitude, category: r.category || '自定义', sourceType: 'CUSTOM', tags: [] }
    ;(this.tripPlaces[tripId] ??= []).push(place)
    return place
  }
  removePlace(tripId: number, placeId: number) { this.writable(tripId); this.tripPlaces[tripId] = (this.tripPlaces[tripId] ?? []).filter(p => p.id !== placeId) }

  itineraryOf(tripId: number) { this.trip(tripId); return [...(this.itinerary[tripId] ?? [])].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || (a.plannedTime ?? '').localeCompare(b.plannedTime ?? '') || a.sortOrder - b.sortOrder) }
  private item(tripId: number, itemId: number) { return (this.itinerary[tripId] ?? []).find(i => i.id === itemId) ?? fail(404, 'ITINERARY_NOT_FOUND', '行程不存在') }
  addItinerary(tripId: number, r: Partial<ItineraryView> & { customPlaceName?: string }) {
    this.writable(tripId)
    const place = r.placeId ? this.findPlace(tripId, r.placeId) : undefined
    const list = this.itinerary[tripId] ??= []
    const it: ItineraryView = {
      id: this.nextId('itinerary', Object.values(this.itinerary).flat()), placeId: r.placeId, placeName: place?.name ?? r.customPlaceName ?? r.placeName ?? '未命名地点', area: r.area ?? place?.area,
      plannedDate: r.plannedDate ?? this.trip(tripId).startDate, plannedTime: r.plannedTime, note: r.note, latitude: r.latitude ?? place?.latitude, longitude: r.longitude ?? place?.longitude,
      status: r.status ?? 'PLANNED', sortOrder: list.length + 1, createdAt: nowUtc()
    }
    list.push(it)
    return it
  }
  updateItinerary(tripId: number, itemId: number, r: Partial<ItineraryView>) {
    this.writable(tripId)
    const it = this.item(tripId, itemId)
    for (const k of ['plannedDate', 'plannedTime', 'note', 'status', 'sortOrder', 'area'] as const) if (r[k] !== undefined) (it as Record<string, unknown>)[k] = r[k]
    return it
  }
  deleteItinerary(tripId: number, itemId: number) { this.writable(tripId); this.item(tripId, itemId); this.itinerary[tripId] = this.itinerary[tripId].filter(i => i.id !== itemId) }
  private findPlace(tripId: number, placeId: number) { return (this.tripPlaces[tripId] ?? []).find(p => p.id === placeId) ?? Object.values(this.tripPlaces).flat().find(p => p.id === placeId) }

  // ---------- 打卡 ----------
  checkinsOf(tripId: number) { this.trip(tripId); return this.checkins.filter(c => c.tripId === tripId).sort((a, b) => toDate(a.checkinTime)!.getTime() - toDate(b.checkinTime)!.getTime()) }
  checkin(id: number) { return this.checkins.find(c => c.id === id) ?? fail(404, 'CHECKIN_NOT_FOUND', '打卡不存在') }
  addCheckin(tripId: number, r: Partial<CheckinView>) {
    const t = this.writable(tripId)
    if (t.planType === 'FREE' && this.checkins.filter(c => c.tripId === tripId).length >= FREE_CHECKIN_LIMIT) fail(409, 'FREE_CHECKIN_LIMIT', `免费旅行最多 ${FREE_CHECKIN_LIMIT} 个打卡，请升级 Trip Pro`)
    if (!r.checkinTime) fail(400, 'VALIDATION_ERROR', '请选择打卡时间')
    const place = r.placeId ? this.findPlace(tripId, r.placeId) : undefined
    if (!place && !r.placeName?.trim()) fail(400, 'VALIDATION_ERROR', '请选择地点或填写地点名称')
    const c: CheckinView = {
      id: this.nextId('checkin', this.checkins), tripId, placeId: r.placeId, itineraryItemId: r.itineraryItemId, checkinType: 'MANUAL', checkinTime: this.zonedIso(r.checkinTime!),
      latitude: r.latitude ?? place?.latitude, longitude: r.longitude ?? place?.longitude, placeName: place?.name ?? r.placeName!.trim(), area: r.area ?? place?.area, note: r.note, createdAt: this.zonedIso(new Date().toISOString())
    }
    this.checkins.push(c)
    if (place) this.addPlace(tripId, place)
    if (r.itineraryItemId) { const it = (this.itinerary[tripId] ?? []).find(i => i.id === r.itineraryItemId); if (it) it.status = 'DONE' }
    if (t.status === 'PLANNING') t.status = 'ONGOING'
    return c
  }
  /** 快速打卡：打卡与照片一起保存；照片登记失败时撤回这次打卡（与后端同一事务的行为一致） */
  quickCheckin(tripId: number, r: { checkin?: Partial<CheckinView>; photos?: (Partial<PhotoView> & { storageKey?: string })[] }) {
    const input = r.checkin ?? {}
    const c = this.addCheckin(tripId, { ...input, placeName: input.placeName?.trim() || (input.placeId ? undefined : '随手记录') })
    try {
      const photos = (r.photos ?? []).map(p => this.registerPhoto(tripId, { ...p, checkinId: c.id, featured: Boolean(p.featured), capturedAt: p.capturedAt ?? c.checkinTime }))
      return { checkin: c, photos }
    } catch (e) {
      this.checkins = this.checkins.filter(x => x.id !== c.id)
      this.photos = this.photos.filter(p => p.checkinId !== c.id)
      throw e
    }
  }
  updateCheckin(id: number, r: Partial<CheckinView>) {
    const c = this.checkin(id); this.writable(c.tripId)
    if (r.checkinTime) c.checkinTime = this.zonedIso(r.checkinTime)
    for (const k of ['note', 'area', 'placeName', 'latitude', 'longitude'] as const) if (r[k] !== undefined) (c as Record<string, unknown>)[k] = r[k]
    return c
  }
  deleteCheckin(id: number) {
    const c = this.checkin(id); this.writable(c.tripId)
    this.checkins = this.checkins.filter(x => x.id !== id)
    for (const p of this.photos) if (p.checkinId === id) p.checkinId = undefined
  }
  itineraryCheckin(tripId: number, itemId: number, r: Partial<CheckinView>) {
    const it = this.item(tripId, itemId)
    return this.addCheckin(tripId, { ...r, itineraryItemId: itemId, placeId: r.placeId ?? it.placeId, placeName: r.placeName ?? it.placeName, area: r.area ?? it.area, latitude: r.latitude ?? it.latitude, longitude: r.longitude ?? it.longitude })
  }

  // ---------- 照片 ----------
  photosOf(tripId: number) { this.trip(tripId); return this.photos.filter(p => p.tripId === tripId).sort((a, b) => (a.capturedAt ?? a.createdAt ?? '').localeCompare(b.capturedAt ?? b.createdAt ?? '')) }
  photo(id: number) { return this.photos.find(p => p.id === id) ?? fail(404, 'PHOTO_NOT_FOUND', '照片不存在') }
  presignPhoto(tripId: number, r: { fileName?: string; contentType?: string; fileSize?: number }) {
    const t = this.writable(tripId)
    if (t.planType === 'FREE' && this.photos.filter(p => p.tripId === tripId).length >= FREE_PHOTO_LIMIT) fail(409, 'FREE_PHOTO_LIMIT', `免费旅行最多保存 ${FREE_PHOTO_LIMIT} 张照片，请升级 Trip Pro`)
    if (!r.contentType?.startsWith('image/')) fail(400, 'INVALID_PHOTO_TYPE', '仅支持图片文件')
    if ((r.fileSize ?? 0) > 20 * 1024 * 1024) fail(400, 'PHOTO_TOO_LARGE', '单张照片不能超过 20MB')
    const storageKey = `mock/${tripId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return { storageKey, uploadUrl: `devmem://${storageKey}`, publicUrl: '', expiresInSeconds: 600, mock: true }
  }
  registerPhoto(tripId: number, r: Partial<PhotoView> & { storageKey?: string }) {
    const t = this.writable(tripId)
    if (t.planType === 'FREE' && this.photos.filter(p => p.tripId === tripId).length >= FREE_PHOTO_LIMIT) fail(409, 'FREE_PHOTO_LIMIT', `免费旅行最多保存 ${FREE_PHOTO_LIMIT} 张照片，请升级 Trip Pro`)
    const url = r.storageKey ? this.uploads.get(r.storageKey) : undefined
    if (!url) fail(400, 'PHOTO_UPLOAD_MISSING', '请先完成图片上传')
    if (r.checkinId && !this.checkins.some(c => c.id === r.checkinId && c.tripId === tripId)) fail(400, 'CHECKIN_NOT_FOUND', '关联打卡不存在')
    const capturedAt = r.capturedAt ? toDate(r.capturedAt)!.toISOString().replace(/\.\d+Z$/, '') : undefined
    const p: PhotoView = { id: this.nextId('photo', this.photos), tripId, checkinId: r.checkinId, storageKey: r.storageKey!, imageUrl: url!, width: r.width, height: r.height, fileSize: r.fileSize, mimeType: r.mimeType || 'image/jpeg', featured: Boolean(r.featured), capturedAt, createdAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z') }
    this.photos.push(p)
    return p
  }
  updatePhoto(id: number, r: Partial<PhotoView>) {
    const p = this.photo(id); this.writable(p.tripId)
    if (r.checkinId !== undefined) p.checkinId = r.checkinId || undefined
    if (r.capturedAt !== undefined) p.capturedAt = r.capturedAt || undefined
    if (r.featured !== undefined) p.featured = Boolean(r.featured)
    return p
  }
  featurePhoto(id: number, on: boolean) { const p = this.photo(id); this.writable(p.tripId); p.featured = on; return p }
  deletePhoto(id: number) { const p = this.photo(id); this.writable(p.tripId); this.photos = this.photos.filter(x => x.id !== id) }
  photoCover(tripId: number, photoId: number) { const t = this.writable(tripId); const p = this.photo(photoId); if (p.tripId !== tripId) fail(400, 'PHOTO_NOT_IN_TRIP', '照片不属于这段旅行'); t.coverImage = p.imageUrl; return t }
  photoBatch(tripId: number, ids: number[], action: string) {
    this.writable(tripId)
    const targets = this.photos.filter(p => p.tripId === tripId && ids.includes(p.id))
    if (action === 'DELETE') this.photos = this.photos.filter(p => !targets.includes(p))
    else for (const p of targets) p.featured = action === 'FEATURE'
    return { action, affected: targets.length }
  }

  // ---------- 派生：时间线、最近记录、总结、成就 ----------
  timeline(tripId: number): TimelineDay[] {
    const days = new Map<string, TimelineDay>()
    for (const c of this.checkinsOf(tripId)) {
      const date = this.dateKey(c.checkinTime)!
      const day = days.get(date) ?? { date, items: [] }
      day.items.push({ checkin: c, photos: this.photos.filter(p => p.checkinId === c.id).map(p => ({ id: p.id, imageUrl: p.imageUrl, featured: p.featured, capturedAt: p.capturedAt })) })
      days.set(date, day)
    }
    return [...days.values()]
  }
  recentRecords(tripId: number, limit: number): RecentRecord[] {
    const records: RecentRecord[] = this.checkinsOf(tripId).map(c => {
      const ps = this.photos.filter(p => p.checkinId === c.id)
      return { kind: 'CHECKIN', checkinId: c.id, placeName: c.placeName, area: c.area, checkinType: c.checkinType, at: c.checkinTime, photoCount: ps.length, thumbnailUrl: ps[0]?.imageUrl, note: c.note }
    })
    const loose = new Map<string, PhotoView[]>()
    for (const p of this.photosOf(tripId).filter(p => !p.checkinId)) { const k = this.dateKey(p.capturedAt ?? p.createdAt)!; loose.set(k, [...(loose.get(k) ?? []), p]) }
    for (const ps of loose.values()) { const last = ps[ps.length - 1]; records.push({ kind: 'PHOTOS', at: this.zonedIso(last.capturedAt ?? last.createdAt!), photoCount: ps.length, thumbnailUrl: last.imageUrl }) }
    return records.sort((a, b) => toDate(b.at)!.getTime() - toDate(a.at)!.getTime()).slice(0, limit)
  }
  private isTokyo(t: TripView) { return t.city === '东京' || t.destinationName === '东京' }
  private officialCount(tripId: number) { const official = new Set((this.tripPlaces[tripId] ?? []).filter(p => p.sourceType === 'OFFICIAL').map(p => p.id)); return this.checkins.filter(c => c.tripId === tripId && c.placeId && official.has(c.placeId)).length }

  achievements(tripId: number): AchievementView[] {
    const t = this.trip(tripId)
    const cs = this.checkinsOf(tripId), ps = this.photosOf(tripId)
    const names = new Set(cs.map(c => c.placeName))
    return mockAchievementDefs.filter(d => d.type === 'GLOBAL' || this.isTokyo(t)).map(d => {
      const requirements = d.places ? d.places.map(name => ({ name, done: names.has(name) })) : []
      const current =
        d.conditionType === 'CHECKIN_COUNT' ? cs.length
        : d.conditionType === 'PHOTO_COUNT' ? ps.length
        : d.conditionType === 'AREA_COUNT' ? new Set(cs.map(c => c.area).filter(Boolean)).size
        : d.conditionType === 'TRIP_COMPLETED' ? (t.status === 'COMPLETED' || t.status === 'ARCHIVED' ? 1 : 0)
        : d.conditionType === 'OFFICIAL_CHECKIN_COUNT' ? this.officialCount(tripId)
        : requirements.filter(r => r.done).length
      const earned = current >= d.target
      // 解锁时间：达成条件的那一次打卡（或完成旅行的结束日），数据不变时结果固定
      const earnedAt = !earned ? undefined : d.conditionType === 'TRIP_COMPLETED' ? `${t.endDate}T12:00:00` : (cs[Math.min(cs.length - 1, Math.max(0, d.target - 1))]?.checkinTime ?? ps[ps.length - 1]?.createdAt)
      return { id: d.id, code: d.code, name: d.name, description: d.description, type: d.type, cityCode: d.cityCode, earned, progress: Math.min(100, Math.round(current * 100 / d.target)), earnedAt, conditionType: d.conditionType, current, target: d.target, requirements }
    })
  }

  summary(tripId: number): TripSummary {
    const t = this.trip(tripId)
    const cs = this.checkinsOf(tripId), ps = this.photosOf(tripId)
    const cc = new Map<string, number>(), pc = new Map<string, number>()
    for (const c of cs) { const k = this.dateKey(c.checkinTime)!; cc.set(k, (cc.get(k) ?? 0) + 1) }
    for (const p of ps) { const k = this.dateKey(p.capturedAt ?? p.createdAt)!; pc.set(k, (pc.get(k) ?? 0) + 1) }
    const dailyRecords: TripSummary['dailyRecords'] = []
    for (let d = new Date(t.startDate + 'T00:00:00Z'); d <= new Date(t.endDate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10), checkins = cc.get(date) ?? 0, photos = pc.get(date) ?? 0
      dailyRecords.push({ date, checkins, photos, hasRecord: checkins > 0 || photos > 0 })
    }
    const official = this.officialCount(tripId), officialTotal = this.isTokyo(t) ? MOCK_TOKYO_OFFICIAL_TOTAL : 0
    const earned = this.achievements(tripId).filter(a => a.earned).length
    const places = new Set(cs.map(c => (c.placeId ? `id:${c.placeId}` : `name:${c.placeName.trim().toLowerCase()}`))).size
    return {
      tripId: t.id, title: t.title, status: t.status, planType: t.planType, days: dailyRecords.length, places, photos: ps.length,
      cities: new Set(cs.map(() => t.city).filter(Boolean)).size, areas: new Set(cs.map(c => c.area).filter(Boolean)).size,
      officialPlacesCompleted: official, officialPlacesTotal: officialTotal, explorationRate: officialTotal ? Math.min(100, Math.round(official * 100 / officialTotal)) : 0,
      achievements: earned, dailyRecords,
      readiness: { featuredPhotos: ps.filter(p => p.featured).length, achievementCount: earned, recordedDays: dailyRecords.filter(d => d.hasRecord).length, shareReady: cs.length > 0, videoReady: ps.length >= 3 && cs.length > 0 }
    }
  }

  // ---------- 分享 ----------
  sharesOf(tripId: number): ShareLinkView[] { this.trip(tripId); return this.shares.filter(s => s.tripId === tripId).map(({ tripId: _t, ...s }) => s) }
  createShare(tripId: number, expiresAt: string | undefined, origin: string) {
    const t = this.trip(tripId)
    const days = this.user.shareLinkExpiryDays ?? 0
    const token = `mock-share-${tripId}-${Date.now().toString(36)}`
    const s: Share = { id: this.nextId('share', this.shares), tripId, token, status: 'ACTIVE', viewCount: 0, createdAt: nowUtc(), expiresAt: expiresAt ?? (days > 0 ? new Date(Date.now() + days * 86400000).toISOString().replace('Z', '') : undefined), url: `${origin}/s/${token}` }
    this.shares.push(s); t.visibility = 'UNLISTED'
    const { tripId: _t, ...view } = s
    return view
  }
  revokeShare(tripId: number, shareId: number) {
    const s = this.shares.find(x => x.id === shareId && x.tripId === tripId) ?? fail(404, 'SHARE_LINK_NOT_FOUND', '分享链接不存在')
    s.status = 'REVOKED'; s.revokedAt = nowUtc()
    if (!this.shares.some(x => x.tripId === tripId && x.status === 'ACTIVE')) this.trip(tripId).visibility = 'PRIVATE'
  }
  publicShare(token: string): PublicShareView {
    const s = this.shares.find(x => x.token === token && x.status === 'ACTIVE' && (!x.expiresAt || toDate(x.expiresAt)!.getTime() > Date.now())) ?? fail(404, 'SHARE_LINK_INVALID', '分享链接无效或已失效')
    s.viewCount += 1
    const t = this.trip(s.tripId)
    const round = (v?: number) => (v == null ? v : Math.round(v * 100) / 100)
    const timeline = this.timeline(t.id).map(d => ({ ...d, items: d.items.map(i => (this.user.shareExactLocation ? i : { ...i, checkin: { ...i.checkin, latitude: round(i.checkin.latitude), longitude: round(i.checkin.longitude) } })) }))
    return { trip: t, summary: this.summary(t.id), timeline, featuredPhotos: this.photosOf(t.id).filter(p => p.featured), achievements: this.achievements(t.id), ownerNickname: this.user.nickname }
  }

  // ---------- 支付 ----------
  checkout(tripId: number) {
    const t = this.writable(tripId)
    if (t.planType === 'PRO') fail(409, 'TRIP_ALREADY_PRO', '这段旅行已经是 Trip Pro')
    const p: PaymentView = { id: this.nextId('payment', this.payments), tripId, provider: 'MOCK', providerPaymentId: `mock-pay-${tripId}-${Date.now().toString(36)}`, amount: TRIP_PRO_AMOUNT, currency: TRIP_PRO_CURRENCY, status: 'PAID', paidAt: nowUtc(), createdAt: nowUtc() }
    this.payments.push(p); t.planType = 'PRO'
    return { mock: true, paymentId: p.id }
  }
  /** 买断 · 终身 Pro：账号级，所有旅行立即变成 PRO，以后新建的旅行也是 PRO */
  checkoutLifetime() {
    if (this.user.lifetimePro) fail(409, 'LIFETIME_ALREADY_OWNED', '你已经拥有终身 Pro')
    const p: PaymentView = { id: this.nextId('payment', this.payments), product: 'LIFETIME', provider: 'MOCK', providerPaymentId: `mock-pay-lifetime-${Date.now().toString(36)}`, amount: LIFETIME_AMOUNT, currency: TRIP_PRO_CURRENCY, status: 'PAID', paidAt: nowUtc(), createdAt: nowUtc() }
    this.payments.push(p)
    this.user.lifetimePro = true; this.user.lifetimeProAt = nowUtc()
    for (const t of this.trips) t.planType = 'PRO'
    return { mock: true, paymentId: p.id, status: 'PAID', checkoutUrl: '' }
  }
  latestLifetimePayment() { return [...this.payments].reverse().find(p => p.product === 'LIFETIME') ?? null }
  latestPayment(tripId: number) { this.trip(tripId); return [...this.payments].reverse().find(p => p.tripId === tripId) ?? null }

  // ---------- 账户 ----------
  updateUser(r: Partial<UserView>) {
    const allowed = ['nickname', 'bio', 'locale', 'timezone', 'distanceUnit', 'shareExactLocation', 'shareLinkExpiryDays', 'notifyTripReminder', 'notifyStory', 'notifyAchievement', 'notifyShare'] as const
    if (r.nickname !== undefined && !r.nickname.trim()) fail(400, 'INVALID_NICKNAME', '昵称不能为空')
    for (const k of allowed) if (r[k] !== undefined) (this.user as Record<string, unknown>)[k] = typeof r[k] === 'string' ? (r[k] as string).trim() : r[k]
    return this.user
  }
  setAvatar(storageKey: string, smallKey?: string) {
    const url = this.uploads.get(storageKey); if (!url) fail(400, 'AVATAR_UPLOAD_MISSING', '请先完成头像上传')
    this.user.avatarUrl = url
    this.user.avatarSmallUrl = smallKey ? this.uploads.get(smallKey) ?? null : null
    return this.user
  }
  overview(): AccountOverview {
    const plans: TripPlanView[] = this.listTrips().map(t => {
      const pay = t.planType === 'PRO' ? this.latestPayment(t.id) : null
      return { tripId: t.id, title: t.title, destinationName: t.destinationName, startDate: t.startDate, endDate: t.endDate, planType: t.planType, status: t.status, amount: pay?.amount, currency: pay?.currency, provider: pay?.provider, paidAt: pay?.paidAt }
    })
    return {
      trips: this.trips.length, places: Object.values(this.tripPlaces).reduce((n, l) => n + l.length, 0), photos: this.photos.length,
      proTrips: this.trips.filter(t => t.planType === 'PRO').length, activeFreeTrips: this.freeActive(), freeTripLimit: FREE_ACTIVE_TRIP_LIMIT,
      tripProAmount: TRIP_PRO_AMOUNT, lifetimeAmount: LIFETIME_AMOUNT, tripProCurrency: TRIP_PRO_CURRENCY, lifetimePro: Boolean(this.user.lifetimePro), plans
    }
  }

  // ---------- 旅行回忆 ----------
  private memoryTrips(): MemoryTrip[] {
    return this.listTrips().filter(t => t.status === 'COMPLETED' || t.status === 'ARCHIVED').sort((a, b) => b.startDate.localeCompare(a.startDate)).map(t => {
      const ps = this.photosOf(t.id), cs = this.checkinsOf(t.id), s = this.summary(t.id)
      const featured = ps.filter(p => p.featured)
      const moments = (featured.length ? featured : ps).slice(0, 4)
      const note = [...cs].reverse().find(c => c.note)
      const stories = this.videos.filter(v => v.tripId === t.id && v.status === 'COMPLETED')
      return {
        id: t.id, title: t.title, destinationName: t.destinationName, city: t.city ?? t.destinationName, countryCode: t.countryCode, status: t.status, startDate: t.startDate, endDate: t.endDate,
        days: s.days, places: s.places, photos: ps.length, achievements: s.achievements, cover: t.coverImage ?? featured[0]?.imageUrl ?? ps[0]?.imageUrl ?? null,
        moments: moments.map(p => ({ id: p.id, imageUrl: p.imageUrl })), moreMoments: Math.max(0, ps.length - moments.length),
        note: note ? { text: note.note!, place: note.placeName } : null, stories: stories.length, latestStoryId: stories[stories.length - 1]?.id ?? null,
        shareLinks: this.shares.filter(x => x.tripId === t.id).length
      }
    })
  }
  memories(limit: number): MemoriesView {
    const trips = this.memoryTrips()
    const tripIds = new Set(trips.map(t => t.id))
    const titleOf = (id: number) => this.trips.find(t => t.id === id)?.title ?? ''
    const creations: Creation[] = [
      ...this.videos.filter(v => tripIds.has(v.tripId) && v.status === 'COMPLETED').map(v => ({ type: 'STORY' as const, id: v.id, tripId: v.tripId, tripTitle: titleOf(v.tripId), title: v.name, preview: trips.find(t => t.id === v.tripId)?.cover ?? null, url: v.outputUrl ?? '', createdAt: v.createdAt, duration: v.duration })),
      ...this.shares.filter(s => tripIds.has(s.tripId)).map(s => ({ type: 'SHARE_LINK' as const, id: s.id, tripId: s.tripId, tripTitle: titleOf(s.tripId), preview: trips.find(t => t.id === s.tripId)?.cover ?? null, url: s.url, createdAt: s.createdAt, views: s.viewCount }))
    ].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    const photos = this.photos.filter(p => tripIds.has(p.tripId) && p.featured).map(p => ({ id: p.id, tripId: p.tripId, tripTitle: titleOf(p.tripId), imageUrl: p.imageUrl, featured: p.featured, takenAt: p.capturedAt ?? null }))
    const achievements = [...tripIds].flatMap(id => this.achievements(id).filter(a => a.earned).map(a => ({ code: a.code, name: a.name, description: a.description, tripId: id, tripTitle: titleOf(id), earnedAt: a.earnedAt ?? null })))
    const thisYear = String(new Date().getFullYear())
    return {
      overview: { archivedTrips: trips.length, cities: new Set(trips.map(t => t.city)).size, photos: trips.reduce((n, t) => n + t.photos, 0), creations: creations.length },
      trips: trips.slice(0, limit), hasMore: trips.length > limit,
      timeline: trips.map(t => ({ id: t.id, title: t.title, city: t.city, startDate: t.startDate, endDate: t.endDate, cover: t.cover })),
      creations, photos, photoYear: trips.some(t => t.startDate.startsWith(thisYear)) ? Number(thisYear) : 0,
      achievements, achievementCount: achievements.length, flashback: null
    }
  }
  memoryPage(offset: number, limit: number) { const all = this.memoryTrips(); return { trips: all.slice(offset, offset + limit), hasMore: all.length > offset + limit } }

  // ---------- Travel Story ----------
  videosOf(tripId: number) { this.trip(tripId); return this.videos.filter(v => v.tripId === tripId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
  video(id: number) { return this.videos.find(v => v.id === id) ?? fail(404, 'VIDEO_NOT_FOUND', 'Travel Story 不存在') }
  saveVideo(tripId: number, draft: VideoDraft, id?: number) {
    const t = this.writable(tripId)
    const pro = t.planType === 'PRO'
    const [w, h] = draft.aspectRatio === '16:9' ? [16, 9] : draft.aspectRatio === '1:1' ? [1, 1] : [9, 16]
    const base = draft.quality === '1080p' && pro ? 1080 : 720
    const resolution = w >= h ? `${Math.round(base * w / h)}×${base}` : `${base}×${Math.round(base * h / w)}`
    const fields = {
      templateCode: draft.templateCode, aspectRatio: draft.aspectRatio, duration: draft.duration, quality: pro ? draft.quality : '720p', resolution, watermark: !pro, musicCode: draft.musicCode,
      coverPhotoId: draft.coverPhotoId, showText: draft.settings.showTitle, showAchievements: draft.settings.showAchievements,
      settings: { ...defaultStorySettings(), ...draft.settings }, photoIds: draft.photoIds, updatedAt: nowUtc()
    }
    if (id) { const v = this.video(id); Object.assign(v, fields, { status: 'DRAFT', progress: 0, outputUrl: null, completedAt: null, renderStage: null }); return v }
    const v: VideoProject = { id: this.nextId('video', this.videos), tripId, name: `${t.title} · ${draft.templateCode.charAt(0)}${draft.templateCode.slice(1).toLowerCase()}`, ...fields, status: 'DRAFT', progress: 0, renderer: 'MOCK', createdAt: nowUtc() }
    this.videos.push(v)
    return v
  }
  duplicateVideo(id: number) { const v = this.video(id); const copy: VideoProject = { ...clone(v), id: this.nextId('video', this.videos), name: `${v.name ?? ''} 副本`, status: 'DRAFT', progress: 0, outputUrl: null, completedAt: null, createdAt: nowUtc() }; this.videos.push(copy); return copy }
  deleteVideo(id: number) { this.video(id); this.videos = this.videos.filter(v => v.id !== id) }
  /** 生成：在内存里模拟排队 → 生成 → 完成，产物与后端本地 Mock 渲染器一样是占位地址 */
  renderVideo(id: number) {
    const v = this.video(id)
    Object.assign(v, { status: 'QUEUED', progress: 0, renderStage: 'PREPARING', outputUrl: null, errorCode: null, errorMessage: null, completedAt: null })
    const stages = ['PREPARING', 'STORY', 'MUSIC', 'EXPORTING', 'UPLOADING'] as const
    let step = 0
    const timer = setInterval(() => {
      step += 1
      if (!this.videos.includes(v)) { clearInterval(timer); return }
      if (step <= stages.length) Object.assign(v, { status: 'PROCESSING', renderStage: stages[step - 1], progress: Math.round(step * 100 / (stages.length + 1)) })
      else { Object.assign(v, { status: 'COMPLETED', progress: 100, renderStage: null, outputUrl: `https://example.invalid/mock/story-${v.id}.mp4`, completedAt: nowUtc() }); clearInterval(timer) }
    }, 700)
    return v
  }
  storyboard(tripId: number, draft: Pick<VideoDraft, 'templateCode' | 'duration' | 'photoIds' | 'settings' | 'aspectRatio'>, pro: boolean): Storyboard {
    const t = this.trip(tripId)
    const cs = this.checkinsOf(tripId)
    const chosen = new Set(draft.photoIds)
    const ps = this.photosOf(tripId).filter(p => !chosen.size || chosen.has(p.id))
    const earned = this.achievements(tripId).filter(a => a.earned).map(a => a.name)
    const dot = (d: string) => d.replaceAll('-', '.')
    const md = (iso: string) => { const d = toDate(iso)!; const p = zonedParts(d, this.zone); return `${pad(p.month)}.${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}` }
    const scenes: Omit<Scene, 'start'>[] = []
    const s = draft.settings
    scenes.push({ key: 'opening', type: 'OPENING', title: s.title || t.title, subtitle: `${dot(t.startDate)} - ${dot(t.endDate)}`, duration: 2.5, photoIds: ps.slice(0, 1).map(p => p.id), enabled: true, pinned: true, meta: { kicker: 'MY JOURNEY', destination: t.destinationName } })
    for (const c of cs) {
      const shots = ps.filter(p => p.checkinId === c.id).slice(0, 3)
      if (!shots.length) continue
      scenes.push({ key: `place-${c.id}`, type: 'PLACE', title: c.placeName, subtitle: `${md(c.checkinTime)}${c.area ? ` · ${c.area}` : ''}`, duration: 2 * shots.length, photoIds: shots.map(p => p.id), enabled: true, pinned: false, meta: { note: s.showCheckinText ? c.note : undefined, shots: shots.map(() => 2), checkinId: c.id, placeName: c.placeName } })
    }
    if (s.showAchievements && earned.length) scenes.push({ key: 'achievements', type: 'ACHIEVEMENTS', title: '旅行成就', subtitle: `解锁 ${earned.length} 项成就`, duration: 2.5, photoIds: [], enabled: true, pinned: false, meta: { items: earned } })
    if (s.showEnding) scenes.push({ key: 'ending', type: 'ENDING', title: t.title, subtitle: `${this.summary(tripId).days} 天`, duration: 2.5, photoIds: ps.slice(-1).map(p => p.id), enabled: true, pinned: true, meta: { stats: `${cs.length} 个地点 · ${ps.length} 张照片`, tagline: 'Every Journey · A Better You', endingText: s.endingText ?? undefined } })
    // 按目标时长等比缩放，保证总时长与设置一致
    const raw = scenes.reduce((n, x) => n + x.duration, 0) || 1
    let start = 0
    const scaled = scenes.map(x => { const d = Math.round(x.duration * draft.duration / raw * 10) / 10; const sc = { ...x, start: Math.round(start * 10) / 10, duration: d }; start += d; return sc })
    const [w, h] = draft.aspectRatio === '16:9' ? [16, 9] : draft.aspectRatio === '1:1' ? [1, 1] : [9, 16]
    const base = pro ? 1080 : 720
    return {
      totalDuration: draft.duration, templateCode: draft.templateCode, resolution: w >= h ? `${Math.round(base * w / h)}×${base}` : `${base}×${Math.round(base * h / w)}`,
      watermark: !pro, transition: 'fade', transitionSeconds: 0.6, scenes: scaled, notices: ['Mock 数据：分镜由开发数据层按固定数据生成'], grade: s.visualStyle ?? null
    }
  }
}
