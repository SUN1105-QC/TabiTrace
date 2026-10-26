/**
 * 推荐探索（东京）的展示规则：页面只请求一次官方地点，其余全部在这里派生——
 * 分类筛选、搜索、为你推荐、按区域探索、旅行灵感、排序与距离。
 * 地点、区域、专题与热度都来自后端官方内容库，这里不编造数据；
 * 唯一的编辑文案是区域的一句定位（AREA_NOTES），数据里没有的区域不会凭空出现。
 */

import type { OfficialRouteView, PlaceView } from '@/services/tabitrace-api'

// ───────────── 分类 ─────────────

export type CategoryDef = { key: string; label: string; match: (p: PlaceView) => boolean; hidden?: boolean }

const hasTag = (tag: string) => (p: PlaceView) => Boolean(p.tags?.includes(tag))
const inCategory = (...cats: string[]) => (p: PlaceView) => cats.includes(p.category ?? '')

/**
 * 分类胶囊（Hero 与「全部地点」共用这一份）。后端的类别是自由文本、标签是固定枚举，这里统一映射。
 * hidden 的分类不显示胶囊，只用于旧链接（如成就页的 ?filter=NIGHT），选中时以可清除的胶囊出现。
 */
export const CATEGORIES: CategoryDef[] = [
  { key: 'ALL', label: '全部', match: () => true },
  { key: 'SHRINE', label: '寺社', match: inCategory('寺院', '神社') },
  { key: 'CITY', label: '城市', match: inCategory('地标', '城市地标', '观景台', '街区', '商业') },
  { key: 'PARK', label: '公园', match: inCategory('公园', '海滨') },
  { key: 'SHOP', label: '购物', match: hasTag('SHOP') },
  { key: 'FOOD', label: '美食', match: hasTag('FOOD') },
  { key: 'NIGHT', label: '夜景', match: hasTag('NIGHT') },
  { key: 'MUST', label: '必去地标', match: hasTag('MUST'), hidden: true },
  { key: 'FIRST', label: '第一次来东京', match: hasTag('FIRST'), hidden: true },
  { key: 'PHOTO', label: '拍照出片', match: hasTag('PHOTO'), hidden: true },
  { key: 'WALK', label: '城市漫步', match: hasTag('WALK'), hidden: true },
  { key: 'NATURE', label: '自然', match: hasTag('NATURE'), hidden: true },
  { key: 'FREE', label: '免费景点', match: hasTag('FREE'), hidden: true },
  { key: 'RAIN', label: '雨天也适合', match: hasTag('RAIN'), hidden: true },
  { key: 'MUSEUM', label: '展馆', match: inCategory('博物馆', '文化'), hidden: true }
]
export const categoryOf = (key: string) => CATEGORIES.find(c => c.key === key) ?? CATEGORIES[0]

/** 标签的中文名（卡片最多显示 2 个；MUST / FIRST 这类编辑标签在推荐卡上也有意义） */
export const TAG_LABELS: Record<string, string> = {
  CULTURE: '传统文化', PHOTO: '摄影', NIGHT: '夜景', WALK: '散步', FOOD: '美食', SHOP: '购物',
  NATURE: '自然', FREE: '免费', RAIN: '雨天可去', FIRST: '第一次东京', MUST: '必去'
}
/** 卡片上展示的标签：去掉「必去 / 免费 / 雨天」这类不描述地点本身的标签 */
const DESCRIPTIVE = ['CULTURE', 'PHOTO', 'NIGHT', 'WALK', 'FOOD', 'SHOP', 'NATURE']
export const placeTags = (p: PlaceView, max = 2) => (p.tags ?? []).filter(t => DESCRIPTIVE.includes(t)).slice(0, max).map(t => TAG_LABELS[t])

// ───────────── 视图模型 ─────────────

export type PlaceStatus = { joined: Set<number>; checkedIn: Set<number>; favorites: Set<number> }

