/**
 * 旅行成果海报的数据整理：挑主图与拍立得照片、取旅行者自己写的一句话、
 * 把打卡坐标投影成线稿路线图。全部来自真实旅行数据，缺什么就不显示什么。
 */

import type { CheckinView, PhotoView, TimelineDay, TripView } from '@/services/tabitrace-api'
import { cityOf, coverPhoto } from '@/utils/share-long'
import { pickGridPhotos, scopePhotos, scopeTimeline } from '@/utils/share-grid'

export { dayNumber, scopePhotos, scopeTimeline } from '@/utils/share-grid'

/** 日本城市在海报上用日文汉字竖排（東京、横浜…），其余城市保持原名 */
const JA_KANJI: Record<string, string> = { 东京: '東京', 横滨: '横浜', 福冈: '福岡', 冲绳: '沖縄', 神户: '神戸', 广岛: '広島', 镰仓: '鎌倉', 箱根: '箱根' }
export const cityKanji = (trip: TripView) => JA_KANJI[cityOf(trip)] ?? cityOf(trip)

export type PosterPhoto = { url: string; place?: string; date?: string; note?: string }

/** 打卡 id → 地点名与所在日期，用来给照片写说明 */
function checkinIndex(timeline: TimelineDay[]) {
  const map = new Map<number, { checkin: CheckinView; date: string }>()
  timeline.forEach(d => d.items.forEach(i => map.set(i.checkin.id, { checkin: i.checkin, date: d.date })))
  return map
}

/** 海报文字的来源：自动挑选 / 指定某条打卡文字 / 自己写一句 / 不放文字 */
export type QuoteChoice = { mode: 'auto' } | { mode: 'note'; checkinId: number } | { mode: 'custom'; text: string } | { mode: 'none' }

/** 用户在「海报素材」里做的选择：哪一天（不选=整趟旅行）、哪几张照片（按点选顺序）、放哪段文字 */
export type PosterOptions = { day?: string; photoIds: number[]; quote: QuoteChoice }
export const DEFAULT_POSTER_OPTIONS: PosterOptions = { photoIds: [], quote: { mode: 'auto' } }

/**
 * 主图 + 拍立得。
 * 用户点选了照片：第 1 张是主图，第 2、3 张是拍立得，完全按用户的选择；
 * 没有点选：照片 ≥3 张用 2 张拍立得，2 张用 1 张，1 张及以下不放拍立得（地图放大），
 * 拍立得尽量取与主图不同地点的照片。永远不会出现空的图片框。
 * 旅行封面只在「整趟旅行」且没有任何照片时兜底（某一天的海报不借用别处的图）。
 */
export function posterPhotos(trip: TripView, photos: PhotoView[], timeline: TimelineDay[], selectedIds: number[] = [], allowCover = true) {
  const index = checkinIndex(timeline)
  const describe = (p: PhotoView): PosterPhoto => {
    const hit = p.checkinId != null ? index.get(p.checkinId) : undefined
    return { url: p.imageUrl, place: hit?.checkin.placeName, date: hit?.date ?? p.capturedAt?.slice(0, 10), note: hit?.checkin.note?.trim() || undefined }
  }

  const chosen = selectedIds.map(id => photos.find(p => p.id === id)).filter((p): p is PhotoView => !!p)
  if (chosen.length) return { hero: describe(chosen[0]), polaroids: chosen.slice(1, 3).map(describe) }

  const ordered = pickGridPhotos(photos, photos.length)
  const heroUrl = allowCover ? coverPhoto(trip, photos) : coverPhoto({ ...trip, coverImage: undefined }, photos)
  const heroPhoto = ordered.find(p => p.imageUrl === heroUrl)
  const hero: PosterPhoto | undefined = heroPhoto ? describe(heroPhoto) : heroUrl ? { url: heroUrl } : undefined

  const count = photos.length >= 3 ? 2 : photos.length === 2 ? 1 : 0
  const rest = ordered.filter(p => p !== heroPhoto)
  const otherPlaces = rest.filter(p => p.checkinId == null || p.checkinId !== heroPhoto?.checkinId)
  const polaroids = [...otherPlaces, ...rest.filter(p => !otherPlaces.includes(p))].slice(0, count).map(describe)
  return { hero, polaroids }
}

/** 范围内写过文字的打卡（按时间顺序），供「海报素材」里挑选 */
export function notedCheckins(timeline: TimelineDay[]) {
  return timeline.flatMap(d => d.items).map(i => i.checkin).filter(c => c.note?.trim())
}

/**
 * 海报上的一段文字：全部来自用户自己——发过的打卡文字（注明写于哪里），或在海报素材里亲手写的一句。
 * 自动模式取范围内最完整的一句；没有就返回 undefined，海报隐藏这一块，绝不代写。
 */
