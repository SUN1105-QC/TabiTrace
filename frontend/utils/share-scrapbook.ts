/**
 * 九宫格 ·「旅行手帐」格式的排版数据：照片卡的位置（slot）预设、主图选择、按照片横竖自动排版。
 * 只决定「怎么摆」，照片本身仍来自九宫格素材选择（gridPhotos），编号 01~09 始终按用户的选择顺序。
 * 所有位置与旋转都是固定预设：同样的照片每次预览、导出都完全一致。
 */

import type { PhotoView, TripView } from '@/services/tabitrace-api'
import { isCoverPhoto } from '@/utils/photo-variants'
import { cityEn, cityOf } from '@/utils/share-long'
import { materialOf, type GridPlace } from '@/utils/share-grid'

/** 手帐画布（3:4），导出时按页面统一的 pixelRatio 放大 */
export const SB_WIDTH = 1080
export const SB_HEIGHT = 1440
/** 照片卡排布区（标题区之下、品牌区之上），各数量的预设会在这个区域里垂直居中 */
export const SB_AREA = { top: 318, bottom: 1286 }
/** 照片纸边：左右与顶部留白，底部是地点标签区 */
export const SB_PAD = 12
export const SB_LABEL = 66
export const SB_HERO_LABEL = 78
export const SB_MAX_PHOTOS = 9

/** 一张照片卡的位置：x / y / w 为卡片外框（px），ph 为照片区高度，rot 为固定旋转角度，z 为层级 */
export type ScrapSlot = { x: number; y: number; w: number; ph: number; rot: number; z: number; hero?: boolean }

const S = (x: number, y: number, w: number, ph: number, rot: number, z: number, hero = false): ScrapSlot => ({ x, y, w, ph, rot, z, hero })

/**
 * 1~9 张照片各自的预设，第一个永远是主图（面积约为普通卡的 2 倍）。
 * 九张：主图居中，左右上角、左右中间各一张，底部一排四张错落。照片少时用更大的卡片，不留空位。
 */
const PRESETS: Record<number, ScrapSlot[]> = {
  1: [S(170, 0, 740, 760, -1, 5, true)],
  2: [S(40, 0, 600, 640, -1.2, 5, true), S(660, 250, 380, 300, 2.6, 4)],
  3: [S(40, 0, 580, 620, -1, 5, true), S(668, 30, 372, 250, 2.4, 4), S(660, 400, 380, 256, -2.2, 4)],
  4: [S(36, 0, 560, 600, -1, 5, true), S(632, 0, 400, 196, 2.4, 4), S(640, 300, 396, 196, -2, 4), S(628, 600, 404, 196, 1.6, 4)],
  5: [S(330, 60, 420, 600, -1, 6, true), S(30, 10, 300, 290, -3, 3), S(750, 0, 300, 290, 2.5, 3), S(40, 410, 300, 330, 2, 4), S(740, 400, 300, 330, -2, 4)],
  6: [S(318, 0, 444, 440, -1, 7, true), S(36, 12, 278, 220, -3, 3), S(766, 4, 278, 220, 2.5, 3), S(28, 324, 286, 210, 2, 4), S(766, 316, 286, 210, -2, 4), S(330, 628, 420, 236, 1.5, 6)],
  7: [S(318, 0, 444, 440, -1, 7, true), S(36, 12, 278, 220, -3, 3), S(766, 4, 278, 220, 2.5, 3), S(28, 324, 286, 210, 2, 4), S(766, 316, 286, 210, -2, 4), S(120, 636, 380, 230, -2, 5), S(580, 624, 380, 230, 2.2, 6)],
  8: [S(318, 0, 444, 440, -1, 7, true), S(36, 12, 278, 220, -3, 3), S(766, 4, 278, 220, 2.5, 3), S(28, 324, 286, 210, 2, 4), S(766, 316, 286, 210, -2, 4), S(40, 640, 320, 210, -2.5, 5), S(380, 624, 320, 210, 1.5, 6), S(720, 638, 320, 210, 2.5, 5)],
  9: [S(318, 0, 444, 440, -1, 7, true), S(36, 12, 278, 220, -3, 3), S(766, 4, 278, 220, 2.5, 3), S(28, 324, 286, 210, 2, 4), S(766, 316, 286, 210, -2, 4), S(30, 644, 256, 196, -2.5, 5), S(282, 624, 256, 196, 1.5, 6), S(538, 640, 256, 196, -1, 5), S(794, 626, 256, 196, 3, 6)]
}

export const slotHeight = (s: ScrapSlot) => SB_PAD + s.ph + (s.hero ? SB_HERO_LABEL : SB_LABEL)

/** n 张照片的卡片位置：取对应预设，整体在排布区里垂直居中 */
export function scrapSlots(n: number): ScrapSlot[] {
  const preset = PRESETS[Math.max(1, Math.min(SB_MAX_PHOTOS, n))]
  const bottom = Math.max(...preset.map(s => s.y + slotHeight(s)))
  const offset = SB_AREA.top + Math.max(0, Math.round((SB_AREA.bottom - SB_AREA.top - bottom) / 2))
  return preset.map(s => ({ ...s, y: s.y + offset }))
}

