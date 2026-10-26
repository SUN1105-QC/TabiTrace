/**
 * 统一的日期时间工具：活动流、通知、日历、分享成果共用。
 * 所有“显示给用户的时间”都按用户偏好的时区（runtimePrefs().timeZone）与语言换算，
 * 不使用设备本地时区——与后端按用户时区把打卡、照片归到“当地的哪一天”保持一致。
 * 后端存储 UTC；不带时区后缀的时间按 UTC 解析。
 */

import { runtimePrefs } from '@/lib/preferences'

export function toDate(value?: string | null): Date | null {
  if (!value) return null
  const raw = /Z|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

const partsCache = new Map<string, Intl.DateTimeFormat>()
/** 某个时刻在指定时区里的年月日时分（数字） */
export function zonedParts(date: Date, timeZone = runtimePrefs().timeZone) {
  let fmt = partsCache.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
    partsCache.set(timeZone, fmt)
  }
  const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value])) as Record<string, string>
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute }
}

/** 用户时区里的日历日，格式 YYYY-MM-DD */
export function localDateKey(date: Date): string {
  const p = zonedParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

export function dateKeyOf(value?: string | null): string | null {
  const d = toDate(value)
  return d ? localDateKey(d) : null
}

/** YYYY.MM.DD（用户时区） */
export function formatDate(date: Date): string {
  const p = zonedParts(date)
  return `${p.year}.${pad(p.month)}.${pad(p.day)}`
}

/** YYYY.MM.DD HH:mm（用户时区） */
export function formatDateTime(date: Date | string | null | undefined): string {
  const d = typeof date === 'string' || date == null ? toDate(date as string | null | undefined) : date
  if (!d) return ''
  const p = zonedParts(d)
  return `${p.year}.${pad(p.month)}.${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`
}

/** HH:mm；兼容后端返回的 HH:mm:ss（计划时间本身就是当地时间，原样截取） */
export function hhmm(value?: string | null): string {
  if (!value) return ''
  return value.slice(0, 5)
}

/** 某个时刻在用户时区里的 HH:mm */
export function timeOfDay(value?: string | Date | null): string {
  const d = value instanceof Date ? value : toDate(value)
  if (!d) return ''
  const p = zonedParts(d)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** 用户时区里的当前小时 */
export const hourNow = (now = new Date()) => zonedParts(now).hour

/** 刚刚 / 5 分钟前 / 昨天 / 3 天前 / 具体日期（按用户语言） */
export function relativeTime(value?: string | null, now = new Date()): string {
  const date = toDate(value)
  if (!date) return ''
  const diff = now.getTime() - date.getTime()
  if (diff < 0) return formatDateTime(date)
  const { locale } = runtimePrefs()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const min = Math.floor(diff / 60000)
  if (min < 1) return rtf.format(0, 'second')
  if (min < 60) return rtf.format(-min, 'minute')
  const hours = Math.floor(min / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 8) return rtf.format(-days, 'day')
  return formatDate(date)
}

export type GreetingKey = 'late' | 'morning' | 'afternoon' | 'evening'
export function greetingKey(now = new Date()): GreetingKey {
  const h = hourNow(now)
  return h < 5 ? 'late' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
}
const GREETINGS: Record<string, Record<GreetingKey, string>> = {
  'zh-CN': { late: '夜深了', morning: '上午好', afternoon: '下午好', evening: '晚上好' },
  'en-US': { late: 'Good night', morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
  'ja-JP': { late: 'こんばんは', morning: 'おはようございます', afternoon: 'こんにちは', evening: 'こんばんは' }
}
/** 按用户时区与语言的问候语 */
export function greeting(now = new Date()): string {
  return (GREETINGS[runtimePrefs().locale] ?? GREETINGS['zh-CN'])[greetingKey(now)]
}

/** 某个时区在指定时刻的 UTC 偏移（分钟） */
function zoneOffsetMinutes(timeZone: string, at: Date) {
  const p = zonedParts(at, timeZone)
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(at.getTime() / 60000) * 60000) / 60000)
}

/**
 * 把“用户时区里的 date + HH:mm”组合成带偏移的 ISO 字符串（后端要求 OffsetDateTime）。
 * 例如时区 Asia/Tokyo：2026-10-03 + 10:00 → 2026-10-03T10:00:00+09:00（与设备所在时区无关）
 */
export function offsetIso(date: string, time: string, timeZone = runtimePrefs().timeZone): string {
  const hm = (time || '12:00').slice(0, 5)
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = hm.split(':').map(Number)
  const wallUtc = Date.UTC(y, mo - 1, d, h, mi)
  // 先按“墙上时间当作 UTC”求一次偏移，再用修正后的时刻求一次（处理夏令时边界）
  let offset = zoneOffsetMinutes(timeZone, new Date(wallUtc))
  offset = zoneOffsetMinutes(timeZone, new Date(wallUtc - offset * 60000))
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `${date}T${hm}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** 用户时区里“现在”的日期与时间（快速打卡等表单的默认值） */
export function nowInUserZone(now = new Date()) {
  const p = zonedParts(now)
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` }
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10))
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10))
  return Math.round((b - a) / 86400000)
}
