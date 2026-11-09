/** 同一标签页的旅行切换通知：storage 事件只会通知其他标签页，不能同步当前页的页头。 */
export const ACTIVE_TRIP_KEY = 'tabitrace-live-trip-id'
export const ACTIVE_TRIP_CHANGED = 'tabitrace:active-trip-changed'

export function rememberActiveTrip(id: number) {
  if (typeof window === 'undefined') return
  const value = String(id)
  if (localStorage.getItem(ACTIVE_TRIP_KEY) === value) return
  localStorage.setItem(ACTIVE_TRIP_KEY, value)
  window.dispatchEvent(new Event(ACTIVE_TRIP_CHANGED))
}
