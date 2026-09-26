/**
 * 分享九宫格的数据整理：挑 6 张照片、给照片配上拍摄地点、照片不够时用打卡地点补位。
 * 与长图一样，只用真实数据，不编造内容。
 */

import type { CheckinView, PhotoView, TimelineDay } from '@/services/tabitrace-api'

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

/** 九宫格素材：哪一天（不选 = 整趟旅行、每天精选）、自由点选的照片（按格子顺序） */
export type GridOptions = { day?: string; photoIds: number[] }
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
