/**
 * 分享长图的数据整理：全部由真实旅行数据推导，不编造内容。
 * 没有数据的项（如天气）直接不显示，而不是填占位文字。
 */

import type { AchievementView, CheckinView, PhotoView, TimelineDay, TripSummary, TripView } from '@/services/tabitrace-api'
import { toDate } from '@/lib/time'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 常见旅行城市的英文名，用于封面与结尾的英文点缀；不在表里的直接用原名 */
const CITY_EN: Record<string, string> = {
  东京: 'Tokyo', 大阪: 'Osaka', 京都: 'Kyoto', 奈良: 'Nara', 札幌: 'Sapporo', 福冈: 'Fukuoka', 冲绳: 'Okinawa', 横滨: 'Yokohama',
  首尔: 'Seoul', 釜山: 'Busan', 济州: 'Jeju', 上海: 'Shanghai', 北京: 'Beijing', 香港: 'Hong Kong', 台北: 'Taipei',
  曼谷: 'Bangkok', 新加坡: 'Singapore', 巴黎: 'Paris', 伦敦: 'London', 纽约: 'New York', 罗马: 'Rome'
}

const COUNTRY: Record<string, [string, string]> = {
  JP: ['日本', 'Japan'], KR: ['韩国', 'Korea'], CN: ['中国', 'China'], TH: ['泰国', 'Thailand'], SG: ['新加坡', 'Singapore'],
  US: ['美国', 'United States'], FR: ['法国', 'France'], GB: ['英国', 'United Kingdom'], IT: ['意大利', 'Italy']
}

export const cityOf = (trip: TripView) => trip.city?.trim() || trip.destinationName

export function placeLabel(trip: TripView) {
  const country = trip.countryCode ? COUNTRY[trip.countryCode.toUpperCase()]?.[0] : undefined
  const city = cityOf(trip)
  return country && country !== city ? `${city} · ${country}` : city
}

export function placeLabelEn(trip: TripView) {
  const city = CITY_EN[cityOf(trip)] ?? cityOf(trip)
  const country = trip.countryCode ? COUNTRY[trip.countryCode.toUpperCase()]?.[1] : undefined
  return country && country !== city ? `${city}, ${country}` : city
}

export const cityEn = (trip: TripView) => CITY_EN[cityOf(trip)] ?? cityOf(trip)

export const dotDate = (iso: string) => iso.replace(/-/g, '.')

export function weekdayOf(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : WEEKDAYS[d.getDay()]
}

export function daysNights(days: number) {
  return days <= 1 ? '1 天' : `${days} 天 ${days - 1} 晚`
}

/** 封面主图：精选照片优先，其次任意照片，最后才用旅行封面（封面图常带有文字，放在最后） */
export function coverPhoto(trip: TripView, photos: PhotoView[]) {
  return photos.find(p => p.featured)?.imageUrl ?? photos[0]?.imageUrl ?? trip.coverImage ?? undefined
}

/** 旅途剪影：精选在前，不足时用其余照片补齐 */
export function galleryPhotos(photos: PhotoView[], count: number) {
  const featured = photos.filter(p => p.featured)
  const rest = photos.filter(p => !p.featured)
  return [...featured, ...rest].slice(0, count)
}

const localHour = (c: CheckinView) => toDate(c.checkinTime)?.getHours()

/** 旅途关键词：去过的街区、代表地点、成就、同行方式、出行时段。按出现顺序去重，最多 8 个。 */
export function journeyKeywords(trip: TripView, timeline: TimelineDay[], achievements: AchievementView[]) {
  const checkins = timeline.flatMap(d => d.items.map(i => i.checkin))
  const words: string[] = []
  const add = (w?: string | null) => { const v = w?.trim(); if (v && !words.includes(v)) words.push(v) }

  checkins.map(c => c.area).filter(Boolean).slice(0, 12).forEach(a => { if (words.length < 3) add(a) })
  checkins.forEach(c => { if (words.length < 6) add(c.placeName) })
  add(trip.peopleCount <= 1 ? '一个人旅行' : `${trip.peopleCount} 人同行`)
  if (checkins.some(c => (localHour(c) ?? 12) >= 19)) add('夜晚漫步')
  if (checkins.some(c => (localHour(c) ?? 12) < 9)) add('清晨出发')
  achievements.filter(a => a.earned).forEach(a => { if (words.length < 8) add(a.name) })
  return words.slice(0, 8)
}

/** 这趟旅程的一段概述：只用统计与地名拼成，不做主观描述 */
export function journeySummary(trip: TripView, summary: TripSummary, timeline: TimelineDay[]) {
  const areas = Array.from(new Set(timeline.flatMap(d => d.items.map(i => i.checkin.area)).filter(Boolean))) as string[]
  const where = areas.length ? `走过${areas.slice(0, 4).join('、')}${areas.length > 4 ? '等地' : ''}` : `在${cityOf(trip)}`
  return `${summary.days} 天里，${where}，打卡 ${summary.places} 个地点，留下 ${summary.photos} 张照片。`
}

/** 结尾引言：优先用旅行者自己写的最后一句打卡文字（连同写下它的地点），没有才用品牌语 */
export function closingQuote(timeline: TimelineDay[]): { text: string; place?: string } {
  const noted = timeline.flatMap(d => d.items).filter(i => i.checkin.note?.trim()).map(i => i.checkin)
  const last = noted[noted.length - 1]
  return last ? { text: last.note!.trim(), place: last.placeName } : { text: '旅行会结束，旅迹会留下来。' }
}
