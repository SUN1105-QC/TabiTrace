/** 统一的相对时间与日期工具：活动流、通知、日历共用，避免各处重复实现。 */

export function toDate(value?: string | null): Date | null {
  if (!value) return null
  const raw = /Z|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 刚刚 / 5分钟前 / 2小时前 / 昨天 / 3天前 / 具体日期 */
export function relativeTime(value?: string | null, now = new Date()): string {
  const date = toDate(value)
  if (!date) return ''
  const diff = now.getTime() - date.getTime()
  if (diff < 0) return formatDateTime(date)
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨天'
  if (days < 8) return `${days}天前`
  return formatDate(date)
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 本地日历日，格式 YYYY-MM-DD（不做 UTC 转换，日历与旅行日期都是本地日历日） */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function dateKeyOf(value?: string | null): string | null {
  const d = toDate(value)
  return d ? localDateKey(d) : null
}

/** HH:mm；兼容后端返回的 HH:mm:ss */
export function hhmm(value?: string | null): string {
  if (!value) return ''
  return value.slice(0, 5)
}

export function timeOfDay(value?: string | null): string {
  const d = toDate(value)
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : ''
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return '夜深了'
  if (h < 12) return '上午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

/** 把 date + HH:mm 组合成带本地时区偏移的 ISO 字符串（后端要求 OffsetDateTime） */
export function offsetIso(date: string, time: string): string {
  const hm = (time || '12:00').slice(0, 5)
  const raw = `${date}T${hm}:00`
  const mins = -new Date(raw).getTimezoneOffset()
  const sign = mins >= 0 ? '+' : '-'
  const abs = Math.abs(mins)
  return `${raw}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`)
  const b = new Date(`${toIso}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
