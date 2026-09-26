/** 旅行回忆中心的展示文案与日期工具。 */

import type { Flashback, TimelineEntry } from '@/services/memories'

export const dot = (iso?: string | null) => (iso ? iso.slice(0, 10).replace(/-/g, '.') : '')

/** 2026.09.21 — 2026.09.26；同一年时第二个日期省略年份 */
export function dateRange(start: string, end: string) {
  if (!end || start === end) return dot(start)
  return start.slice(0, 4) === end.slice(0, 4) ? `${dot(start)} — ${dot(end).slice(5)}` : `${dot(start)} — ${dot(end)}`
}

const NUM = ['', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十']
const yearsWord = (n: number) => (n === 1 ? '一年前' : `${NUM[n] ?? n} 年前`)
const SEASON = ['春', '夏', '秋', '冬']
const seasonOf = (m: number) => (m === 12 || m <= 2 ? 3 : m <= 5 ? 0 : m <= 8 ? 1 : 2)

/** 往年今日的标题：「一年前的今天，你在大阪。」/「去年这个月…」/「往年的秋天…」 */
export function flashbackHeadline(f: Flashback, today = new Date()) {
  const where = `你在${f.city}。`
  if (f.kind === 'DAY') return `${yearsWord(f.yearsAgo)}的今天，${where}`
  if (f.kind === 'MONTH') return `${f.yearsAgo === 1 ? '去年' : yearsWord(f.yearsAgo)}这个月，${where}`
  return `${f.yearsAgo === 1 ? '去年' : yearsWord(f.yearsAgo)}的${SEASON[seasonOf(today.getMonth() + 1)]}天，${where}`
}

export const flashbackKicker = (f: Flashback) => (f.kind === 'DAY' ? 'ON THIS DAY' : f.kind === 'MONTH' ? 'THIS MONTH, YEARS AGO' : 'THIS SEASON, YEARS AGO')

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export type TimelineYear = { year: string; months: { month: string; trips: TimelineEntry[] }[] }

/** 按年份、月份（出发月）分组，都从近到远 */
export function groupTimeline(entries: TimelineEntry[]): TimelineYear[] {
  const years: TimelineYear[] = []
  for (const e of entries) {
    const year = e.startDate.slice(0, 4)
    const month = MONTHS[Number(e.startDate.slice(5, 7)) - 1] ?? ''
    let y = years.find(x => x.year === year)
    if (!y) { y = { year, months: [] }; years.push(y) }
    let m = y.months.find(x => x.month === month)
    if (!m) { m = { month, trips: [] }; y.months.push(m) }
    m.trips.push(e)
  }
  return years
}

/** 6 天 · 12 个地点 · 11 张照片 · 7 个成就（为 0 的项不显示） */
export function statLine(t: { days: number; places: number; photos: number; achievements: number }) {
  return [
    t.days ? `${t.days} 天` : '',
    t.places ? `${t.places} 个地点` : '',
    t.photos ? `${t.photos} 张照片` : '',
    t.achievements ? `${t.achievements} 个成就` : ''
  ].filter(Boolean).join(' · ')
}

export const statusLabel = (s: string) => (s === 'ARCHIVED' ? '已归档' : '已完成')
