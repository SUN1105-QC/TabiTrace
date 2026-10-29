/** 旅行回忆中心接口（与 backend MemoryDtos 一一对应）。只统计已完成 / 已归档的旅行。 */

import { api } from './api'
import { photoSrcSet } from '@/utils/photo-variants'

export type MemoryOverview = { archivedTrips: number; cities: number; photos: number; creations: number }
/** imageUrl 为默认显示地址；thumbUrl / mediumUrl / originalUrl 与宽高用于 srcset */
export type Moment = { id: number; imageUrl: string; thumbUrl?: string | null; mediumUrl?: string | null; originalUrl?: string | null; width?: number | null; height?: number | null }

export type MemoryTrip = {
  id: number
  title: string
  destinationName: string
  city: string
  countryCode?: string | null
  status: 'COMPLETED' | 'ARCHIVED' | string
  startDate: string
  endDate: string
  days: number
  places: number
  photos: number
  /** trip.coverImage → 第一张精选照片 → 第一张照片；都没有时为空，显示文字封面 */
  cover?: string | null
  moments: Moment[]
  moreMoments: number
  /** 这段旅行里自己写下的最后一句打卡文字 */
  note?: { text: string; place?: string | null } | null
  stories: number
  latestStoryId?: number | null
  shareLinks: number
}

export type TimelineEntry = { id: number; title: string; city: string; startDate: string; endDate: string; cover?: string | null }

export type Creation = {
  type: 'STORY' | 'SHARE_LINK'
  id: number
  tripId: number
  tripTitle: string
  title?: string | null
  preview?: string | null
  url: string
  createdAt?: string | null
  duration?: number | null
  views?: number | null
}

export type MemoryPhoto = { id: number; tripId: number; tripTitle: string; imageUrl: string; thumbUrl?: string | null; mediumUrl?: string | null; originalUrl?: string | null; width?: number | null; height?: number | null; featured: boolean; takenAt?: string | null }

export type Flashback = {
  kind: 'DAY' | 'MONTH' | 'SEASON'
  yearsAgo: number
  tripId: number
  title: string
  city: string
  startDate: string
  endDate: string
  cover?: string | null
  photos: number
  moments: Moment[]
}

export type MemoriesView = {
  overview: MemoryOverview
  trips: MemoryTrip[]
  hasMore: boolean
  timeline: TimelineEntry[]
  creations: Creation[]
  photos: MemoryPhoto[]
  /** 照片区是否来自今年的旅行（0 表示今年还没有，照片取自往年） */
  photoYear: number
  flashback?: Flashback | null
}

export const memoryApi = {
  memories: (limit = 6) => api<MemoriesView>(`/me/memories?limit=${limit}`),
  trips: (offset: number, limit = 6) => api<{ trips: MemoryTrip[]; hasMore: boolean }>(`/me/memories/trips?offset=${offset}&limit=${limit}`)
}

/** 回忆照片的 srcset（原图 + 各档） */
export const memorySrcSet = (m: Moment | MemoryPhoto) =>
  photoSrcSet({ imageUrl: m.originalUrl ?? m.imageUrl, thumbUrl: m.thumbUrl, mediumUrl: m.mediumUrl, width: m.width, height: m.height })
