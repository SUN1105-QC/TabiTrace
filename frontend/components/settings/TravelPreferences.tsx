'use client'

/**
 * 旅行偏好：界面语言、时区、距离单位。三者都是全局偏好：
 * 保存后 userApi 广播 USER_UPDATED_EVENT，PreferencesProvider 立即切换界面语言与时区（无需刷新）；
 * 距离单位由地图与推荐探索读取。
 */

import { useMemo } from 'react'
import { LOCALES, timezoneOptions, type FieldErrors, type SettingsDraft } from '@/utils/settings'
import { useT } from '@/components/common/PreferencesProvider'
import { SettingsRow, SettingsSection } from './SettingsParts'

export function TravelPreferences({ draft, errors, onChange }: { draft: SettingsDraft; errors: FieldErrors; onChange: (patch: Partial<SettingsDraft>) => void }) {
  const t = useT()
  const zones = useMemo(() => timezoneOptions(draft.timezone, t), [draft.timezone, t])
  return (
    <SettingsSection title={t('settings.prefs.title')} description={t('settings.prefs.description')}>
      <SettingsRow label={t('settings.prefs.language')} htmlFor="st-locale" description={t('settings.prefs.languageDesc')}>
        <select id="st-locale" className="st-input st-select" value={draft.locale} onChange={e => onChange({ locale: e.target.value })} aria-describedby="st-locale-desc">
          {LOCALES.map(([v, l]) => <option key={v} value={v} lang={v}>{l}</option>)}
        </select>
      </SettingsRow>
      <SettingsRow label={t('settings.prefs.timezone')} htmlFor="st-timezone" description={t('settings.prefs.timezoneDesc')} error={errors.timezone} errorId="st-timezone-error">
        <select
          id="st-timezone"
          className="st-input st-select"
          value={draft.timezone}
          onChange={e => onChange({ timezone: e.target.value })}
          aria-invalid={Boolean(errors.timezone)}
          aria-describedby={`st-timezone-desc${errors.timezone ? ' st-timezone-error' : ''}`}
        >
          {zones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </SettingsRow>
      <SettingsRow label={t('settings.prefs.distance')} htmlFor="st-distance" description={t('settings.prefs.distanceDesc')}>
        <select id="st-distance" className="st-input st-select" value={draft.distanceUnit} onChange={e => onChange({ distanceUnit: e.target.value === 'MI' ? 'MI' : 'KM' })} aria-describedby="st-distance-desc">
          <option value="KM">{t('settings.prefs.km')}</option>
          <option value="MI">{t('settings.prefs.mi')}</option>
        </select>
      </SettingsRow>
    </SettingsSection>
  )
}
