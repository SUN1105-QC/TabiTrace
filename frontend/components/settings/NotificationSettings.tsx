'use client'

/**
 * 通知：旅迹目前只有站内通知中心（由真实业务数据推导），这里的分类开关直接决定通知中心显示哪些内容，
 * 切换后立即保存；失败时回滚并提示。邮件发送服务尚未开通，只如实说明，不放一个无效开关。
 */

import { useState } from 'react'
import { MailX } from 'lucide-react'
import { userApi, type UserView } from '@/services/tabitrace-api'
import { useT } from '@/components/common/PreferencesProvider'
import type { MessageKey } from '@/i18n'
import { SettingsRow, SettingsSection, Switch } from './SettingsParts'

type NotifyKey = 'notifyTripReminder' | 'notifyStory' | 'notifyAchievement' | 'notifyShare'

const ITEMS: { key: NotifyKey; label: MessageKey; description: MessageKey }[] = [
  { key: 'notifyTripReminder', label: 'settings.notifications.trip', description: 'settings.notifications.tripDesc' },
  { key: 'notifyStory', label: 'settings.notifications.story', description: 'settings.notifications.storyDesc' },
  { key: 'notifyAchievement', label: 'settings.notifications.achievement', description: 'settings.notifications.achievementDesc' },
  { key: 'notifyShare', label: 'settings.notifications.share', description: 'settings.notifications.shareDesc' }
]

export function NotificationSettings({ user, onUserChange, onToast }: { user: UserView; onUserChange: (u: UserView) => void; onToast: (msg: string) => void }) {
  const t = useT()
  const [saving, setSaving] = useState<NotifyKey | null>(null)
  const [optimistic, setOptimistic] = useState<Partial<Record<NotifyKey, boolean>>>({})

  const value = (k: NotifyKey) => optimistic[k] ?? user[k] !== false

  const toggle = async (k: NotifyKey, next: boolean) => {
    setOptimistic(o => ({ ...o, [k]: next }))
    setSaving(k)
    try {
      onUserChange(await userApi.update({ [k]: next }))
      onToast(t('settings.notifications.updated'))
    } catch {
      onToast(t('settings.saveFailed'))
    } finally {
      setOptimistic(o => { const n = { ...o }; delete n[k]; return n })
      setSaving(null)
    }
  }

  return (
    <>
      <SettingsSection title={t('settings.notifications.inApp')} description={t('settings.notifications.inAppDesc')}>
        {ITEMS.map(item => (
          <SettingsRow key={item.key} label={t(item.label)} description={t(item.description)} htmlFor={`st-${item.key}`}>
            <Switch
              id={`st-${item.key}`}
              checked={value(item.key)}
              onChange={v => void toggle(item.key, v)}
              label={t(item.label)}
              describedBy={`st-${item.key}-desc`}
              busy={saving === item.key}
              disabled={saving !== null}
            />
          </SettingsRow>
        ))}
        <p className="st-note">{t('settings.notifications.quotaNote')}</p>
      </SettingsSection>
      <SettingsSection title={t('settings.notifications.email')}>
        <SettingsRow label={t('settings.notifications.emailRow')} description={t('settings.notifications.emailDesc')}>
          <span className="st-status is-muted"><MailX size={13} /> {t('settings.notifications.emailOff')}</span>
        </SettingsRow>
      </SettingsSection>
    </>
  )
}