/** 卡片只依赖这一份精简数据，不直接读原始 DTO 的十几个字段 */
export type ExplorePlace = {
  id: number
  name: string
  area: string
  category: string
  summary: string
  imageUrl?: string
  tags: string[]
  joined: boolean
  checkedIn: boolean
  favorite: boolean
  source: PlaceView
}

export function toExplorePlace(p: PlaceView, s: PlaceStatus): ExplorePlace {
  return {
    id: p.id, name: p.name, area: p.area ?? '东京', category: p.category ?? '地点',
    summary: p.tagline ?? p.description ?? '', imageUrl: p.coverImage, tags: placeTags(p),
    joined: s.joined.has(p.id), checkedIn: s.checkedIn.has(p.id), favorite: s.favorites.has(p.id), source: p
  }
}

/** 推荐卡的一行提示：最佳时间 + 最多 2 个标签（例如「清晨 · 摄影 · 第一次东京」） */
export function recommendLine(p: PlaceView) {
  const time = p.bestTime?.split(/[\/／]/)[0]?.trim()
  const tags = (p.tags ?? []).filter(t => ['PHOTO', 'NIGHT', 'CULTURE', 'FIRST', 'WALK', 'SHOP', 'FOOD'].includes(t)).slice(0, 2).map(t => TAG_LABELS[t])
  return [time, ...tags].filter(Boolean).join(' · ')
}

// ───────────── 搜索 ─────────────

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/** 按地点名、区域、类别、简介、标签与分类名搜索（例如「浅草」「银座」「寺社」「夜景」「公园」） */
export function searchPlaces(list: PlaceView[], query: string) {
  const q = norm(query)
  if (!q) return list
  return list.filter(p => {
    const groups = CATEGORIES.filter(c => c.key !== 'ALL' && c.match(p)).map(c => c.label)
    const text = [p.name, p.area, p.category, p.tagline, ...(p.tags ?? []).map(t => TAG_LABELS[t]), ...groups].filter(Boolean).join('|')
    return norm(text).includes(q)
  })
}

// ───────────── 为你推荐（规则推荐，不随机） ─────────────

/** 推荐时用来保证多样性的大类：传统 / 自然 / 购物美食 / 城市 */
function kindOf(p: PlaceView) {
  const c = p.category ?? ''
  if (['寺院', '神社', '博物馆', '文化'].includes(c)) return 'TRADITION'
  if (['公园', '海滨'].includes(c)) return 'NATURE'
  if (['商业', '市场'].includes(c) || p.tags?.includes('SHOP') || p.tags?.includes('FOOD')) return 'SHOPPING'
  return 'CITY'
}

/** 分数：编辑排序 > 必去 / 第一次来 > 有真实封面 > 热度；已打卡大幅降权 */
function score(p: PlaceView, checkedIn: Set<number>) {
  let s = 0
  if (p.editorRank != null) s += 100 - p.editorRank * 5
  if (p.tags?.includes('MUST')) s += 20
  if (p.tags?.includes('FIRST')) s += 15
  if (p.coverImage) s += 10
  s += Math.min(p.tripCount ?? 0, 10)
  if (checkedIn.has(p.id)) s -= 80
  return s
}

/**
 * 选 n 个推荐地点：优先官方精选、排除已加入当前旅行的地点、已打卡降权；
 * 贪心挑选时区域与大类都不重复（例如 浅草寺 · 东京塔 · 银座），候选不够时再逐步放宽。
 */
export function selectRecommended(places: PlaceView[], status: Pick<PlaceStatus, 'joined' | 'checkedIn'>, n = 3) {
  const ranked = [...places].sort((a, b) => score(b, status.checkedIn) - score(a, status.checkedIn) || a.id - b.id)
  const fresh = ranked.filter(p => !status.joined.has(p.id))
  const pool = fresh.length >= n ? fresh : ranked
  const picked: PlaceView[] = []
  const tryPick = (ok: (p: PlaceView) => boolean) => {
    for (const p of pool) {
      if (picked.length >= n) return
      if (!picked.includes(p) && ok(p)) picked.push(p)
    }
  }
  const usedArea = (p: PlaceView) => picked.some(x => x.area === p.area)
  const usedKind = (p: PlaceView) => picked.some(x => kindOf(x) === kindOf(p))
  tryPick(p => !usedArea(p) && !usedKind(p))
  tryPick(p => !usedArea(p))
  tryPick(() => true)
  return picked
}

