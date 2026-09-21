'use client'

/** 首页数据聚合：全部来自既有 REST 接口，不新增 Dashboard API，不使用假数据。 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  tripApi, userApi,
  type AchievementView, type CheckinView, type ItineraryView, type PhotoView,
  type PlaceView, type ShareLinkView, type TripSummary, type TripView, type VideoProjectView
} from '@/services/tabitrace-api'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'
import { dateKeyOf, toDate } from '@/lib/time'

export type ActivityKind = 'checkin' | 'photo' | 'itinerary' | 'video' | 'trip' | 'achievement'
export type Activity = { id: string; kind: ActivityKind; title: string; detail: string; at: string | null; href: string; thumbnail?: string }

export type HomeData = {
  user: Awaited<ReturnType<typeof userApi.me>> | null
  trips: TripView[]
  activeTrip: TripView | null
  summaries: Record<number, TripSummary>
  activeSummary: TripSummary | null
  places: PlaceView[]
  checkins: CheckinView[]
  itinerary: ItineraryView[]
  photos: PhotoView[]
  achievements: AchievementView[]
  videos: VideoProjectView[]
  shares: ShareLinkView[]
  stats: { places: number; placesTotal: number; photos: number; achievements: number; trips: number }
  activities: Activity[]
  recommended: PlaceView[]
}

const EMPTY: HomeData = {
  user: null, trips: [], activeTrip: null, summaries: {}, activeSummary: null,
  places: [], checkins: [], itinerary: [], photos: [], achievements: [], videos: [], shares: [],
  stats: { places: 0, placesTotal: 0, photos: 0, achievements: 0, trips: 0 }, activities: [], recommended: []
}

export function useHomeData(enabled: boolean) {
  const { checkinVersion } = useQuickCheckIn()
  const [data, setData] = useState<HomeData>(EMPTY)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    let cancelled = false
    setLoading(true); setError('')

    ;(async () => {
      try {
        const [user, trips] = await Promise.all([userApi.me(), tripApi.list()])
        const stored = Number(localStorage.getItem('tabitrace-live-trip-id') || 0)
        const activeTrip = trips.find(t => t.id === stored && t.status !== 'ARCHIVED')
          || trips.find(t => t.status !== 'ARCHIVED')
          || trips[0] || null
        if (activeTrip) localStorage.setItem('tabitrace-live-trip-id', String(activeTrip.id))

        const summaryPairs = await Promise.all(trips.slice(0, 8).map(async t => {
          try { return [t.id, await tripApi.summary(t.id)] as const } catch { return [t.id, null] as const }
        }))
        const summaries: Record<number, TripSummary> = {}
        summaryPairs.forEach(([id, s]) => { if (s) summaries[id] = s })

        let places: PlaceView[] = [], checkins: CheckinView[] = [], itinerary: ItineraryView[] = []
        let photos: PhotoView[] = [], achievements: AchievementView[] = [], videos: VideoProjectView[] = [], shares: ShareLinkView[] = []
        if (activeTrip) {
          ;[places, checkins, itinerary, photos, achievements, videos, shares] = await Promise.all([
            tripApi.places(activeTrip.id).catch(() => []),
            tripApi.checkins(activeTrip.id).catch(() => []),
            tripApi.itinerary(activeTrip.id).catch(() => []),
            tripApi.photos(activeTrip.id).catch(() => []),
            tripApi.achievements(activeTrip.id).catch(() => []),
            tripApi.videos(activeTrip.id).catch(() => []),
            tripApi.shares(activeTrip.id).catch(() => [])
          ])
        }

        const totals = Object.values(summaries).reduce((acc, s) => ({
          photos: acc.photos + s.photos,
          achievements: acc.achievements + s.achievements
        }), { photos: 0, achievements: 0 })

        const activeSummary = activeTrip ? summaries[activeTrip.id] ?? null : null
        const visitedPlaceIds = new Set(checkins.map(c => c.placeId).filter(Boolean) as number[])

        const activities = buildActivities({ activeTrip, trips, checkins, photos, itinerary, videos, achievements })

        // 推荐探索：官方城市地点库里「还没打卡过」的地点，按商圈去重后取 3 条
        const official = await tripApi.officialPlaces('TOKYO').catch(() => [] as PlaceView[])
        const seenAreas = new Set<string>()
        let recommended = official.filter(p => {
          if (visitedPlaceIds.has(p.id)) return false
          const area = p.area || String(p.id)
          if (seenAreas.has(area)) return false
          seenAreas.add(area)
          return true
        }).slice(0, 3)
        // 全部打卡完时退回到官方地点本身，保证推荐位不会空着
        if (recommended.length === 0) recommended = official.slice(0, 3)

        if (!cancelled) {
          setData({
            user, trips, activeTrip, summaries, activeSummary,
            places, checkins, itinerary, photos, achievements, videos, shares,
            stats: {
              places: activeSummary?.places ?? visitedPlaceIds.size,
              placesTotal: places.length,
              photos: totals.photos,
              achievements: totals.achievements,
              trips: trips.length
            },
            activities,
            recommended
          })
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '首页数据加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [enabled, reloadKey, checkinVersion])

  return useMemo(() => ({ data, loading, error, reload }), [data, loading, error, reload])
}

function buildActivities(input: {
  activeTrip: TripView | null
  trips: TripView[]
  checkins: CheckinView[]
  photos: PhotoView[]
  itinerary: ItineraryView[]
  videos: VideoProjectView[]
  achievements: AchievementView[]
}): Activity[] {
  const { activeTrip, trips, checkins, photos, itinerary, videos, achievements } = input
  const tripId = activeTrip?.id
  const items: Activity[] = []
  const cover = activeTrip?.coverImage || undefined
  const photoOfCheckin = (id: number) => photos.find(p => p.checkinId === id)?.imageUrl
  const newestPhoto = photos[photos.length - 1]?.imageUrl

  checkins.forEach(c => items.push({
    id: `checkin-${c.id}`, kind: 'checkin',
    title: `在${c.placeName}完成打卡`,
    detail: [c.area, c.note].filter(Boolean).join(' · ') || '旅行足迹 +1',
    at: c.createdAt || c.checkinTime,
    href: `/trips/${c.tripId}/map`,
    thumbnail: photoOfCheckin(c.id) || cover
  }))

  // 同一天上传的照片合并成一条，避免刷屏
  const photoByDay = new Map<string, PhotoView[]>()
  photos.forEach(p => {
    const key = dateKeyOf(p.createdAt) || dateKeyOf(p.capturedAt) || 'unknown'
    photoByDay.set(key, [...(photoByDay.get(key) || []), p])
  })
  photoByDay.forEach((list, day) => {
    const latest = list.reduce((a, b) => ((toDate(b.createdAt)?.getTime() || 0) > (toDate(a.createdAt)?.getTime() || 0) ? b : a))
    items.push({
      id: `photo-${day}`, kind: 'photo',
      title: `上传了 ${list.length} 张旅行照片`,
      detail: list.some(p => p.featured) ? '其中包含精选素材' : '旅行相册已更新',
      at: latest.createdAt || latest.capturedAt || null,
      href: tripId ? `/trips/${tripId}/gallery` : '/trips',
      thumbnail: latest.imageUrl
    })
  })

  itinerary.forEach(i => items.push({
    id: `itinerary-${i.id}`, kind: 'itinerary',
    title: `添加了 ${i.plannedDate} 的行程`,
    detail: [i.placeName, i.plannedTime ? i.plannedTime.slice(0, 5) : null].filter(Boolean).join(' · '),
    at: i.createdAt || null,
    href: tripId ? `/trips/${tripId}/map` : '/trips',
    thumbnail: cover
  }))

  videos.forEach(v => items.push({
    id: `video-${v.id}`, kind: 'video',
    title: v.status === 'COMPLETED' ? 'Travel Story 生成完成' : `Travel Story ${v.status}`,
    detail: `${v.templateCode} · ${v.photoIds.length} 张照片`,
    at: v.completedAt || v.createdAt,
    href: tripId ? `/trips/${tripId}/video` : '/trips',
    thumbnail: photos.find(p => p.id === v.photoIds[0])?.imageUrl || newestPhoto || cover
  }))

  achievements.filter(a => a.earned && a.earnedAt).forEach(a => items.push({
    id: `achievement-${a.id}`, kind: 'achievement',
    title: `解锁成就「${a.name}」`,
    detail: a.description || '继续记录可解锁更多成就',
    at: a.earnedAt || null,
    href: tripId ? `/trips/${tripId}/achievements` : '/trips',
    thumbnail: cover
  }))

  trips.forEach(t => items.push({
    id: `trip-${t.id}`, kind: 'trip',
    title: `创建了旅行「${t.title}」`,
    detail: `${t.destinationName} · ${t.startDate} — ${t.endDate}`,
    at: t.createdAt || null,
    href: `/trips/${t.id}`,
    thumbnail: t.coverImage || undefined
  }))

  return items
    .filter(i => i.at)
    .sort((a, b) => (toDate(b.at)?.getTime() || 0) - (toDate(a.at)?.getTime() || 0))
    .slice(0, 8)
}
