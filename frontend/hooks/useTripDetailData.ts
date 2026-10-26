'use client'

/**
 * 旅行详情的数据层：桌面和移动布局共用这一份请求（旅行、统计、最近 3 条记录）。
 * 快速打卡完成后（checkinVersion 变化）静默刷新，概览和最近记录随之更新。
 */

import { useCallback, useEffect, useState } from 'react'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'
import { ApiError } from '@/services/api'
import { tripApi, type RecentRecord, type TripSummary, type TripView } from '@/services/tabitrace-api'

export function useTripDetailData(id: number) {
  const { checkinVersion } = useQuickCheckIn()
  const [trip, setTrip] = useState<TripView | null>(null)
  const [summary, setSummary] = useState<TripSummary | null>(null)
  const [recent, setRecent] = useState<RecentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /** 旅行不存在（已删除、不属于当前账号）：与临时的加载失败分开处理，重试没有意义 */
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setError(''); setNotFound(false) }
    try {
      const [t, s, r] = await Promise.all([
        tripApi.get(id),
        tripApi.summary(id),
        // 最近记录只是补充信息，失败时不影响整页
        tripApi.recentRecords(id, 3).catch(() => [] as RecentRecord[])
      ])
      setTrip(t); setSummary(s); setRecent(r); setError('')
      // 只有真正打开了这段旅行，才把它记为“当前旅行”
      localStorage.setItem('tabitrace-live-trip-id', String(id))
    } catch (e) {
      if (!quiet) {
        setNotFound(e instanceof ApiError && e.status === 404)
        setError(e instanceof Error && e.message ? e.message : '请稍后再试')
      }
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [id, load])
  useEffect(() => { if (checkinVersion) void load(true) }, [checkinVersion, load])

  return { trip, setTrip, summary, recent, loading, error, notFound, reload: load }
}