// ───────────── 按区域探索 ─────────────

/** 区域的一句定位（编辑文案）。只用于数据里真实存在的区域；没写到的区域按地点类别自动生成 */
const AREA_NOTES: Record<string, string> = {
  浅草: '传统东京', 上野: '博物馆与公园', 银座: '老铺与精致生活', 涩谷: '潮流与夜晚', 新宿: '不夜城与庭园',
  原宿: '森林与潮流', 东京站: '红砖站舍与皇居', 台场: '东京湾的夜景', 秋叶原: '动漫与电器', 港区: '铁塔与新地标'
}

export type AreaView = { name: string; note: string; tags: string[]; count: number; tone: 'sand' | 'green' | 'dusk' | 'peach' }

export function selectAreas(places: PlaceView[]): AreaView[] {
  const groups = new Map<string, PlaceView[]>()
  for (const p of places) if (p.area) groups.set(p.area, [...(groups.get(p.area) ?? []), p])
  return [...groups.entries()]
    .map(([name, list]) => {
      const freq = new Map<string, number>()
      for (const p of list) for (const t of p.tags ?? []) if (DESCRIPTIVE.includes(t)) freq.set(t, (freq.get(t) ?? 0) + 1)
      const tags = [...freq.entries()].sort((a, b) => b[1] - a[1] || DESCRIPTIVE.indexOf(a[0]) - DESCRIPTIVE.indexOf(b[0])).slice(0, 3).map(([t]) => TAG_LABELS[t])
      const kinds = list.map(kindOf)
      const top = ['TRADITION', 'NATURE', 'SHOPPING', 'CITY'].sort((a, b) => kinds.filter(k => k === b).length - kinds.filter(k => k === a).length)[0]
      const night = list.filter(p => p.tags?.includes('NIGHT')).length * 2 > list.length
      const tone: AreaView['tone'] = night ? 'dusk' : top === 'TRADITION' ? 'sand' : top === 'NATURE' ? 'green' : 'peach'
      return { name, note: AREA_NOTES[name] ?? list[0].category ?? '东京街区', tags, count: list.length, tone, first: Math.min(...list.map(p => p.editorRank ?? 99)) }
    })
    // 地点多的区域在前；数量相同时按区域里最靠前的编辑精选排序
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .map(({ first: _first, ...a }) => a)
}

// ───────────── 旅行灵感 ─────────────

export const currentSeason = (d = new Date()) => ['冬', '冬', '春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬'][d.getMonth()]

/** 官方专题路线：当季专题在前，最多 4 条 */
export function selectInspirations(routes: OfficialRouteView[], season = currentSeason(), n = 4) {
  return [...routes].sort((a, b) => Number(b.season === season) - Number(a.season === season)).slice(0, n)
}

// ───────────── 排序与距离 ─────────────

export type SortKey = 'RECOMMEND' | 'HOT' | 'DISTANCE'
export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'RECOMMEND', label: '推荐排序' },
  { key: 'HOT', label: '热门优先' },
  { key: 'DISTANCE', label: '离我最近' }
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

/** 推荐：编辑精选在前 → 热度 → 原始顺序；热门：加入旅行次数；距离：由近到远 */
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

/** 文字封面的配色：按类别给不同的底色 */
export function coverTone(p: PlaceView) {
  const c = p.category ?? ''
  if (['寺院', '神社'].includes(c)) return 'shrine'
  if (['公园', '海滨'].includes(c)) return 'green'
  if (['博物馆', '文化'].includes(c)) return 'museum'
  if (['市场'].includes(c) || p.tags?.includes('FOOD')) return 'food'
  if (p.tags?.includes('NIGHT')) return 'night'
  return 'sand'
}
