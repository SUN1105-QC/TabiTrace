/**
 * 设置中心的纯逻辑：Tab 定义、可编辑草稿、脏状态比较与前端校验。
 * 后端会再校验一遍（UserService），这里的规则与后端保持一致。
 */

import type { DistanceUnit, UserSettingsInput, UserView } from '@/services/tabitrace-api'
import { formatCurrency } from '@/utils/currency'
import { relativeTime } from '@/lib/time'
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, SUPPORTED_LOCALES, deviceTimeZone } from '@/lib/preferences'
import { LOCALE_NAMES, type MessageKey, type TFunction } from '@/i18n'

export type SettingsTab = 'profile' | 'preferences' | 'privacy' | 'notifications' | 'security' | 'pro'

export const SETTINGS_TABS: { key: SettingsTab; label: MessageKey }[] = [
  { key: 'profile', label: 'settings.tabs.profile' },
  { key: 'preferences', label: 'settings.tabs.preferences' },
  { key: 'privacy', label: 'settings.tabs.privacy' },
  { key: 'notifications', label: 'settings.tabs.notifications' },
  { key: 'security', label: 'settings.tabs.security' },
  { key: 'pro', label: 'settings.tabs.pro' }
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
    locale: u.locale || DEFAULT_LOCALE,
    timezone: u.timezone || DEFAULT_TIMEZONE,
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

export function validateDraft(d: SettingsDraft, t: TFunction): FieldErrors {
  const errors: FieldErrors = {}
  const nick = d.nickname.trim()
  if (!nick) errors.nickname = t('settings.profile.nicknameRequired')
  else if (length(nick) > NICKNAME_MAX) errors.nickname = t('settings.profile.nicknameTooLong', { max: NICKNAME_MAX })
  if (length(d.bio.trim()) > BIO_MAX) errors.bio = t('settings.profile.bioTooLong', { max: BIO_MAX })
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

/** 语言选项：名称用各自的语言书写，不随界面语言变化 */
export const LOCALES: [string, string][] = SUPPORTED_LOCALES.map(l => [l, LOCALE_NAMES[l]])

/** 常用旅行时区；用户已保存的值或当前设备时区不在列表里时会被补进来 */
export const COMMON_TIMEZONES = ['Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Seoul', 'Asia/Singapore', 'Asia/Bangkok', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'] as const

export const deviceTimezone = deviceTimeZone

/** 常用时区（名称随界面语言）；用户已保存的值或当前设备时区不在列表里时补进来 */
export function timezoneOptions(current: string, t: TFunction): [string, string][] {
  const list: [string, string][] = COMMON_TIMEZONES.map(z => [z, t(`settings.zones.${z}` as MessageKey)])
  const device = deviceTimeZone()
  if (device && !list.some(([v]) => v === device)) list.unshift([device, t('settings.prefs.deviceZone', { zone: device })])
  if (current && !list.some(([v]) => v === current)) list.unshift([current, current])
  return list
}

export const SHARE_EXPIRY_OPTIONS: [number, MessageKey][] = [[0, 'settings.privacy.expiryForever'], [7, 'settings.privacy.expiry7'], [30, 'settings.privacy.expiry30']]

/** 2026-09-19T09:28:54 → 2026.09.19 */
export const dotDate = (iso?: string | null) => (iso ? iso.slice(0, 10).replace(/-/g, '.') : '')

export function joinedLabel(iso: string | null | undefined, t: TFunction) {
  if (!iso) return ''
  const [y, m] = iso.slice(0, 7).split('-')
  return t('settings.summary.joined', { year: y, month: Number(m) })
}

/** 金额显示统一走 utils/currency.formatCurrency */
export const formatMoney = formatCurrency

/** 会话时间（后端为 UTC 时间字符串）→ 按界面语言的相对描述（统一走 lib/time.relativeTime） */
export const sessionTime = (iso: string) => relativeTime(iso)