export function posterQuote(timeline: TimelineDay[], choice: QuoteChoice = { mode: 'auto' }, allTimeline: TimelineDay[] = timeline): { text: string; place?: string } | undefined {
  if (choice.mode === 'none') return undefined
  if (choice.mode === 'custom') return choice.text.trim() ? { text: choice.text.trim() } : undefined
  if (choice.mode === 'note') {
    const c = notedCheckins(allTimeline).find(x => x.id === choice.checkinId)
    if (c) return { text: c.note!.trim(), place: c.placeName }
  }
  const notes = notedCheckins(timeline)
  if (!notes.length) return undefined
  const best = notes.reduce((a, b) => (b.note!.trim().length > a.note!.trim().length ? b : a))
  return { text: best.note!.trim(), place: best.placeName }
}

export type MapPoint = { x: number; y: number; name: string }

/**
 * 线稿路线图：按到访顺序取有坐标的地点（同名只取一次），多于 max 个时均匀抽取，
 * 再等比投影进 width × height 的画框里（经度按纬度余弦压缩，形状不变形）。
 */
export function routePoints(timeline: TimelineDay[], width: number, height: number, max = 6, pad = 34): MapPoint[] {
  const seen = new Set<string>()
  const places = timeline.flatMap(d => d.items.map(i => i.checkin)).filter(c => {
    if (c.latitude == null || c.longitude == null || seen.has(c.placeName)) return false
    seen.add(c.placeName)
    return true
  })
  const picked = places.length <= max ? places : Array.from({ length: max }, (_, i) => places[Math.round((i * (places.length - 1)) / (max - 1))])
  if (!picked.length) return []

  const meanLat = picked.reduce((s, c) => s + c.latitude!, 0) / picked.length
  const k = Math.cos((meanLat * Math.PI) / 180)
  const raw = picked.map(c => ({ x: c.longitude! * k, y: -c.latitude!, name: c.placeName }))
  const xs = raw.map(p => p.x), ys = raw.map(p => p.y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const spanX = maxX - minX, spanY = maxY - minY
  const scale = spanX || spanY ? Math.min((width - pad * 2) / (spanX || 1e-9), (height - pad * 2) / (spanY || 1e-9)) : 0
  const offX = (width - spanX * scale) / 2, offY = (height - spanY * scale) / 2
  return raw.map(p => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale, name: p.name }))
}

/** 地图背景的道路纹理：由旅行 id 决定的伪随机曲线，同一趟旅行每次导出都一样 */
export function roadTexture(seed: number, width: number, height: number, count = 9) {
  let s = seed * 9301 + 49297
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  return Array.from({ length: count }, (_, i) => {
    const horizontal = i % 2 === 0
    const a = rand() * (horizontal ? height : width), b = rand() * (horizontal ? height : width)
    const c1 = rand() * (horizontal ? height : width), c2 = rand() * (horizontal ? height : width)
    return horizontal
      ? `M -10 ${a.toFixed(1)} C ${(width * 0.33).toFixed(1)} ${c1.toFixed(1)}, ${(width * 0.66).toFixed(1)} ${c2.toFixed(1)}, ${width + 10} ${b.toFixed(1)}`
      : `M ${a.toFixed(1)} -10 C ${c1.toFixed(1)} ${(height * 0.33).toFixed(1)}, ${c2.toFixed(1)} ${(height * 0.66).toFixed(1)}, ${b.toFixed(1)} ${height + 10}`
  })
}

/** 主标题拆成上下两行：标题里含城市名时在城市名处断开（我的｜东京旅行、东京｜三日散步），否则交给排版自然换行 */
export function titleLines(title: string, city: string): string[] {
  const t = title.trim()
  const i = t.indexOf(city)
  if (i > 0) return [t.slice(0, i), t.slice(i)]
  if (i === 0 && Array.from(t).length - Array.from(city).length >= 2) return [city, t.slice(city.length)]
  return [t]
}

/** 按最长一行的字数定字号，保证标题始终放得进左栏 */
export function titleFontSize(lines: string[]) {
  const len = Math.max(...lines.map(l => Array.from(l).length))
  if (lines.length === 1 && len > 6) return len <= 10 ? 40 : len <= 16 ? 32 : 27
  if (len <= 3) return 64
  if (len <= 4) return 58
  if (len <= 5) return 50
  if (len <= 6) return 44
  if (len <= 8) return 36
  if (len <= 10) return 30
  return len <= 12 ? 27 : 25
}

export type StampCorner = 'tr' | 'br' | 'tl'

/** 邮戳放在路线图里地点最少的角上（优先右上），避免压住路线和地名 */
export function stampCorner(points: MapPoint[], width: number, height: number): StampCorner {
  const corners: [StampCorner, number, number][] = [['tr', width, 0], ['br', width, height], ['tl', 0, 0]]
  const crowd = ([, cx, cy]: [StampCorner, number, number]) => points.filter(p => Math.abs(p.x - cx) < 130 && Math.abs(p.y - cy) < 95).length
  return corners.reduce((best, c) => (crowd(c) < crowd(best) ? c : best))[0]
}
