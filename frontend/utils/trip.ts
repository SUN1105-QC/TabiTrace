/**
 * 旅行详情的共享逻辑：状态文案、生命周期主操作、成果准备度、元数据与时间格式。
 * 所有阈值集中在 READINESS_CONFIG，页面里不再各自判断。
 */

import type { RecentRecord, TripSummary, TripView } from '@/services/tabitrace-api'

export type TripStatus = 'PLANNING' | 'ONGOING' | 'COMPLETED' | 'ARCHIVED'

const STATUS_TEXT: Record<TripStatus, string> = { PLANNING: '计划中', ONGOING: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档' }

/** 状态统一由这里转成中文；未知状态原样显示英文，避免出现 undefined */
export function formatTripStatus(status?: string | null): { label: string; code: string } {
  const code = (status || '').toUpperCase()
  return { label: STATUS_TEXT[code as TripStatus] ?? (code || '未知'), code }
}

export const isArchived = (trip: Pick<TripView, 'status'>) => trip.status === 'ARCHIVED'

/** 主操作 / 次操作：随旅行生命周期变化。checkin 表示打开全局快速打卡 */
export type TripAction = { key: string; label: string } & ({ kind: 'checkin' } | { kind: 'link'; href: string })

export function getTripPrimaryAction(trip: Pick<TripView, 'id' | 'status'>): { primary: TripAction; secondary: TripAction[] } {
  const base = `/trips/${trip.id}`
  const checkin: TripAction = { key: 'checkin', label: '快速打卡', kind: 'checkin' }
  const record: TripAction = { key: 'record', label: '继续记录', kind: 'link', href: `${base}/map` }
  const photos: TripAction = { key: 'photos', label: '上传照片', kind: 'link', href: `${base}/gallery` }
  const timeline: TripAction = { key: 'timeline', label: '回看时间轴', kind: 'link', href: `${base}/map` }
  switch (trip.status) {
    case 'PLANNING':
      return { primary: { key: 'plan', label: '完善行程', kind: 'link', href: `${base}/map` }, secondary: [checkin, photos] }
    case 'COMPLETED':
      return { primary: { key: 'share', label: '生成旅行成果', kind: 'link', href: `${base}/share` }, secondary: [timeline, { key: 'story', label: 'Travel Story', kind: 'link', href: `${base}/video` }] }
    case 'ARCHIVED':
      // 已归档的旅行不能再打卡或修改（后端 requireWritable），只提供回看
      return { primary: { key: 'review', label: '回看旅程', kind: 'link', href: `${base}/summary` }, secondary: [timeline] }
    default:
      return { primary: checkin, secondary: [record, photos] }
  }
}

/**
 * 成果准备度的全部阈值。storyMinPhotos 与后端 SummaryService 的 videoReady 条件一致
 * （至少 3 张照片且有打卡）；精选照片目标用于分享海报 / 九宫格的挑选。
 */
export const READINESS_CONFIG = {
  featuredPhotoTarget: 3,
  storyMinPhotos: 3
} as const

export type ReadinessItem = { key: string; done: boolean; ratio: number; text: string; href?: string }
export type TravelReadiness = { percent: number; ready: boolean; items: ReadinessItem[] }

/**
 * 成果准备度 = 四项的平均完成度：
 * 有记录的天数 / 旅行天数、精选照片 / 目标、Travel Story 条件（后端 videoReady）、旅行是否已结束。
 */
export function calculateTravelReadiness(trip: Pick<TripView, 'id' | 'status'>, s: TripSummary): TravelReadiness {
  const { featuredPhotoTarget, storyMinPhotos } = READINESS_CONFIG
  const days = Math.max(1, s.days || 1)
  const recorded = Math.min(days, s.readiness.recordedDays || 0)
  const featured = s.readiness.featuredPhotos || 0
  const finished = trip.status === 'COMPLETED' || trip.status === 'ARCHIVED'
  const storyRatio = s.readiness.videoReady ? 1 : Math.min(1, ((s.photos || 0) / storyMinPhotos) * 0.8 + (s.places > 0 ? 0.2 : 0))
  const items: ReadinessItem[] = [
    {
      key: 'days', done: recorded >= days, ratio: recorded / days,
      text: recorded >= days ? `${days} 天都有旅行记录` : recorded > 0 ? `${recorded} / ${days} 天有旅行记录` : '还没有任何一天的记录'
    },
    {
      key: 'featured', done: featured >= featuredPhotoTarget, ratio: Math.min(1, featured / featuredPhotoTarget),
      text: featured >= featuredPhotoTarget ? `${featured} 张精选照片` : `还差 ${featuredPhotoTarget - featured} 张精选照片`
    },
    {
      key: 'story', done: s.readiness.videoReady, ratio: storyRatio, href: `/trips/${trip.id}/video`,
      text: s.readiness.videoReady ? 'Travel Story 可生成'
        : s.places === 0 ? '完成一次打卡后可生成 Travel Story'
        : `再上传 ${Math.max(0, storyMinPhotos - s.photos)} 张照片即可生成 Travel Story`
    },
    { key: 'finish', done: finished, ratio: finished ? 1 : 0, text: finished ? '旅行已完成' : '旅行结束后标记完成' }
  ]
  const percent = Math.round((items.reduce((sum, i) => sum + i.ratio, 0) / items.length) * 100)
  return { percent, ready: s.readiness.videoReady, items }
}

/** 没有描述字段时，只用真实元数据描述这趟旅行 */
export function tripMetaLine(trip: TripView, s: TripSummary | null) {
  const days = s?.days ?? dayCount(trip.startDate, trip.endDate)
  const parts = [trip.destinationName, days > 1 ? `${days} 天 ${days - 1} 晚` : `${days} 天`]
  if (s) parts.push(`${s.places} 个地点`)
  if (trip.peopleCount > 1) parts.push(`${trip.peopleCount} 人同行`)
  return parts.filter(Boolean).join(' · ')
}

export function dayCount(start: string, end: string) {
  const a = Date.parse(start), b = Date.parse(end)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(1, Math.round((b - a) / 86400000) + 1) : 1
}

/** 2026-09-21 → 2026.09.21 */
export const dotDate = (d?: string | null) => (d ? d.slice(0, 10).replace(/-/g, '.') : '')

/**
 * 记录时间：后端已按用户时区给出带偏移的时间，这里直接取其中的当地日期和时刻，
 * 只和“今天 / 昨天”比较时用设备日期。
 */
export function recordTime(iso: string, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return ''
  const [, y, mo, d, h, mi] = m
  const key = `${y}-${mo}-${d}`
  const today = localKey(now)
  const yesterday = localKey(new Date(now.getTime() - 86400000))
  const day = key === today ? '今天' : key === yesterday ? '昨天' : y === String(now.getFullYear()) ? `${Number(mo)}月${Number(d)}日` : `${y}.${mo}.${d}`
  return `${day} ${h}:${mi}`
}

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function recordDetail(r: RecentRecord) {
  if (r.kind === 'PHOTOS') return `上传了 ${r.photoCount} 张照片`
  // 后端目前只有 MANUAL 一种打卡类型
  return r.photoCount > 0 ? `打卡 · ${r.photoCount} 张照片` : '打卡'
}
