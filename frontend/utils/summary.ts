/**
 * 旅行总结页的纯逻辑：规则生成的总结文案、旅程亮点、默认选中的日期。
 * 只使用真实统计（天数、地点、照片、有记录的天数、目的地），不推测心情、天气、评价等用户没有提供的信息。
 */

import type { TripSummary, TripView } from '@/services/tabitrace-api'
import { dayTitle } from '@/utils/travel-map'

export type DailyRecord = TripSummary['dailyRecords'][number]

/** 例如：“这次东京旅行一共 6 天，记录了 5 个地点，留下 12 张照片，其中 3 天留下了旅行记录。” */
export function summarySentence(trip: Pick<TripView, 'destinationName'>, s: TripSummary): string {
  const where = trip.destinationName ? `这次${trip.destinationName}旅行` : '这次旅行'
  const recorded = s.readiness.recordedDays ?? s.dailyRecords.filter(d => d.hasRecord).length
  if (s.places === 0 && s.photos === 0) return `${where}一共 ${s.days} 天，还没有留下打卡或照片。`
  const parts = [`${where}一共 ${s.days} 天`]
  if (s.places > 0) parts.push(`记录了 ${s.places} 个地点`)
  if (s.photos > 0) parts.push(`留下 ${s.photos} 张照片`)
  const tail = recorded >= s.days ? '每一天都留下了旅行记录' : recorded > 0 ? `其中 ${recorded} 天留下了旅行记录` : '还没有哪一天留下打卡或照片记录'
  return `${parts.join('，')}，${tail}。`
}

export type Highlight = { key: string; label: string; value: string; date?: string }

/** 旅程亮点：没有对应数据的行不显示 */
export function journeyHighlights(s: TripSummary): Highlight[] {
  const rows: Highlight[] = []
  const busiest = pickMax(s.dailyRecords, d => d.checkins)
  if (busiest) rows.push({ key: 'busiest', label: '最充实的一天', value: `${shortDay(busiest.date)} · ${busiest.checkins} 次打卡`, date: busiest.date })
  const photoDay = pickMax(s.dailyRecords, d => d.photos)
  if (photoDay) rows.push({ key: 'photos', label: '照片最多', value: `${shortDay(photoDay.date)} · ${photoDay.photos} 张`, date: photoDay.date })
  return rows
}

/** 取数值最大的一天（大于 0；相同时取更早的一天） */
function pickMax(days: DailyRecord[], value: (d: DailyRecord) => number) {
  let best: DailyRecord | null = null
  for (const d of days) if (value(d) > 0 && (!best || value(d) > value(best))) best = d
  return best
}

/** “10月3日” */
export const shortDay = (date: string) => dayTitle(date).split(' ')[0]

/** 默认打开第一天有记录的日期；都没有记录时打开第一天 */
export function defaultSummaryDay(days: DailyRecord[]) {
  return days.find(d => d.hasRecord)?.date ?? days[0]?.date ?? ''
}

/** 探索度只对有官方地点库的城市有意义 */
export const hasExploreGuide = (s: TripSummary) => s.officialPlacesTotal > 0
