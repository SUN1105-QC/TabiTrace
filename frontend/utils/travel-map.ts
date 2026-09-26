/**
 * 旅行地图工作台的纯逻辑：把行程（itinerary）与打卡（timeline）合并成统一的“旅程节点”，
 * 并由此推导地图点位、Marker 样式、每日进度与下一站。页面、地图、面板、时间轴都只用这里的结果。
 */

import type { ItineraryView, PlaceView, TimelineDay, TimelinePhoto, TripView } from '@/services/tabitrace-api'
import { parseDay } from '@/utils/journey'

export type MarkerVariant = 'checkedIn' | 'planned' | 'saved'
export type DayKey = 'ALL' | string

/** 一个旅程节点：一条计划（可能已打卡），或一次没有计划的打卡 */
export type JourneyStop = {
  key: string
  /** 地图点位与列表共用的选择键：同一地点多次出现时指向同一个 Marker */
  selectKey: string
  date: string
  name: string
  area?: string
  lat?: number
  lng?: number
  plannedTime?: string
  actualTime?: string
  status: 'done' | 'planned'
  itineraryId?: number
  checkinId?: number
  placeId?: number
  official: boolean
  photos: TimelinePhoto[]
  note?: string
}

export type MapPoint = { key: string; lat: number; lng: number; name: string; area?: string; variant: MarkerVariant; order?: number }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined)
/** 12:00:00 → 12:00 */
const hm = (t?: string | null) => (t ? t.slice(0, 5) : undefined)
/** 带时区偏移的 ISO 时间：直接取其中的当地日期与时刻（后端已按用户时区给出） */
const localParts = (iso: string) => ({ date: iso.slice(0, 10), time: iso.slice(11, 16) })

export const selectKeyOf = (s: { placeId?: number | null; itineraryId?: number | null; checkinId?: number | null }) =>
  s.placeId ? `p${s.placeId}` : s.itineraryId ? `i${s.itineraryId}` : `c${s.checkinId}`

/** 合并行程与打卡：由行程打卡的记录并入对应计划，显示“原计划 12:00 · 12:18 已打卡” */
export function buildStops(itinerary: ItineraryView[], timeline: TimelineDay[], places: PlaceView[]): JourneyStop[] {
  const placeById = new Map(places.map(p => [p.id, p]))
  const items = timeline.flatMap(d => d.items)
  const byItinerary = new Map<number, (typeof items)[number]>()
  items.forEach(i => { if (i.checkin.itineraryItemId) byItinerary.set(i.checkin.itineraryItemId, i) })
  const used = new Set<number>()
  const coords = (placeId?: number | null, ...pairs: [unknown, unknown][]) => {
    for (const [la, ln] of pairs) { const lat = num(la), lng = num(ln); if (lat !== undefined && lng !== undefined) return { lat, lng } }
    const p = placeId ? placeById.get(placeId) : undefined
    return p && num(p.latitude) !== undefined && num(p.longitude) !== undefined ? { lat: num(p.latitude)!, lng: num(p.longitude)! } : {}
  }

  const stops: JourneyStop[] = itinerary.map(it => {
    const hit = byItinerary.get(it.id)
    if (hit) used.add(hit.checkin.id)
    const placeId = it.placeId ?? undefined
    return {
      key: `it-${it.id}`, selectKey: selectKeyOf({ placeId, itineraryId: it.id }), date: it.plannedDate,
      name: it.placeName || hit?.checkin.placeName || '未命名地点', area: it.area || hit?.checkin.area || undefined,
      ...coords(placeId, [it.latitude, it.longitude], [hit?.checkin.latitude, hit?.checkin.longitude]),
      plannedTime: hm(it.plannedTime), actualTime: hit ? localParts(hit.checkin.checkinTime).time : undefined,
      status: it.status === 'DONE' || hit ? 'done' : 'planned', itineraryId: it.id, checkinId: hit?.checkin.id, placeId,
      official: placeId ? placeById.get(placeId)?.sourceType === 'OFFICIAL' : false,
      photos: hit?.photos ?? [], note: hit?.checkin.note || it.note || undefined
    }
  })

  items.filter(i => !used.has(i.checkin.id)).forEach(({ checkin: c, photos }) => {
    const { date, time } = localParts(c.checkinTime)
    const placeId = c.placeId ?? undefined
    stops.push({
      key: `ck-${c.id}`, selectKey: selectKeyOf({ placeId, checkinId: c.id }), date, name: c.placeName || '打卡', area: c.area || undefined,
      ...coords(placeId, [c.latitude, c.longitude]), actualTime: time, status: 'done', checkinId: c.id, placeId,
      official: placeId ? placeById.get(placeId)?.sourceType === 'OFFICIAL' : false, photos, note: c.note || undefined
    })
  })

  return stops.sort((a, b) => a.date.localeCompare(b.date) || (a.actualTime ?? a.plannedTime ?? '99:99').localeCompare(b.actualTime ?? b.plannedTime ?? '99:99'))
}