/**
 * 主图：用户点过「设为主图」的照片 → 旅行封面照片 → 第一张精选 → 选择顺序里的第一张。
 * 只在当前这几张里挑，不会随机，也不会改动用户的选择顺序。
 */
export function scrapCover(picked: PhotoView[], trip: Pick<TripView, 'coverImage'>, coverPhotoId?: number) {
  return picked.find(p => p.id === coverPhotoId)
    ?? picked.find(p => isCoverPhoto(trip.coverImage, p))
    ?? picked.find(p => p.featured)
    ?? picked[0]
}

const aspectOf = (p: PhotoView) => (p.width && p.height ? p.width / p.height : null)
const slotAspect = (s: ScrapSlot) => (s.w - SB_PAD * 2) / s.ph

/** 一张照片放进卡片后的位置：photo 为照片，no 为它在选择顺序里的编号（1 起） */
export type ScrapPlacement = { slot: ScrapSlot; photo: PhotoView; no: number }

/**
 * 把照片放进卡片：主图进主卡；其余照片
 * - auto：按横竖比例匹配卡片形状（横图优先进横向的大卡，竖图进窄卡），不知道尺寸的照片按选择顺序；
 * - order：按选择顺序依次放入。
 * 两种方式都是确定的，同样的输入永远得到同样的版式。
 */
export function scrapPlacements(picked: PhotoView[], cover: PhotoView | undefined, layout: 'auto' | 'order' = 'auto'): ScrapPlacement[] {
  if (!picked.length || !cover) return []
  const slots = scrapSlots(picked.length)
  const no = (p: PhotoView) => picked.indexOf(p) + 1
  const rest = picked.filter(p => p !== cover)
  const others = slots.slice(1)
  const placed: ScrapPlacement[] = [{ slot: slots[0], photo: cover, no: no(cover) }]
  if (layout === 'order' || rest.every(p => aspectOf(p) == null)) {
    rest.forEach((p, i) => placed.push({ slot: others[i], photo: p, no: no(p) }))
    return placed
  }
  // 贪心匹配：所有「照片 × 卡片」按形状差距从小到大，依次放入（差距相同按选择顺序、卡片顺序）
  const pairs: { p: number; s: number; cost: number }[] = []
  rest.forEach((p, pi) => others.forEach((s, si) => {
    const a = aspectOf(p)
    pairs.push({ p: pi, s: si, cost: a == null ? 0.5 : Math.abs(Math.log(a / slotAspect(s))) })
  }))
  pairs.sort((a, b) => a.cost - b.cost || a.p - b.p || a.s - b.s)
  const usedP = new Set<number>()
  const usedS = new Set<number>()
  const map = new Map<number, number>()
  for (const pair of pairs) {
    if (usedP.has(pair.p) || usedS.has(pair.s)) continue
    usedP.add(pair.p); usedS.add(pair.s); map.set(pair.s, pair.p)
  }
  others.forEach((s, si) => {
    const p = rest[map.get(si) ?? si]
    if (p) placed.push({ slot: s, photo: p, no: no(p) })
  })
  return placed
}

/** 照片卡的地点标签：地点名（关联打卡）、城市 · 区域、日期 · 时间；没有的字段不显示 */
export type ScrapLabel = { place: string | null; area: string | null; when: string }

export function scrapLabel(photo: PhotoView, places: Map<number, GridPlace>, trip: TripView): ScrapLabel {
  const m = materialOf(photo, places, trip)
  const linked = photo.checkinId != null ? places.get(photo.checkinId) : undefined
  const city = cityOf(trip)?.trim() || ''
  const area = linked?.checkin.area?.trim() || ''
  const sub = !area ? city : !city || area === city || area.startsWith(city) ? area : `${city} · ${area}`
  const when = [m.date ? m.date.slice(5).replace('-', '.') : '', m.time].filter(Boolean).join(' · ')
  return { place: m.placeName, area: sub || null, when }
}

/** 标题区的英文辅助行：有英文城市名时用「KYOTO TRAVEL」，没有时不重复显示中文 */
export function scrapEnglish(trip: TripView) {
  const en = cityEn(trip)
  return en !== cityOf(trip) ? `${en.toUpperCase()} TRAVEL` : 'TRAVEL SCRAPBOOK'
}

/** 邮戳上的城市：只用英文名（中文城市名放进环形小字容易挤），没有英文名时写 TRAVEL */
export function scrapStampCity(trip: TripView) {
  const en = cityEn(trip)
  return en !== cityOf(trip) ? en.toUpperCase() : 'TRAVEL'
}

/** 这几张照片来自几个不同的地点（按打卡地点名去重） */
export function scrapPlaceCount(picked: PhotoView[], places: Map<number, GridPlace>) {
  return new Set(picked.map(p => (p.checkinId != null ? places.get(p.checkinId)?.checkin.placeName : undefined)).filter(Boolean)).size
}

/** 标题按字数缩放，长标题不会撞到右上角的邮戳 */
export function scrapTitleSize(title: string) {
  const len = Array.from(title).length
  if (len <= 6) return 60
  if (len <= 9) return 52
  if (len <= 13) return 44
  return 36
}
