'use client'

/**
 * 推荐探索的数据：每类数据只请求一次，页面各模块从这里派生。
 * - 官方地点、专题路线分开请求：专题失败只隐藏「旅行灵感」，地点失败显示可重试的错误，互不拖垮
 * - 登录后：旅行列表（决定加入到哪段旅行）、该旅行已加入的地点与已打卡的地点、收藏、距离单位
 * 加入状态来自后端（旅行的地点列表），刷新后仍然保持；收藏走后端 place_favorites，不用 localStorage 模拟。
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { hasSession } from '@/services/api'
import { tripApi, userApi, type DistanceUnit, type OfficialRouteView, type PlaceView, type TripView } from '@/services/tabitrace-api'

const LIVE_TRIP_KEY = 'tabitrace-live-trip-id'
const noSubscribe = () => () => {}
type Load<T> = { data: T; loading: boolean; error: string }
const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** 加入到哪段旅行：本机记住的旅行（未归档）→ 今天正在进行的唯一一段 → 只有一段可写的旅行；都不满足时让用户选 */
function resolveTarget(trips: TripView[]) {
  const open = trips.filter(t => t.status !== 'ARCHIVED')
  const stored = Number(localStorage.getItem(LIVE_TRIP_KEY) || 0)
  const current = open.filter(t => t.startDate <= today() && today() <= t.endDate)
  return open.find(t => t.id === stored) ?? (current.length === 1 ? current[0] : null) ?? (open.length === 1 ? open[0] : null)
}

/** onPlacesLoaded：地点首次载入后调用一次（页面用它处理 #place-id、?filter= 等链接参数） */
export function useExploreData(cityCode = 'TOKYO', onPlacesLoaded?: (places: PlaceView[]) => void) {
  const onLoaded = useRef(onPlacesLoaded)
  useEffect(() => { onLoaded.current = onPlacesLoaded })
  const [places, setPlaces] = useState<Load<PlaceView[]>>({ data: [], loading: true, error: '' })
  const [routes, setRoutes] = useState<Load<OfficialRouteView[]>>({ data: [], loading: true, error: '' })
  // 服务端渲染时视为未登录，挂载后读取本机会话标记，不会造成水合不一致
  const signedIn = useSyncExternalStore(noSubscribe, hasSession, () => false)
  const [trips, setTrips] = useState<TripView[]>([])
  const [target, setTarget] = useState<TripView | null>(null)
  const [joined, setJoined] = useState<Set<number>>(new Set())
  const [checkedIn, setCheckedIn] = useState<Set<number>>(new Set())
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<Set<number>>(new Set())
  const [unit, setUnit] = useState<DistanceUnit>('KM')

  /** 请求并写入结果（只在 promise 回调里设置状态） */
  const fetchPlaces = useCallback(() => tripApi.officialPlaces(cityCode)
    .then(data => { setPlaces({ data, loading: false, error: '' }); onLoaded.current?.(data); onLoaded.current = undefined })
    .catch(e => setPlaces({ data: [], loading: false, error: errMsg(e, '地点加载失败') })), [cityCode])

  /** 「重新加载」：先显示骨架屏再请求 */
  const reloadPlaces = useCallback(() => {
    setPlaces(s => ({ ...s, loading: true, error: '' }))
    void fetchPlaces()
  }, [fetchPlaces])

  /** 目标旅行的加入 / 打卡状态 */
  const fetchTripStatus = useCallback((trip: TripView | null) => (trip
    ? Promise.all([tripApi.places(trip.id).catch(() => []), tripApi.checkins(trip.id).catch(() => [])])
    : Promise.resolve([[], []] as const)
  ).then(([ps, cs]) => {
    setJoined(new Set(ps.filter(p => p.sourceType === 'OFFICIAL').map(p => p.id)))
    setCheckedIn(new Set(cs.map(c => c.placeId).filter((id): id is number => id != null)))
  }), [])

  useEffect(() => {
    void fetchPlaces()
    tripApi.officialRoutes(cityCode)
      .then(data => setRoutes({ data, loading: false, error: '' }))
      .catch(e => setRoutes({ data: [], loading: false, error: errMsg(e, '旅行灵感加载失败') }))
    if (!hasSession()) return
    void Promise.all([
      tripApi.list().catch(() => [] as TripView[]),
      tripApi.favoritePlaces().catch(() => [] as number[]),
      userApi.me().catch(() => null)
    ]).then(([list, favs, me]) => {
      setTrips(list)
      setFavorites(new Set(favs))
      if (me) setUnit(me.distanceUnit === 'MI' ? 'MI' : 'KM')
      const t = resolveTarget(list)
      setTarget(t)
      return fetchTripStatus(t)
    })
  }, [cityCode, fetchPlaces, fetchTripStatus])

  /** 用户在选择框里换了旅行：记住它（与其他页面共用当前旅行），并刷新加入 / 打卡状态 */
  const chooseTarget = useCallback(async (trip: TripView) => {
    localStorage.setItem(LIVE_TRIP_KEY, String(trip.id))
    setTarget(trip)
    await fetchTripStatus(trip)
  }, [fetchTripStatus])

  /** 加入旅行：成功或「已加入」都记为已加入；返回是否成功 */
  const addToTrip = useCallback(async (trip: TripView, place: PlaceView): Promise<{ ok: boolean; message?: string }> => {
    setBusy(b => new Set(b).add(place.id))
    try {
      await tripApi.addOfficial(trip.id, place.id)
      setJoined(j => new Set(j).add(place.id))
      return { ok: true }
    } catch (e) {
      const message = errMsg(e, '加入失败，请稍后重试')
      if (message.includes('已加入')) { setJoined(j => new Set(j).add(place.id)); return { ok: true } }
      return { ok: false, message }
    } finally {
      setBusy(b => { const n = new Set(b); n.delete(place.id); return n })
    }
  }, [])

  /** 收藏：先改界面，失败时撤回 */
  const toggleFavorite = useCallback(async (place: PlaceView): Promise<{ ok: boolean; on: boolean; message?: string }> => {
    const on = !favorites.has(place.id)
    setFavorites(f => { const n = new Set(f); if (on) n.add(place.id); else n.delete(place.id); return n })
    try { await tripApi.setFavorite(place.id, on); return { ok: true, on } }
    catch (e) {
      setFavorites(f => { const n = new Set(f); if (on) n.delete(place.id); else n.add(place.id); return n })
      return { ok: false, on, message: errMsg(e, '收藏失败') }
    }
  }, [favorites])

  const writableTrips = useMemo(() => trips.filter(t => t.status !== 'ARCHIVED'), [trips])

  return {
    places, routes, signedIn, writableTrips, target, joined, checkedIn, favorites, busy, unit,
    reloadPlaces, chooseTarget, addToTrip, toggleFavorite
  }
}

export type ExploreData = ReturnType<typeof useExploreData>
