/**
 * 推荐探索（东京探索指南）的展示规则：分类筛选、排序、标签文案、文字封面配色、距离，
 * 以及「全部地点」的混排节奏（标准卡 / 专题横幅 / 轻量信息卡）。
 * 地点内容与热度都来自后端官方内容库，这里不编造任何数据。
 */

import type { OfficialRouteView, PlaceView } from '@/services/tabitrace-api'

export type FilterDef = { key: string; label: string; match: (p: PlaceView) => boolean; hidden?: boolean }

const hasTag = (tag: string) => (p: PlaceView) => Boolean(p.tags?.includes(tag))
const inCategory = (...cats: string[]) => (p: PlaceView) => cats.includes(p.category ?? '')

/** 主分类（一排胶囊）+ 快捷入口 / 信息卡使用的隐藏分类 */
export const FILTERS: FilterDef[] = [
  { key: 'ALL', label: '全部', match: () => true },
  { key: 'HOT', label: '热门', match: p => (p.tripCount ?? 0) > 0 },
  { key: 'LANDMARK', label: '地标', match: inCategory('地标', '城市地标', '观景台') },
  { key: 'STREET', label: '街区', match: inCategory('街区') },
  { key: 'SHRINE', label: '寺社', match: inCategory('寺院', '神社') },
  { key: 'MUSEUM', label: '展馆', match: inCategory('博物馆', '文化') },
  { key: 'WALK', label: '散步', match: hasTag('WALK') },
  { key: 'NIGHT', label: '夜景', match: hasTag('NIGHT') },
  { key: 'FOOD', label: '美食', match: hasTag('FOOD') },
  { key: 'SHOP', label: '购物', match: hasTag('SHOP') },
  { key: 'NATURE', label: '自然', match: hasTag('NATURE') },
  { key: 'MUST', label: '必去地标', match: hasTag('MUST'), hidden: true },
  { key: 'PHOTO', label: '拍照出片', match: hasTag('PHOTO'), hidden: true },
  { key: 'FREE', label: '免费景点', match: hasTag('FREE'), hidden: true },
  { key: 'RAIN', label: '雨天也适合', match: hasTag('RAIN'), hidden: true },
  { key: 'FIRST', label: '第一次来东京', match: hasTag('FIRST'), hidden: true }
]
export const filterOf = (key: string) => FILTERS.find(f => f.key === key) ?? FILTERS[0]

export type SortKey = 'RECOMMEND' | 'HOT' | 'DISTANCE'
export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'RECOMMEND', label: '推荐' },
  { key: 'HOT', label: '热度' },
  { key: 'DISTANCE', label: '距离' }
]

export type Geo = { lat: number; lng: number }

