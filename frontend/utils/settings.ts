/**
 * 设置中心的纯逻辑：Tab 定义、可编辑草稿、脏状态比较与前端校验。
 * 后端会再校验一遍（UserService），这里的规则与后端保持一致。
 */

import type { DistanceUnit, UserSettingsInput, UserView } from '@/services/tabitrace-api'
import { formatCurrency } from '@/utils/currency'

export type SettingsTab = 'profile' | 'preferences' | 'privacy' | 'notifications' | 'security' | 'pro'

export const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: 'profile', label: '个人资料' },
  { key: 'preferences', label: '旅行偏好' },
  { key: 'privacy', label: '隐私与分享' },
  { key: 'notifications', label: '通知' },
  { key: 'security', label: '账户与安全' },
  { key: 'pro', label: 'Trip Pro' }
]

export const isSettingsTab = (v: string | null): v is SettingsTab => SETTINGS_TABS.some(t => t.key === v)

export const NICKNAME_MAX = 30
export const BIO_MAX = 120
export const PASSWORD_MIN = 8

/** 手动保存的字段（个人资料 / 旅行偏好 / 隐私）；通知开关即时保存，不在草稿里 */
export type SettingsDraft = {
  nickname: string
  bio: string
  locale: string
  timezone: string
  distanceUnit: DistanceUnit
  shareExactLocation: boolean
  shareLinkExpiryDays: number
}

export const DRAFT_KEYS = ['nickname', 'bio', 'locale', 'timezone', 'distanceUnit', 'shareExactLocation', 'shareLinkExpiryDays'] as const

export function draftFromUser(u: UserView): SettingsDraft {
  return {
    nickname: u.nickname ?? '',
    bio: u.bio ?? '',
    locale: u.locale || 'zh-CN',
    timezone: u.timezone || 'Asia/Tokyo',
    distanceUnit: u.distanceUnit === 'MI' ? 'MI' : 'KM',
    shareExactLocation: Boolean(u.shareExactLocation),
    shareLinkExpiryDays: u.shareLinkExpiryDays ?? 0
  }
}

/** 逐字段比较（字段都是原始值），只返回改动过的字段 */
export function changedFields(initial: SettingsDraft, draft: SettingsDraft): (typeof DRAFT_KEYS)[number][] {
  return DRAFT_KEYS.filter(k => initial[k] !== draft[k])
}

/** 只提交改动过的字段；文本在提交前 trim */
export function buildPayload(initial: SettingsDraft, draft: SettingsDraft): UserSettingsInput {
  const payload: Record<string, unknown> = {}
  for (const k of changedFields(initial, draft)) {
    const v = draft[k]
    payload[k] = typeof v === 'string' ? v.trim() : v
  }
  return payload as UserSettingsInput
}

const length = (s: string) => Array.from(s).length

export type FieldErrors = Partial<Record<'nickname' | 'bio' | 'timezone', string>>

export function validateDraft(d: SettingsDraft): FieldErrors {
  const errors: FieldErrors = {}
  const nick = d.nickname.trim()
  if (!nick) errors.nickname = '昵称不能为空'
  else if (length(nick) > NICKNAME_MAX) errors.nickname = `昵称最多 ${NICKNAME_MAX} 个字`
  if (length(d.bio.trim()) > BIO_MAX) errors.bio = `个人简介最多 ${BIO_MAX} 个字`
  return errors
}

/** 后端错误码 → 对应字段，让服务端错误也能显示在字段旁 */
export function fieldOfError(code?: string | null): keyof FieldErrors | null {
  if (code === 'INVALID_NICKNAME') return 'nickname'
  if (code === 'INVALID_BIO') return 'bio'
  if (code === 'INVALID_TIMEZONE') return 'timezone'
  return null
}

/** Tab 属于哪些草稿字段：切换 Tab 时只关心当前 Tab 的未保存修改 */
export const TAB_FIELDS: Partial<Record<SettingsTab, readonly (typeof DRAFT_KEYS)[number][]>> = {
  profile: ['nickname', 'bio'],
  preferences: ['locale', 'timezone', 'distanceUnit'],
  privacy: ['shareExactLocation', 'shareLinkExpiryDays']
}

export const LOCALES: [string, string][] = [['zh-CN', '简体中文'], ['ja-JP', '日本語'], ['en-US', 'English']]

/** 常用旅行时区；用户已保存的值或当前设备时区不在列表里时会被补进来 */
export const COMMON_TIMEZONES: [string, string][] = [
  ['Asia/Tokyo', '东京 · 日本'],
  ['Asia/Shanghai', '北京 / 上海 · 中国'],
  ['Asia/Hong_Kong', '香港'],
  ['Asia/Taipei', '台北'],
  ['Asia/Seoul', '首尔 · 韩国'],
  ['Asia/Singapore', '新加坡'],
  ['Asia/Bangkok', '曼谷 · 泰国'],
  ['Europe/London', '伦敦 · 英国'],
  ['Europe/Paris', '巴黎 · 法国'],
  ['America/New_York', '纽约 · 美国东部'],
  ['America/Los_Angeles', '洛杉矶 · 美国西部'],
  ['Australia/Sydney', '悉尼 · 澳大利亚'],
  ['UTC', 'UTC 协调世界时']
]

export function deviceTimezone(): string | null {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null } catch { return null }
}

export function timezoneOptions(current: string): [string, string][] {
  const list = [...COMMON_TIMEZONES]
  const device = deviceTimezone()
  if (device && !list.some(([v]) => v === device)) list.unshift([device, `${device}（当前设备）`])
  if (current && !list.some(([v]) => v === current)) list.unshift([current, current])
  return list
}

export const SHARE_EXPIRY_OPTIONS: [number, string][] = [[0, '长期有效'], [7, '7 天后失效'], [30, '30 天后失效']]

/** 2026-09-19T09:28:54 → 2026.09.19 */
export const dotDate = (iso?: string | null) => (iso ? iso.slice(0, 10).replace(/-/g, '.') : '')

export function joinedLabel(iso?: string | null) {
  if (!iso) return ''
  const [y, m] = iso.slice(0, 7).split('-')
  return `${y} 年 ${Number(m)} 月加入`
}

/** 金额显示统一走 utils/currency.formatCurrency */
export const formatMoney = formatCurrency

/** 会话时间（后端为 UTC 本地时间字符串）→ 相对描述 */
export function sessionTime(iso: string) {
  const t = Date.parse(iso.endsWith('Z') ? iso : iso + 'Z')
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  const min = Math.round(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} 天前`
  return dotDate(new Date(t).toISOString())
}
