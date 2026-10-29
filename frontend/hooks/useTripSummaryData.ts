'use client'

/**
 * 旅行总结页的数据（手机与桌面共用，只请求一次）。
 * - 核心：行程 + 总结统计（失败时整页显示错误）
 * - 补充：时间轴（每天的地点）、照片（每天的缩略图）、Travel Story 项目、分享链接、用户时区
 *   任何一项失败只让对应模块隐藏，不影响页面其余部分
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { tripApi, userApi, type PhotoView, type ShareLinkView, type TimelineDay, type TripSummary, type TripView } from '@/services/tabitrace-api'
import { videoApi } from '@/services/video'
import type { VideoProject } from '@/types/video'
import { buildItems, groupByDay, type GalleryItem } from '@/utils/gallery'

export type SummaryData = {
  trip: TripView
  summary: TripSummary
  timeline: TimelineDay[]
  photos: PhotoView[]
  videos: VideoProject[]
  shares: ShareLinkView[]
  timeZone: string
}

/** 后端的时间是不带时区的 UTC 时间 */
const utcTime = (iso: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z').getTime()

const settled = async <T,>(p: Promise<T>, fallback: T) => { try { return await p } catch { return fallback } }

export function useTripSummaryData(tripId: number) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [trip, summary, timeline, photos, videos, shares, me] = await Promise.all([
        tripApi.get(tripId), tripApi.summary(tripId),
        settled(tripApi.timeline(tripId), [] as TimelineDay[]), settled(tripApi.photos(tripId), [] as PhotoView[]),
        settled(videoApi.list(tripId), [] as VideoProject[]),
        settled(tripApi.shares(tripId), [] as ShareLinkView[]), settled(userApi.me(), null)
      ])
      setData({ trip, summary, timeline, photos, videos, shares, timeZone: me?.timezone || 'Asia/Tokyo' })
    } catch (e) {
      setError(e instanceof Error ? e.message : '旅行总结暂时无法加载')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => { void load() }, [load])

  // 每天的地点（时间轴）与照片（与“照片与精选”页相同的日期归属规则）
  const byDay = useMemo(() => {
    const places = new Map<string, { id: number; name: string; area?: string }[]>()
    const photos = new Map<string, GalleryItem[]>()
    if (!data) return { places, photos }
    for (const d of data.timeline) places.set(d.date, d.items.map(i => ({ id: i.checkin.id, name: i.checkin.placeName, area: i.checkin.area })))
    const checkins = data.timeline.flatMap(d => d.items.map(i => i.checkin))
    const days = data.summary.dailyRecords.map(d => d.date)
    for (const g of groupByDay(buildItems(data.photos, checkins, data.trip, data.timeZone), days)) photos.set(g.key, g.items)
    return { places, photos }
  }, [data])

  /** 最近一个已完成的 Travel Story（有成片才算“已生成”） */
  const story = useMemo(() => (data?.videos ?? []).filter(v => v.status === 'COMPLETED' && v.outputUrl).sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt))[0] ?? null, [data])
  /** 仍然有效的公开分享链接（分享成果已经发布过） */
  const activeShare = useMemo(() => (data?.shares ?? []).find(s => s.status === 'ACTIVE' && (!s.expiresAt || utcTime(s.expiresAt) > Date.now())) ?? null, [data])
  const storyCover = useMemo(() => (story?.coverPhotoId ? data?.photos.find(p => p.id === story.coverPhotoId) ?? null : null), [story, data])

  return { data, error, loading, reload: load, byDay, story, storyCover, activeShare }
}