export const stopsOfDay = (stops: JourneyStop[], day: DayKey) => (day === 'ALL' ? stops : stops.filter(s => s.date === day))

/** Marker 样式只在这里决定：打卡过 → 品牌橙实心；有计划 → 深色编号；只是收藏 / 自定义 → 空心 */
export function getMapMarkerVariant(state: { checkedIn: boolean; planned: boolean }): MarkerVariant {
  return state.checkedIn ? 'checkedIn' : state.planned ? 'planned' : 'saved'
}

/**
 * 地图点位：选中某天时只显示当天的节点；“全部”时再加上已收藏但还没安排的地点。
 * 同一地点多次出现合并为一个点；计划点位按时间编号。
 */
export function buildMapPoints(stops: JourneyStop[], places: PlaceView[], day: DayKey): MapPoint[] {
  const groups = new Map<string, JourneyStop[]>()
  stopsOfDay(stops, day).forEach(s => groups.set(s.selectKey, [...(groups.get(s.selectKey) ?? []), s]))
  const points: MapPoint[] = []
  let order = 0
  groups.forEach((list, key) => {
    const withCoords = list.find(s => s.lat !== undefined && s.lng !== undefined)
    const variant = getMapMarkerVariant({ checkedIn: list.some(s => s.status === 'done'), planned: list.some(s => s.status === 'planned') })
    if (variant === 'planned') order++
    if (!withCoords) return
    points.push({ key, lat: withCoords.lat!, lng: withCoords.lng!, name: list[0].name, area: list[0].area, variant, order: variant === 'planned' ? order : undefined })
  })
  if (day === 'ALL') {
    places.forEach(p => {
      const key = `p${p.id}`
      const lat = num(p.latitude), lng = num(p.longitude)
      if (groups.has(key) || lat === undefined || lng === undefined) return
      points.push({ key, lat, lng, name: p.name, area: p.area, variant: getMapMarkerVariant({ checkedIn: false, planned: false }) })
    })
  }
  return points
}

/** 旅行的每一天（含首尾）；日期无效时返回空 */
export function tripDays(trip: Pick<TripView, 'startDate' | 'endDate'>): string[] {
  const a = parseDay(trip.startDate), b = parseDay(trip.endDate)
  if (a === null || b === null || b < a) return []
  const out: string[] = []
  for (let t = a; t <= b && out.length < 120; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

export const dayLabel = (days: string[], day: string) => `DAY ${String(days.indexOf(day) + 1).padStart(2, '0')}`

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export function dayTitle(day: string) {
  const t = parseDay(day)
  if (t === null) return day
  const d = new Date(t)
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${WEEK[d.getUTCDay()]}`
}

/** 今天在旅行期间 → 默认选中今天，否则显示全部 */
export function defaultDay(days: string[], today: string): DayKey {
  return days.includes(today) ? today : 'ALL'
}

export function dayProgress(stops: JourneyStop[]) {
  const planned = stops.filter(s => s.itineraryId)
  const done = planned.filter(s => s.status === 'done').length
  return { planned: planned.length, done, extraCheckins: stops.filter(s => !s.itineraryId).length, ratio: planned.length ? done / planned.length : 0 }
}

/**
 * 下一站：未完成的计划按日期时间排序，取第一个“还没过去一小时以上”的；
 * 全部都已经过了计划时间时，返回最早的那个并标记 overdue。
 */
export function getNextStop(stops: JourneyStop[], now: Date): { stop: JourneyStop; overdue: boolean } | null {
  const pending = stops.filter(s => s.status === 'planned').sort((a, b) => a.date.localeCompare(b.date) || (a.plannedTime ?? '99:99').localeCompare(b.plannedTime ?? '99:99'))
  if (!pending.length) return null
  const cut = new Date(now.getTime() - 3600000)
  const cutKey = `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}-${String(cut.getDate()).padStart(2, '0')} ${String(cut.getHours()).padStart(2, '0')}:${String(cut.getMinutes()).padStart(2, '0')}`
  const upcoming = pending.find(s => `${s.date} ${s.plannedTime ?? '23:59'}` >= cutKey)
  return upcoming ? { stop: upcoming, overdue: false } : { stop: pending[0], overdue: true }
}

/** 外部地图导航（只在有坐标时提供） */
export const navigationUrl = (s: Pick<JourneyStop, 'lat' | 'lng'>) =>
  s.lat !== undefined && s.lng !== undefined ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}` : null
