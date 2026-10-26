/**
 * 城市海报的数据层：API 原始数据（Trip / Summary / Photo / Timeline / Itinerary）→ PosterData → 海报组件。
 * 海报组件只读 PosterData，不再各自处理原始数据。全部来自真实旅行，没有的内容就不显示：
 * 不随机、不编造文字 / 统计 / 路线，同样的输入永远得到同样的海报。
 */

import type { CheckinView, ItineraryView, PhotoView, TimelineDay, TripSummary, TripView } from '@/services/tabitrace-api'
import { toDate, zonedParts } from '@/lib/time'
import { photoMedium } from '@/utils/photo-variants'
import { cityEn, cityOf, placeLabelEn } from '@/utils/share-long'
import { dayNumber, scopePhotos, scopeTimeline } from '@/utils/share-grid'
import { cityKanji } from '@/utils/share-poster'

// ---------------------------------------------------------------- 素材选择

/** 海报文字的来源：自动挑选 / 指定某条打卡文字 / 自己写一句 / 不放文字 */
export type QuoteChoice = { mode: 'auto' } | { mode: 'note'; checkinId: number } | { mode: 'custom'; text: string } | { mode: 'none' }

/**
 * 「海报素材」面板里的选择：日期（不选 = 整趟旅行）、主照片、辅助照片（拍立得，最多 2 张）、海报文字、海报标题。
 * 没有指定的项自动挑选。
 */
export type PosterOptions = { day?: string; mainPhotoId?: number; secondaryIds: number[]; quote: QuoteChoice; title?: string }
export const DEFAULT_POSTER_OPTIONS: PosterOptions = { secondaryIds: [], quote: { mode: 'auto' } }

export const POSTER_TITLE_MAX = 20
export const POSTER_QUOTE_MAX = 35
export const POSTER_SECONDARY_MAX = 2

// ---------------------------------------------------------------- ViewModel

export type PosterPhoto = { id: number; url: string; place?: string; date?: string; note?: string }
export type PosterRoutePoint = { order: number; name: string; lat: number; lng: number; occurredAt: string }
export type PosterStat = { value: string; en: string; zh: string }
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type PosterData = {
  tripNumber: string
  title: string
  /** 标题拆成的行；accent 为该行末尾用强调色的部分 */
  titleLines: { text: string; accent?: string }[]
  titleSize: number
  cityName: string
  cityKanji: string
  cityNameEn: string
  placeEn: string
  startDate: string
  endDate: string
  days: number
  /** 只做某一天的海报时 */
  day?: { date: string; no: number }
  mainPhoto?: PosterPhoto
  secondaryPhotos: PosterPhoto[]
  quote?: string
  /** 「写于 · 银座 · 午后 · 晴」：只用打卡里真实存在的地点、时间段与天气 */
  quoteSource?: string
  stats: { days: PosterStat; places: PosterStat; photos: PosterStat; explored: PosterStat }
  route: PosterRoutePoint[]
  /** 装饰用的季节（由旅行日期所在月份决定，南半球国家反过来），不出现在文字里 */
  season: Season
  countryCode?: string
}

// ---------------------------------------------------------------- 工具

const pad3 = (n: number) => String(Math.abs(n) % 1000).padStart(3, '0')
const chars = (s: string) => Array.from(s)
export const clip = (s: string, max: number) => (chars(s).length > max ? chars(s).slice(0, max - 1).join('') + '…' : s)

function checkinIndex(timeline: TimelineDay[]) {
  const map = new Map<number, { checkin: CheckinView; date: string }>()
  timeline.forEach(d => d.items.forEach(i => map.set(i.checkin.id, { checkin: i.checkin, date: d.date })))
  return map
}

/** 打卡当地的小时（有打卡时区就用打卡时区，否则用用户时区） */
function localHour(c: CheckinView) {
  const d = toDate(c.checkinTime)
  if (!d) return null
  try { return zonedParts(d, c.timezone || undefined).hour } catch { return zonedParts(d).hour }
}

