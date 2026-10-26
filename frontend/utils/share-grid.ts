/**
 * 分享九宫格的数据整理：挑 6 张照片、给照片配上拍摄地点、照片不够时用打卡地点补位。
 * 与长图一样，只用真实数据，不编造内容。
 */

import type { CheckinView, PhotoView, TimelineDay, TripView } from '@/services/tabitrace-api'
import { timeOfDay, toDate, zonedParts } from '@/lib/time'
import { dotDate, weekdayOf } from '@/utils/share-long'

export type GridPlace = { checkin: CheckinView; day: number }

/** 打卡 id → 打卡记录与第几天，用来给照片加地点说明 */
export function placeIndex(timeline: TimelineDay[]) {
  const map = new Map<number, GridPlace>()
  timeline.filter(d => d.items.length > 0).forEach((d, i) => d.items.forEach(item => map.set(item.checkin.id, { checkin: item.checkin, day: i + 1 })))
  return map
}

/**
 * 挑选九宫格照片：精选在前，并在不同打卡地点之间轮流取，
 * 避免 6 张都来自同一个地方，让画面有节奏。
 */
export function pickGridPhotos(photos: PhotoView[], count: number) {
  const ordered = [...photos.filter(p => p.featured), ...photos.filter(p => !p.featured)]
  const groups = new Map<string, PhotoView[]>()
  ordered.forEach(p => {
    const key = p.checkinId != null ? `c${p.checkinId}` : `p${p.id}`
    groups.set(key, [...(groups.get(key) ?? []), p])
  })
  const queues = Array.from(groups.values())
  const picked: PhotoView[] = []
  while (picked.length < count && queues.some(q => q.length > 0)) {
    for (const q of queues) {
      const next = q.shift()
      if (next) picked.push(next)
      if (picked.length === count) break
    }
  }
  return picked
}

/** 照片不足 6 张时的补位：按行程顺序取范围内还没出现在照片里的地点（同名地点只取一次） */
export function memoPlaces(timeline: TimelineDay[], used: PhotoView[], count: number, day?: string) {
  if (count <= 0) return []
  const usedCheckins = new Set(used.map(p => p.checkinId))
  const seen = new Set<string>()
  const result: GridPlace[] = []
  scopeTimeline(timeline).forEach((d, i) => {
    if (day && d.date !== day) return
    d.items.forEach(({ checkin }) => {
      if (result.length >= count || usedCheckins.has(checkin.id) || seen.has(checkin.placeName)) return
      seen.add(checkin.placeName)
      result.push({ checkin, day: i + 1 })
    })
  })
  return result
}

/** 封面格的大标题按字数缩放，长标题也不会溢出方格 */
export function titleSize(title: string) {
  const len = Array.from(title).length
  if (len <= 5) return 38
  if (len <= 7) return 31
  if (len <= 10) return 25
  return 21
}

/** 只保留有打卡的日期；选了某一天时只返回那一天 */
export function scopeTimeline(timeline: TimelineDay[], day?: string) {
  const days = timeline.filter(d => d.items.length > 0)
  return day ? days.filter(d => d.date === day) : days
}

/** 某个日期是这趟旅行的第几天（按有打卡的日期计） */
export function dayNumber(timeline: TimelineDay[], day: string) {
  return scopeTimeline(timeline).findIndex(d => d.date === day) + 1
}

/** 范围内的照片：整趟旅行 = 全部；某一天 = 当天打卡下的照片 */
export function scopePhotos(photos: PhotoView[], timeline: TimelineDay[], day?: string) {
  if (!day) return photos
  const ids = new Set(scopeTimeline(timeline, day).flatMap(d => d.items.map(i => i.checkin.id)))
  return photos.filter(p => p.checkinId != null && ids.has(p.checkinId))
}

/** 在几组照片之间轮流各取一张，直到取够 count 张 */
function roundRobin(queues: PhotoView[][], count: number, picked: PhotoView[] = []) {
  const qs = queues.map(q => [...q])
  while (picked.length < count && qs.some(q => q.length > 0)) {
    for (const q of qs) {
      const next = q.shift()
      if (next) picked.push(next)
      if (picked.length >= count) break
    }
  }
  return picked
}

