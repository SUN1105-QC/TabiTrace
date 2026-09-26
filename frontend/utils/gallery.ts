/**
 * 旅行照片工作台的纯逻辑：照片时间、按天分组、筛选排序，以及上传时读取 JPEG 的拍摄时间（EXIF）。
 *
 * 照片时间的可靠性优先级：
 *   1. capturedAt（拍摄时间，上传时从 EXIF 读取或手动指定）
 *   2. 关联打卡的时间
 *   3. 上传时间 createdAt —— 只有落在旅行日期内才采用（旅行结束后补传的照片，上传日不是拍摄日）
 *   都没有时归入“未分类”，不猜日期。
 */

import type { CheckinView, PhotoView, TripView } from '@/services/tabitrace-api'

export type PhotoTimeSource = 'captured' | 'checkin' | 'uploaded'
export type PhotoTime = { date: string; time: string; source: PhotoTimeSource; sortKey: number }
export type GalleryFilter = 'ALL' | 'FEATURED' | 'LINKED' | 'UNLINKED'
export type GallerySort = 'NEWEST' | 'OLDEST'
export type GalleryView = 'day' | 'grid'

export const TIME_SOURCE_LABEL: Record<PhotoTimeSource, string> = { captured: '拍摄时间', checkin: '打卡时间', uploaded: '上传时间' }
/** 与后端 PhotoService 的免费额度一致 */
export const FREE_PHOTO_LIMIT = 10
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024

/** UTC 时间 → 指定时区的日期与时刻 */
export function zonedParts(iso: string, timeZone: string) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}`, ms: d.getTime() }
  } catch {
    return null
  }
}

export function photoTime(p: PhotoView, checkin: CheckinView | undefined, trip: Pick<TripView, 'startDate' | 'endDate'>, timeZone: string): PhotoTime | null {
  if (p.capturedAt) {
    const z = zonedParts(p.capturedAt, timeZone)
    if (z) return { date: z.date, time: z.time, source: 'captured', sortKey: z.ms }
  }
  if (checkin?.checkinTime) {
    // 打卡时间由后端按用户时区给出，直接取其中的当地日期与时刻
    const ms = new Date(checkin.checkinTime).getTime()
    return { date: checkin.checkinTime.slice(0, 10), time: checkin.checkinTime.slice(11, 16), source: 'checkin', sortKey: Number.isFinite(ms) ? ms : 0 }
  }
  if (p.createdAt) {
    const z = zonedParts(p.createdAt, timeZone)
    if (z && z.date >= trip.startDate && z.date <= trip.endDate) return { date: z.date, time: z.time, source: 'uploaded', sortKey: z.ms }
  }
  return null
}

export type GalleryItem = { photo: PhotoView; when: PhotoTime | null; checkin?: CheckinView }

export function buildItems(photos: PhotoView[], checkins: CheckinView[], trip: Pick<TripView, 'startDate' | 'endDate'>, timeZone: string): GalleryItem[] {
  const byId = new Map(checkins.map(c => [c.id, c]))
  return photos.map(photo => {
    const checkin = photo.checkinId ? byId.get(photo.checkinId) : undefined
    return { photo, checkin, when: photoTime(photo, checkin, trip, timeZone) }
  })
}

export function filterItems(items: GalleryItem[], f: GalleryFilter) {
  if (f === 'FEATURED') return items.filter(i => i.photo.featured)
  if (f === 'LINKED') return items.filter(i => i.photo.checkinId)
  if (f === 'UNLINKED') return items.filter(i => !i.photo.checkinId)
  return items
}

/** 有时间的照片按时间排，没有时间的放在最后（按上传顺序） */
export function sortItems(items: GalleryItem[], s: GallerySort) {
  const dir = s === 'NEWEST' ? -1 : 1
  return [...items].sort((a, b) => {
    if (a.when && b.when) return (a.when.sortKey - b.when.sortKey) * dir || (a.photo.id - b.photo.id) * dir
    if (a.when) return -1
    if (b.when) return 1
    return (a.photo.id - b.photo.id) * dir
  })
}

export type DayGroup = { key: string; title: string; subtitle: string; items: GalleryItem[] }

/** 按天分组：旅行内的日期显示 DAY 01；旅行日期之外的只显示日期；没有时间的放进“未分类” */
export function groupByDay(items: GalleryItem[], days: string[]): DayGroup[] {
  const groups = new Map<string, GalleryItem[]>()
  items.forEach(i => { const k = i.when?.date ?? 'NONE'; groups.set(k, [...(groups.get(k) ?? []), i]) })
  const out: DayGroup[] = []
  groups.forEach((list, key) => {
    if (key === 'NONE') return
    const idx = days.indexOf(key)
    out.push({ key, title: idx >= 0 ? `DAY ${String(idx + 1).padStart(2, '0')}` : '行程外', subtitle: key.replace(/-/g, '.'), items: list })
  })
  const none = groups.get('NONE')
  if (none) out.push({ key: 'NONE', title: '未分类', subtitle: '没有拍摄或打卡时间', items: none })
  return out
}

/* ---------- EXIF：只读取 JPEG 的 DateTimeOriginal（0x9003），读不到就返回 null ---------- */

export async function readExifDate(file: File): Promise<{ date: string; time: string } | null> {
  if (!/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer()
    return parseExifDate(new DataView(buf))
  } catch {
    return null
  }
}

export function parseExifDate(v: DataView): { date: string; time: string } | null {
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null
  let off = 2
  while (off + 4 <= v.byteLength) {
    const marker = v.getUint16(off)
    const size = v.getUint16(off + 2)
    if (marker === 0xffe1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966) return readTiff(v, off + 10)
    if ((marker & 0xff00) !== 0xff00 || size < 2) return null
    off += 2 + size
  }
  return null
}

function readTiff(v: DataView, tiff: number) {
  if (tiff + 8 > v.byteLength) return null
  const little = v.getUint16(tiff) === 0x4949
  const u16 = (o: number) => v.getUint16(o, little)
  const u32 = (o: number) => v.getUint32(o, little)
  const entry = (ifd: number, tag: number) => {
    if (ifd + 2 > v.byteLength) return null
    const n = u16(ifd)
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12
      if (e + 12 > v.byteLength) return null
      if (u16(e) === tag) return e
    }
    return null
  }
  const exifPtr = entry(tiff + u32(tiff + 4), 0x8769)
  if (exifPtr === null) return null
  const dt = entry(tiff + u32(exifPtr + 8), 0x9003)
  if (dt === null) return null
  const start = tiff + u32(dt + 8)
  if (start + 19 > v.byteLength) return null
  let s = ''
  for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(start + i))
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/.exec(s)
  if (!m || m[1] === '0000') return null
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` }
}
