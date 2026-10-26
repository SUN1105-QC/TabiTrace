'use client'

import { Lock } from 'lucide-react'
import { SHARE_EXPIRY_OPTIONS, type SettingsDraft } from '@/utils/settings'
import { useT } from '@/components/common/PreferencesProvider'
import { SettingsRow, SettingsSection, Switch } from './SettingsParts'

/**
 * 旅行可见性由分享链接决定：新旅行都是 PRIVATE，创建分享链接后变为 UNLISTED，撤销全部链接后恢复 PRIVATE。
 * 旅迹没有公开主页，所以不提供 PUBLIC，也不提供一个改了也不会生效的“默认可见性”选择器。
 */
export function PrivacySettings({ draft, onChange }: { draft: SettingsDraft; onChange: (patch: Partial<SettingsDraft>) => void }) {
  const t = useT()
  return (
    <SettingsSection title={t('settings.privacy.title')} description={t('settings.privacy.description')}>
      <SettingsRow
        label={t('settings.privacy.visibility')}
        description={t('settings.privacy.visibilityDesc')}
      >
        <span className="st-status"><Lock size={13} /> {t('settings.privacy.privateOnly')}</span>
      </SettingsRow>
      <SettingsRow
        label={t('settings.privacy.exact')}
        description={t('settings.privacy.exactDesc')}
        htmlFor="st-exact"
      >
        <Switch id="st-exact" checked={draft.shareExactLocation} onChange={v => onChange({ shareExactLocation: v })} label={t('settings.privacy.exact')} describedBy="st-exact-desc" />
      </SettingsRow>
      <SettingsRow label={t('settings.privacy.expiry')} htmlFor="st-expiry" description={t('settings.privacy.expiryDesc')}>
        <select id="st-expiry" className="st-input st-select" value={draft.shareLinkExpiryDays} onChange={e => onChange({ shareLinkExpiryDays: Number(e.target.value) })} aria-describedby="st-expiry-desc">
          {SHARE_EXPIRY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
        </select>
      </SettingsRow>
    </SettingsSection>
  )
}
