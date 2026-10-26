/**
 * Mock 数据的固定 ID。接口契约里的 ID 都是数字（页面路由 /trips/[id] 也按数字解析），
 * 所以用 9xxxxx 号段而不是 'mock-trip-tokyo-001' 这类字符串；注释里保留可读名称。
 * 号段按实体分开，任何一个 ID 都能看出它属于哪类 Mock 数据。
 */
export const MOCK_USER_ID = 900000

/** mock-trip-tokyo-001：进行中、Trip Pro */
export const MOCK_TRIP_TOKYO = 900001
/** mock-trip-kyoto-001：已归档（旅行回忆）、免费版 */
export const MOCK_TRIP_KYOTO = 900002
/** mock-trip-hokkaido-001：计划中、提前升级了 Trip Pro，只有行程没有打卡 */
export const MOCK_TRIP_HOKKAIDO = 900003

export const ID_BASE = {
  place: 910000,
  itinerary: 915000,
  checkin: 920000,
  photo: 930000,
  video: 940000,
  share: 950000,
  payment: 960000,
  session: 970000
} as const
