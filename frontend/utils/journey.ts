/**
 * 创建旅行（Journey Setup）的纯逻辑：时长计算、日期区间格式、表单校验与时区显示。
 * 规则与后端 CreateTripRequest / TripService 保持一致（人数 1–100、结束日不早于开始日）。
 */

import type { DestinationView, OfficialGuide } from '@/services/tabitrace-api'

export const TRAVELERS_MIN = 1
/** 与后端 @Max(100) 一致 */
export const TRAVELERS_MAX = 100

/** 选中的目的地：来自目的地库，或用户直接使用输入的名称（custom） */
export type PickedDestination = {
  name: string
  nameEn?: string
  countryCode?: string
  countryName?: string
  timezone?: string
  coverImage?: string | null
  official?: OfficialGuide | null
  custom: boolean
}

export const fromDestination = (d: DestinationView): PickedDestination => ({
  name: d.name, nameEn: d.nameEn, countryCode: d.countryCode, countryName: d.countryName,
  timezone: d.timezone, coverImage: d.coverImage, official: d.official, custom: false
})

export const customDestination = (name: string): PickedDestination => ({ name: name.trim(), custom: true, official: null })

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 严格解析 YYYY-MM-DD，拒绝 2026-02-30 这类不存在的日期；返回 UTC 零点的时间戳 */
export function parseDay(s?: string | null): number | null {
  const m = s ? DATE.exec(s) : null
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = Date.UTC(y, mo - 1, d)
  const back = new Date(t)
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t : null
}

export type TripDuration =
  | { ok: true; days: number; nights: number; label: string }
  | { ok: false; error: 'missing' | 'invalid' | 'order' }

/** 旅行天数 / 晚数：包含首尾两天；按 UTC 日期计算，跨月、跨年、夏令时都不受影响 */
export function calculateTripDuration(start?: string | null, end?: string | null): TripDuration {
  if (!start || !end) return { ok: false, error: 'missing' }
  const a = parseDay(start), b = parseDay(end)
  if (a === null || b === null) return { ok: false, error: 'invalid' }
  if (b < a) return { ok: false, error: 'order' }
  const days = Math.round((b - a) / 86400000) + 1
  const nights = days - 1
  return { ok: true, days, nights, label: nights === 0 ? '1 天 · 当天往返' : `${days} 天 ${nights} 晚` }
}

/** 2026.10.01 — 10.06；跨年时两端都带年份；同一天只显示一个日期 */
export function formatTripDateRange(start?: string | null, end?: string | null) {
  if (!parseDay(start) || !parseDay(end)) return ''
  const [s, e] = [start!.replace(/-/g, '.'), end!.replace(/-/g, '.')]
  if (s === e) return s
  return s.slice(0, 4) === e.slice(0, 4) ? `${s} — ${e.slice(5)}` : `${s} — ${e}`
}

export type JourneyForm = { title: string; destination: PickedDestination | null; startDate: string; endDate: string; travelers: number }
export type JourneyErrors = Partial<Record<'title' | 'destination' | 'startDate' | 'endDate' | 'travelers', string>>

export function validateJourney(f: JourneyForm): JourneyErrors {
  const e: JourneyErrors = {}
  if (!f.title.trim()) e.title = '请给这段旅行起个名字'
  else if (f.title.trim().length > 200) e.title = '旅行名称最多 200 个字'
  if (!f.destination?.name.trim()) e.destination = '请选择或输入目的地'
  const d = calculateTripDuration(f.startDate, f.endDate)
  if (!f.startDate) e.startDate = '请选择出发日期'
  else if (!parseDay(f.startDate)) e.startDate = '出发日期无效'
  if (!f.endDate) e.endDate = '请选择返回日期'
  else if (!parseDay(f.endDate)) e.endDate = '返回日期无效'
  else if (!d.ok && d.error === 'order') e.endDate = '返回日期不能早于出发日期'
  if (!Number.isInteger(f.travelers) || f.travelers < TRAVELERS_MIN || f.travelers > TRAVELERS_MAX) e.travelers = `同行人数为 ${TRAVELERS_MIN}–${TRAVELERS_MAX} 人`
  return e
}

/** 本地日期（不是 UTC），用于默认出发日 */
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function addDays(day: string, n: number) {
  const t = parseDay(day)
  if (t === null) return day
  return new Date(t + n * 86400000).toISOString().slice(0, 10)
}

/** 目的地当前的 UTC 偏移，例如 GMT+9；不支持时返回空串 */
export function timezoneOffsetLabel(tz?: string, now = new Date()) {
  if (!tz) return ''
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName')
    return part?.value ?? ''
  } catch { return '' }
}

export const suggestedTitle = (d: PickedDestination | null) => (d?.name ? `我的${d.name}旅行` : '')