/**
 * 默认选图「每天的精选」：先在各天之间轮流取当天的精选照片，保证每一天都能出现；
 * 精选不够时，再按天轮流补当天的其他照片，最后才用没有关联打卡的照片。
 */
export function dailyFeaturedPhotos(photos: PhotoView[], timeline: TimelineDay[], count: number) {
  const days = scopeTimeline(timeline).map(d => {
    const ids = new Set(d.items.map(i => i.checkin.id))
    return photos.filter(p => p.checkinId != null && ids.has(p.checkinId))
  })
  const picked = roundRobin(days.map(list => list.filter(p => p.featured)), count)
  roundRobin(days.map(list => list.filter(p => !p.featured)), count, picked)
  const inDays = new Set(days.flat().map(p => p.id))
  const loose = photos.filter(p => !inDays.has(p.id))
  return roundRobin([[...loose.filter(p => p.featured), ...loose.filter(p => !p.featured)]], count, picked)
}

/** 照片格数量：九宫格 9 格中，左上封面、正中数据、右下品牌收尾，其余 6 格放照片 */
export const GRID_PHOTO_SLOTS = 6

/** 地点的次级地址：城市 + 区域（如「东京 浅草」）；区域与城市相同或缺失时只显示城市 */
export function placeAddress(trip: Pick<TripView, 'city' | 'destinationName'>, checkin?: Pick<CheckinView, 'area'> | null) {
  const city = trip.city?.trim() || trip.destinationName?.trim() || ''
  const area = checkin?.area?.trim() || ''
  if (!area) return city || null
  if (!city || area === city || area.startsWith(city)) return area
  return `${city} ${area}`
}

/** 素材列表 / 九宫格照片卡上的一张照片：地点、次级地址、第几天、时间（都来自真实打卡与照片数据） */
export type GridMaterial = {
  photo: PhotoView
  placeName: string | null
  address: string | null
  dayNo: number | null
  /** 照片所在日期（YYYY-MM-DD），用于没有关联打卡的照片 */
  date: string | null
  time: string
  featured: boolean
}

