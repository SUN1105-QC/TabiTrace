import type { PlaceView } from '@/services/tabitrace-api'
import type { CheckinExportRecord } from './checkin-export'

export type CheckinMapPoint = { number: number; id: number; name: string; date: string; lat: number; lng: number }
const valid = (lat: unknown, lng: unknown): lat is number => typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

/** 使用真实打卡坐标；缺失时与地图页一样回退到关联地点，保留完整记录编号。 */
export function checkinMapPoints(records: CheckinExportRecord[], places: PlaceView[] = []): CheckinMapPoint[] {
  const byId = new Map(places.map(p => [p.id, p]))
  return records.flatMap(({ checkin: c, date }, i) => {
    const place = c.placeId != null ? byId.get(c.placeId) : undefined
    const coords = valid(c.latitude, c.longitude) ? { lat: c.latitude!, lng: c.longitude! }
      : valid(place?.latitude, place?.longitude) ? { lat: place!.latitude!, lng: place!.longitude! } : null
    return coords ? [{ number: i + 1, id: c.id, name: c.placeName, date, ...coords }] : []
  })
}

const clampLat = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat))
const mercatorY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + clampLat(lat) * Math.PI / 360)) / Math.PI) / 2

/** 取跨日期变更线时的最小经度跨度，避免 179° / -179° 被画成环绕地球。 */
export function longitudeRange(points: Pick<CheckinMapPoint, 'lng'>[]) {
  const values = points.map(p => (p.lng + 360) % 360).sort((a, b) => a - b)
  if (!values.length) return { west: 0, east: 0 }
  let gap = -1, start = 0
  for (let i = 0; i < values.length; i++) {
    const next = i + 1 < values.length ? values[i + 1] : values[0] + 360
    if (next - values[i] > gap) { gap = next - values[i]; start = (i + 1) % values.length }
  }
  const west = values[start], east = west + 360 - gap
  const shift = Math.floor(((west + east) / 2 + 180) / 360) * 360
  return { west: west - shift, east: east - shift }
}

export function checkinMapViewport(points: CheckinMapPoint[], width: number, height: number, padding = 84) {
  if (!points.length) throw new Error('没有可定位的打卡记录')
  const { west, east } = longitudeRange(points)
  const centerLng = (west + east) / 2
  const ys = points.map(p => mercatorY(p.lat))
  const minY = Math.min(...ys), maxY = Math.max(...ys), centerY = (minY + maxY) / 2
  const scale = Math.min((width - 2 * padding) / Math.max((east - west) / 360, 1e-10), (height - 2 * padding) / Math.max(maxY - minY, 1e-10), 512 * 2 ** 14)
  const centerLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * centerY))) * 180 / Math.PI
  return {
    center: [centerLng, centerLat] as [number, number], zoom: Math.log2(scale / 512),
    project: (p: Pick<CheckinMapPoint, 'lat' | 'lng'>) => {
      const lng = p.lng + Math.round((centerLng - p.lng) / 360) * 360
      return { x: width / 2 + (lng - centerLng) / 360 * scale, y: height / 2 + (mercatorY(p.lat) - centerY) * scale }
    }
  }
}

/** 跨天或中间缺少坐标时不连线，不推测缺失的行进路线。 */
export function checkinMapSegments(points: CheckinMapPoint[]) {
  return points.slice(1).flatMap((point, i) => point.date === points[i].date && point.number === points[i].number + 1 ? [[points[i], point] as const] : [])
}
