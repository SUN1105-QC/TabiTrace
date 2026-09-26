'use client'

/**
 * 通知：旅迹目前只有站内通知中心（由真实业务数据推导），这里的分类开关直接决定通知中心显示哪些内容，
 * 切换后立即保存；失败时回滚并提示。邮件发送服务尚未开通，只如实说明，不放一个无效开关。
 */

import { useState } from 'react'
import { MailX } from 'lucide-react'
import { userApi, type UserView } from '@/services/tabitrace-api'
import { SettingsRow, SettingsSection, Switch } from './SettingsParts'

type NotifyKey = 'notifyTripReminder' | 'notifyStory' | 'notifyAchievement' | 'notifyShare'

const ITEMS: { key: NotifyKey; label: string; description: string }[] = [
  { key: 'notifyTripReminder', label: '旅行提醒', description: '旅行即将开始、或已经结束但还没整理时提醒你。' },
  { key: 'notifyStory', label: 'Travel Story', description: '旅行视频生成完成或生成失败时通知你。' },
  { key: 'notifyAchievement', label: '旅行成就', description: '解锁新的旅行成就时通知你。' },
  { key: 'notifyShare', label: '分享动态', description: '你的分享链接被别人打开时通知你。' }
]

export function NotificationSettings({ user, onUserChange, onToast }: { user: UserView; onUserChange: (u: UserView) => void; onToast: (msg: string) => void }) {
  const [saving, setSaving] = useState<NotifyKey | null>(null)
  const [optimistic, setOptimistic] = useState<Partial<Record<NotifyKey, boolean>>>({})

  const value = (k: NotifyKey) => optimistic[k] ?? user[k] !== false

  const toggle = async (k: NotifyKey, next: boolean) => {
    setOptimistic(o => ({ ...o, [k]: next }))
    setSaving(k)
    try {
      onUserChange(await userApi.update({ [k]: next }))
      onToast('通知设置已更新')
    } catch {
      onToast('设置保存失败，请重试')
    } finally {
      setOptimistic(o => { const n = { ...o }; delete n[k]; return n })
      setSaving(null)
    }
  }

  return (
    <>
      <SettingsSection title="站内通知" description="显示在顶部铃铛通知中心里的内容，切换后立即保存。">
        {ITEMS.map(item => (
          <SettingsRow key={item.key} label={item.label} description={item.description} htmlFor={`st-${item.key}`}>
            <Switch
              id={`st-${item.key}`}
              checked={value(item.key)}
              onChange={v => void toggle(item.key, v)}
              label={item.label}
              describedBy={`st-${item.key}-desc`}
              busy={saving === item.key}
              disabled={saving !== null}
            />
          </SettingsRow>
        ))}
        <p className="st-note">免费额度快用完的提醒会一直显示，避免你在旅途中突然无法打卡或上传照片。</p>
      </SettingsSection>
      <SettingsSection title="邮件通知">
        <SettingsRow label="邮件提醒" description="旅迹目前还没有开通邮件发送服务，不会向你的邮箱发送任何通知。开通后会在这里提供开关。">
          <span className="st-status is-muted"><MailX size={13} /> 暂未开通</span>
        </SettingsRow>
      </SettingsSection>
    </>
  )
}