/** 一张照片的展示信息：地点优先取关联打卡；时间优先取拍摄时间，没有时用打卡时间 */
export function materialOf(photo: PhotoView, places: Map<number, GridPlace>, trip: Pick<TripView, 'city' | 'destinationName'>): GridMaterial {
  const place = photo.checkinId != null ? places.get(photo.checkinId) : undefined
  const when = photo.capturedAt || place?.checkin.checkinTime || null
  const d = toDate(when)
  const parts = d ? zonedParts(d) : null
  return {
    photo,
    placeName: place?.checkin.placeName?.trim() || null,
    address: place ? placeAddress(trip, place.checkin) : null,
    dayNo: place?.day ?? null,
    date: parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}` : null,
    time: when ? timeOfDay(when) : '',
    featured: photo.featured
  }
}

/** 「DAY 01 · 10:30」；没有关联打卡时用「10.01 · 10:30」，都没有时为空 */
export function materialWhen(m: Pick<GridMaterial, 'dayNo' | 'date' | 'time'>) {
  const head = m.dayNo ? `DAY ${String(m.dayNo).padStart(2, '0')}` : m.date ? dotDate(m.date).slice(5) : ''
  return [head, m.time].filter(Boolean).join(' · ')
}

export type MaterialGroup = { key: string; title: string; items: GridMaterial[] }

/** 素材列表：按天分组（精选在前）；整趟旅行时，没有关联打卡的照片放在最后一组 */
export function gridMaterialGroups(photos: PhotoView[], timeline: TimelineDay[], trip: Pick<TripView, 'city' | 'destinationName'>, day?: string): MaterialGroup[] {
  const places = placeIndex(timeline)
  const all = scopeTimeline(timeline)
  const groups: MaterialGroup[] = []
  const used = new Set<number>()
  const order = (list: GridMaterial[]) => [...list].sort((a, b) => Number(b.featured) - Number(a.featured) || (a.photo.capturedAt ?? '').localeCompare(b.photo.capturedAt ?? '') || a.photo.id - b.photo.id)
  scopeTimeline(timeline, day).forEach(d => {
    const no = all.findIndex(x => x.date === d.date) + 1
    const ids = new Set(d.items.map(i => i.checkin.id))
    const list = photos.filter(p => p.checkinId != null && ids.has(p.checkinId)).map(p => materialOf(p, places, trip))
    list.forEach(m => used.add(m.photo.id))
    if (list.length) groups.push({ key: d.date, title: `DAY ${String(no).padStart(2, '0')} · ${dotDate(d.date).slice(5)} ${weekdayOf(d.date)}`, items: order(list) })
  })
  if (!day) {
    const loose = photos.filter(p => !used.has(p.id)).map(p => materialOf(p, places, trip))
    if (loose.length) groups.push({ key: 'loose', title: '未关联打卡的照片', items: order(loose) })
  }
  return groups
}

/**
 * 把一张照片放进第 slot 格（0 起，按成品里照片格的顺序）：
 * - 这张照片还没选：slot 处已有照片就替换，否则接在已选的后面（不会留下空格）
 * - 这张照片已在别的格子：与目标格交换位置
 */
export function placeInSlot(selected: number[], photoId: number, slot: number, max = GRID_PHOTO_SLOTS) {
  const next = [...selected]
  const target = Math.max(0, Math.min(slot, next.length))
  const from = next.indexOf(photoId)
  if (from >= 0) {
    if (target >= next.length) { next.splice(from, 1); next.push(photoId) } else { next[from] = next[target]; next[target] = photoId }
    return next.slice(0, max)
  }
  if (target < next.length) next[target] = photoId
  else next.push(photoId)
  return next.slice(0, max)
}

/** 交换两个已选格子的顺序（任一格是自动补齐的格子时不变） */
export function swapSlots(selected: number[], a: number, b: number) {
  if (a === b || a >= selected.length || b >= selected.length) return selected
  const next = [...selected]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

/**
 * 九宫格格式：classic 标准九宫格（3 个信息格 + 6 张照片）；scrapbook 旅行手帐（9 张错落的照片卡）。
 * 格式只改变排版，素材选择（day / photoIds）两种格式共用。
 */
export type GridFormat = 'classic' | 'scrapbook'
export const GRID_FORMATS: { key: GridFormat; name: string; desc: string }[] = [
  { key: 'classic', name: '标准', desc: '规整经典' },
  { key: 'scrapbook', name: '旅行手帐', desc: '错落照片卡 · 地点标签' }
]
/** 每种格式的照片数量 */
export const gridSlotCount = (format: GridFormat = 'classic') => (format === 'scrapbook' ? 9 : GRID_PHOTO_SLOTS)

/**
 * 九宫格素材：哪一天（不选 = 整趟旅行、每天精选）、自由点选的照片（按格子顺序）。
 * 旅行手帐另有：coverPhotoId 主图（不设时自动选）、layout 照片卡排版（auto 按横竖自动 / order 按选择顺序）。
 */
export type GridOptions = { day?: string; photoIds: number[]; format?: GridFormat; coverPhotoId?: number; layout?: 'auto' | 'order' }
export const DEFAULT_GRID_OPTIONS: GridOptions = { photoIds: [] }

/**
 * 九宫格的 6 张照片：先放用户点选的（按点选顺序），没选满时自动补齐——
 * 整趟旅行用每天的精选，某一天则用当天照片（精选在前、不同地点轮流）。
 */
export function gridPhotos(photos: PhotoView[], timeline: TimelineDay[], options: GridOptions, count = 6) {
  const scoped = scopePhotos(photos, timeline, options.day)
  const chosen = options.photoIds.map(id => scoped.find(p => p.id === id)).filter((p): p is PhotoView => !!p).slice(0, count)
  const auto = options.day ? pickGridPhotos(scoped, scoped.length) : dailyFeaturedPhotos(scoped, timeline, scoped.length)
  return [...chosen, ...auto.filter(p => !chosen.includes(p))].slice(0, count)
}