/** 两点间的球面距离（公里） */
export function distanceKm(a: Geo, p: PlaceView) {
  if (p.latitude == null || p.longitude == null) return Infinity
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(p.latitude - a.lat), dLng = rad(p.longitude - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(p.latitude)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}
/** 按设置中心的距离单位显示；英里制下 0.1 mi 以内改用英尺 */
export function formatKm(km: number, unit: 'KM' | 'MI' = 'KM') {
  if (!Number.isFinite(km)) return ''
  if (unit === 'MI') {
    const mi = km * 0.621371
    return mi < 0.1 ? `${Math.round(km * 3280.84)} ft` : `${mi.toFixed(mi < 10 ? 1 : 0)} mi`
  }
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`
}

/** 推荐：编辑精选在前 → 热度 → 原始顺序；热度：加入旅行次数；距离：由近到远 */
export function sortPlaces(list: PlaceView[], sort: SortKey, geo: Geo | null) {
  const rank = (p: PlaceView) => p.editorRank ?? 999
  return [...list].sort((a, b) => {
    if (sort === 'DISTANCE' && geo) return distanceKm(geo, a) - distanceKm(geo, b)
    if (sort === 'HOT') return (b.tripCount ?? 0) - (a.tripCount ?? 0) || rank(a) - rank(b) || a.id - b.id
    return rank(a) - rank(b) || (b.tripCount ?? 0) - (a.tripCount ?? 0) || a.id - b.id
  })
}

/** 建议停留：90 → 1.5 小时 */
export function stayLabel(min?: number) {
  if (!min) return ''
  if (min < 60) return `${min} 分钟`
  const h = min / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} 小时`
}

/** 文字封面的配色：按类别给不同的底色，避免一排都一样 */
export function coverTone(p: PlaceView) {
  const c = p.category ?? ''
  if (['寺院', '神社'].includes(c)) return 'shrine'
  if (['公园', '海滨'].includes(c)) return 'green'
  if (['博物馆', '文化'].includes(c)) return 'museum'
  if (['市场'].includes(c) || p.tags?.includes('FOOD')) return 'food'
  if (p.tags?.includes('NIGHT')) return 'night'
  return 'sand'
}

export const currentSeason = (d = new Date()) => ['冬', '冬', '春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬'][d.getMonth()]

/** 轻量信息卡：只从真实数据里推导，数据不足的卡片不出现 */
export type InfoCard = { key: string; title: string; hint: string; filter?: string; places: { place: PlaceView; note?: string }[]; action?: 'locate' }

export function infoCards(places: PlaceView[], geo: Geo | null, geoDenied: boolean, unit: 'KM' | 'MI' = 'KM'): InfoCard[] {
  const byRank = sortPlaces(places, 'RECOMMEND', null)
  const pick = (f: (p: PlaceView) => boolean) => byRank.filter(f).slice(0, 3).map(place => ({ place }))
  const cards: InfoCard[] = []
  if (geo) {
    const near = [...places].sort((a, b) => distanceKm(geo, a) - distanceKm(geo, b)).slice(0, 3)
    cards.push({ key: 'NEAR', title: '离你最近', hint: '按你当前的位置计算', places: near.map(place => ({ place, note: formatKm(distanceKm(geo, place), unit) })) })
  } else if (!geoDenied) {
    cards.push({ key: 'NEAR', title: '离你最近', hint: '开启定位后，按你所在的位置推荐附近的地点。', places: [], action: 'locate' })
  }
  const hot = [...places].filter(p => (p.tripCount ?? 0) > 0).sort((a, b) => (b.tripCount ?? 0) - (a.tripCount ?? 0)).slice(0, 3)
  if (hot.length) cards.push({ key: 'HOT', title: '最多人加入旅行', hint: '按旅迹用户加入旅行的次数', filter: 'HOT', places: hot.map(place => ({ place, note: `${place.tripCount} 段旅行` })) })
  const free = places.filter(p => p.tags?.includes('FREE'))
  if (free.length) cards.push({ key: 'FREE', title: '免费也能玩', hint: `${free.length} 个地点不需要门票`, filter: 'FREE', places: pick(p => Boolean(p.tags?.includes('FREE'))) })
  const rain = places.filter(p => p.tags?.includes('RAIN'))
  if (rain.length) cards.push({ key: 'RAIN', title: '下雨天也适合', hint: `${rain.length} 个以室内为主的去处`, filter: 'RAIN', places: pick(p => Boolean(p.tags?.includes('RAIN'))) })
  const evening = byRank.filter(p => /傍晚|日落|夜/.test(p.bestTime ?? ''))
  if (evening.length) cards.push({ key: 'EVENING', title: '最适合傍晚前往', hint: '日落前后到达，看城市点灯', filter: 'NIGHT', places: evening.slice(0, 3).map(place => ({ place, note: place.bestTime })) })
  const first = places.filter(p => p.tags?.includes('FIRST'))
  if (first.length) cards.push({ key: 'FIRST', title: '适合第一次来东京', hint: '经典又不容易踩雷', filter: 'FIRST', places: pick(p => Boolean(p.tags?.includes('FIRST'))) })
  return cards
}

export type ListItem = { kind: 'place'; place: PlaceView } | { kind: 'route'; route: OfficialRouteView } | { kind: 'info'; info: InfoCard }

/**
 * 「全部地点」的混排节奏：3 张标准卡 → 专题横幅 → 2 张标准卡 + 信息卡 → 3 张标准卡 → 信息卡 + 2 张标准卡 → 循环。
 * 专题或信息卡用完后，对应位置直接换成地点卡。
 */
export function mixedList(places: PlaceView[], routes: OfficialRouteView[], infos: InfoCard[]): ListItem[] {
  const pattern = ['p', 'p', 'p', 'r', 'p', 'p', 'i', 'p', 'p', 'p', 'i', 'p', 'p']
  const items: ListItem[] = []
  let pi = 0, ri = 0, ii = 0, step = 0
  while (pi < places.length) {
    const slot = pattern[step % pattern.length]
    step++
    if (slot === 'r') { if (ri < routes.length) items.push({ kind: 'route', route: routes[ri++] }); continue }
    if (slot === 'i' && ii < infos.length) { items.push({ kind: 'info', info: infos[ii++] }); continue }
    items.push({ kind: 'place', place: places[pi++] })
  }
  return items
}
