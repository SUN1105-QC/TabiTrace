/** 同一标签页的旅行切换通知：storage 事件只会通知其他标签页，不能同步当前页的页头。 */
export const ACTIVE_TRIP_KEY = 'tabitrace-live-trip-id'
export const ACTIVE_TRIP_CHANGED = 'tabitrace:active-trip-changed'

/** 只在当前账号返回的列表中解析记忆值，避免浏览列表时覆盖用户已选的旅行。 */
export function resolveActiveTrip<T extends { id: number; status: string }>(trips: T[], remembered: number | null): T | null {
  return trips.find(trip => trip.id === remembered) ?? trips.find(trip => trip.status !== 'ARCHIVED') ?? trips[0] ?? null
}

export function rememberActiveTrip(id: number) {
  if (typeof window === 'undefined') return
  const value = String(id)
  if (localStorage.getItem(ACTIVE_TRIP_KEY) === value) return
  localStorage.setItem(ACTIVE_TRIP_KEY, value)
  window.dispatchEvent(new Event(ACTIVE_TRIP_CHANGED))
}