function period(hour: number | null) {
  if (hour == null) return ''
  if (hour >= 5 && hour < 9) return '清晨'
  if (hour < 11 && hour >= 9) return '上午'
  if (hour < 13 && hour >= 11) return '中午'
  if (hour < 17 && hour >= 13) return '午后'
  if (hour < 19 && hour >= 17) return '傍晚'
  return '夜里'
}

const SOUTHERN = new Set(['AU', 'NZ', 'AR', 'CL', 'ZA', 'BR', 'UY', 'PY'])
export function seasonOf(date: string, countryCode?: string): Season {
  const m = Number(date.slice(5, 7))
  const north: Season = m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter'
  if (!countryCode || !SOUTHERN.has(countryCode.toUpperCase())) return north
  return ({ spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' } as const)[north]
}

/**
 * 标题分行：城市名在中间时在城市名前断开（秋天的｜东京漫步）；以城市名开头时在城市名后断开（京都｜春日漫游）；
 * 否则较长的标题从中间断开。末尾两个字用强调色。
 */
export function splitTitle(title: string, city: string) {
  const t = title.trim()
  const n = chars(t).length
  let lines: string[]
  const i = city ? t.indexOf(city) : -1
  if (i > 0) lines = [t.slice(0, i), t.slice(i)]
  else if (i === 0 && n - chars(city).length >= 2) lines = [city, t.slice(city.length)]
  else if (n >= 7) { const cut = Math.ceil(n / 2); lines = [chars(t).slice(0, cut).join(''), chars(t).slice(cut).join('')] }
  else lines = [t]
  return lines.map((text, k) => {
    const last = k === lines.length - 1
    const cs = chars(text)
    return last && cs.length >= 3 && /[一-鿿]{2}$/.test(text) ? { text: cs.slice(0, -2).join(''), accent: cs.slice(-2).join('') } : { text }
  })
}

/** 按最长一行定字号，保证标题放得进左栏（左栏宽约 420px） */
export function titleSizeOf(lines: { text: string; accent?: string }[]) {
  const len = Math.max(...lines.map(l => chars(l.text + (l.accent ?? '')).length))
  if (len <= 4) return 96
  if (len <= 5) return 82
  if (len <= 6) return 68
  if (len <= 8) return 52
  if (len <= 10) return 42
  return 34
}

// ---------------------------------------------------------------- 照片

/**
 * 自动挑照片：精选 > 有地点关联 > 有打卡文字 > 不同日期 > 不同地点 > 时间顺序。
 * 没有图像相似度模型，用「同一次打卡 / 同一地点 / 同一天」去重，避免连着挑到几乎一样的照片。
 */
export function autoPhotos(photos: PhotoView[], timeline: TimelineDay[], exclude: number[] = [], count = 1 + POSTER_SECONDARY_MAX, already: PhotoView[] = []) {
  const index = checkinIndex(timeline)
  const info = (p: PhotoView) => {
    const hit = p.checkinId != null ? index.get(p.checkinId) : undefined
    return { p, hit, place: hit?.checkin.placeId != null ? `p${hit.checkin.placeId}` : hit ? `n${hit.checkin.placeName}` : null, date: hit?.date ?? p.capturedAt?.slice(0, 10) ?? null, at: p.capturedAt ?? hit?.checkin.checkinTime ?? '' }
  }
  const base = (x: ReturnType<typeof info>) => (x.p.featured ? 8 : 0) + (x.hit ? 4 : 0) + (x.hit?.checkin.note?.trim() ? 2 : 0)
  const pool = photos.filter(p => !exclude.includes(p.id) && !already.includes(p)).map(info)
  // already：已经放进海报的照片（如用户指定的主图），只参与「不同日期 / 地点」的比较，不再返回
  const picked: ReturnType<typeof info>[] = already.map(info)
  const start = picked.length
  while (picked.length - start < count && picked.length - start < pool.length) {
    const rest = pool.filter(x => !picked.includes(x))
    const score = (x: ReturnType<typeof info>) => base(x)
      + (x.date && !picked.some(y => y.date === x.date) ? 1.5 : 0)
      + (x.place && !picked.some(y => y.place === x.place) ? 1 : 0)
      - (x.p.checkinId != null && picked.some(y => y.p.checkinId === x.p.checkinId) ? 6 : 0)
    rest.sort((a, b) => score(b) - score(a) || a.at.localeCompare(b.at) || a.p.id - b.p.id)
    picked.push(rest[0])
  }
  return picked.slice(start).map(x => x.p)
}

function describePhoto(p: PhotoView, timeline: TimelineDay[]): PosterPhoto {
  const hit = p.checkinId != null ? checkinIndex(timeline).get(p.checkinId) : undefined
  const d = toDate(p.capturedAt)
  const parts = d ? zonedParts(d) : null
  const shot = parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}` : undefined
  return { id: p.id, url: photoMedium(p), place: hit?.checkin.placeName?.trim() || undefined, date: hit?.date ?? shot, note: hit?.checkin.note?.trim() || undefined }
}

// ---------------------------------------------------------------- 文字

export function notedCheckins(timeline: TimelineDay[]) {
  return timeline.flatMap(d => d.items).map(i => i.checkin).filter(c => c.note?.trim())
}

/**
 * 自动选文字：有文字的打卡里，优先精选照片所在的那次打卡；再取不超过 35 字里最长的一句；
 * 全都超过 35 字时取最短的一句截断。没有任何文字时返回 undefined，海报不放文字。
 */
export function autoQuote(timeline: TimelineDay[], photos: PhotoView[]) {
  const notes = notedCheckins(timeline)
  if (!notes.length) return undefined
  const featured = new Set(photos.filter(p => p.featured && p.checkinId != null).map(p => p.checkinId))
  const len = (c: CheckinView) => chars(c.note!.trim()).length
  const rank = (list: CheckinView[]) => {
    const fit = list.filter(c => len(c) <= POSTER_QUOTE_MAX)
    if (fit.length) return fit.reduce((a, b) => (len(b) > len(a) ? b : a))
    return list.length ? list.reduce((a, b) => (len(b) < len(a) ? b : a)) : undefined
  }
  return rank(notes.filter(c => featured.has(c.id))) ?? rank(notes)
}

function quoteSourceOf(c: CheckinView) {
  return ['写于', c.placeName?.trim(), period(localHour(c)), c.weatherText?.trim()].filter(Boolean).join(' · ')
}

// ---------------------------------------------------------------- 路线与统计

/** 路线：范围内的打卡按时间先后排序，跳过没有坐标的，同一地点只取第一次 */
export function routeOf(timeline: TimelineDay[]): PosterRoutePoint[] {
  const seen = new Set<string>()
  return timeline.flatMap(d => d.items.map(i => i.checkin))
    .filter(c => c.latitude != null && c.longitude != null)
    .sort((a, b) => (toDate(a.checkinTime)?.getTime() ?? 0) - (toDate(b.checkinTime)?.getTime() ?? 0) || a.id - b.id)
    .filter(c => { const k = c.placeId != null ? `p${c.placeId}` : `n${c.placeName}`; if (seen.has(k)) return false; seen.add(k); return true })
    .map((c, i) => ({ order: i + 1, name: c.placeName, lat: c.latitude!, lng: c.longitude!, occurredAt: c.checkinTime }))
}

/**
 * 探索进度：东京等有官方精选地点的城市用后端的探索率；
 * 否则用行程计划：去过的计划地点 / 计划地点总数（某一天只看当天的计划）。都算不出来时改显示走过的区域数。
 */
function exploredStat(summary: TripSummary, itinerary: ItineraryView[], checkins: CheckinView[], day?: string, areas = 0): PosterStat {
  const plans = day ? itinerary.filter(i => i.plannedDate === day) : itinerary
  if (!day && summary.officialPlacesTotal > 0) return { value: `${summary.explorationRate}%`, en: 'EXPLORED', zh: '探索进度' }
  if (plans.length) {
    const done = plans.filter(i => i.status === 'DONE' || checkins.some(c => c.itineraryItemId === i.id || (i.placeId != null && c.placeId === i.placeId))).length
    return { value: `${Math.round((done * 100) / plans.length)}%`, en: 'EXPLORED', zh: day ? '当天计划完成' : '计划地点完成' }
  }
  return { value: String(areas), en: 'AREAS', zh: day ? '当天走过的区域' : '走过的区域' }
}

const placeKey = (c: CheckinView) => (c.placeId != null ? `p${c.placeId}` : `n${c.placeName?.trim().toLowerCase()}`)

// ---------------------------------------------------------------- 组装

export function buildPosterData({ trip, summary, photos, timeline, itinerary = [], options = DEFAULT_POSTER_OPTIONS }: {
  trip: TripView
  summary: TripSummary
  photos: PhotoView[]
  timeline: TimelineDay[]
  itinerary?: ItineraryView[]
  options?: PosterOptions
}): PosterData {
  const scoped = scopeTimeline(timeline, options.day)
  const scopedPhotos = scopePhotos(photos, timeline, options.day)
  const city = cityOf(trip)
  const title = (options.title?.trim() || trip.title).slice(0, 40)
  const lines = splitTitle(title, city)

  // 照片：指定的优先，其余自动；主图与拍立得不重复
  const byId = (id?: number) => scopedPhotos.find(p => p.id === id)
  const chosenMain = byId(options.mainPhotoId)
  const chosenSecondary = options.secondaryIds.map(byId).filter((p): p is PhotoView => !!p && p.id !== chosenMain?.id).slice(0, POSTER_SECONDARY_MAX)
  const main = chosenMain ?? autoPhotos(scopedPhotos, timeline, chosenSecondary.map(p => p.id), 1)[0]
  // 辅助照片：指定了就完全按指定（1 或 2 张）；没指定时自动挑，并尽量与主图不同日期、不同地点
  const secondary = chosenSecondary.length ? chosenSecondary : autoPhotos(scopedPhotos, timeline, [], POSTER_SECONDARY_MAX, main ? [main] : [])

  // 文字
  let quote: string | undefined
  let quoteSource: string | undefined
  const q = options.quote
  if (q.mode === 'custom') quote = q.text.trim() || undefined
  else if (q.mode !== 'none') {
    const c = (q.mode === 'note' ? notedCheckins(timeline).find(x => x.id === q.checkinId) : undefined) ?? autoQuote(scoped, scopedPhotos)
    if (c) { quote = c.note!.trim(); quoteSource = quoteSourceOf(c) }
  }
  if (quote) quote = clip(quote, POSTER_QUOTE_MAX)

  const checkins = scoped.flatMap(d => d.items.map(i => i.checkin))
  const allCheckins = timeline.flatMap(d => d.items.map(i => i.checkin))
  const places = new Set(checkins.map(placeKey)).size
  const areas = new Set(checkins.map(c => c.area?.trim()).filter(Boolean)).size
  const dayNo = options.day ? dayNumber(timeline, options.day) : 0
  const mainInfo = main ? describePhoto(main, timeline) : undefined
  const secondaryInfo = secondary.map(p => describePhoto(p, timeline)).map(p => (p.note && quote && p.note.startsWith(quote.replace(/…$/, '')) ? { ...p, note: undefined } : p))

  return {
    tripNumber: pad3(trip.id),
    title,
    titleLines: lines,
    titleSize: titleSizeOf(lines),
    cityName: city,
    cityKanji: cityKanji(trip),
    cityNameEn: cityEn(trip),
    placeEn: placeLabelEn(trip),
    startDate: trip.startDate,
    endDate: trip.endDate,
    days: summary.days,
    day: options.day ? { date: options.day, no: dayNo } : undefined,
    mainPhoto: mainInfo,
    secondaryPhotos: secondaryInfo,
    quote,
    quoteSource,
    stats: {
      days: options.day ? { value: String(dayNo).padStart(2, '0'), en: 'DAY', zh: `第 ${dayNo} 天` } : { value: String(summary.days), en: 'DAYS', zh: '旅行天数' },
      places: { value: String(places), en: 'PLACES', zh: options.day ? '当天打卡地点' : '打卡地点' },
      photos: { value: String(scopedPhotos.length), en: 'PHOTOS', zh: options.day ? '当天照片' : '旅行照片' },
      explored: exploredStat(summary, itinerary, options.day ? checkins : allCheckins, options.day, areas)
    },
    route: routeOf(scoped),
    season: seasonOf(options.day ?? trip.startDate, trip.countryCode),
    countryCode: trip.countryCode?.toUpperCase()
  }
}
