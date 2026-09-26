'use client'

import { useMemo } from 'react'
import { LOCALES, timezoneOptions, type FieldErrors, type SettingsDraft } from '@/utils/settings'
import { SettingsRow, SettingsSection } from './SettingsParts'

export function TravelPreferences({ draft, errors, onChange }: { draft: SettingsDraft; errors: FieldErrors; onChange: (patch: Partial<SettingsDraft>) => void }) {
  const zones = useMemo(() => timezoneOptions(draft.timezone), [draft.timezone])
  return (
    <SettingsSection title="旅行偏好" description="影响旅迹如何整理和显示你的旅行。">
      <SettingsRow label="语言" htmlFor="st-locale" description="目前界面只提供简体中文；选择会保存为你的语言偏好，其他语言上线后按此显示。">
        <select id="st-locale" className="st-input st-select" value={draft.locale} onChange={e => onChange({ locale: e.target.value })} aria-describedby="st-locale-desc">
          {LOCALES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </SettingsRow>
      <SettingsRow label="时区" htmlFor="st-timezone" description="按这个时区把打卡和照片归到“当地的哪一天”，影响时间轴、每日记录和旅行回忆。" error={errors.timezone} errorId="st-timezone-error">
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
      <SettingsRow label="距离单位" htmlFor="st-distance" description="推荐探索里“离我最近”排序显示的距离。">
        <select id="st-distance" className="st-input st-select" value={draft.distanceUnit} onChange={e => onChange({ distanceUnit: e.target.value === 'MI' ? 'MI' : 'KM' })} aria-describedby="st-distance-desc">
          <option value="KM">公里 km</option>
          <option value="MI">英里 mi</option>
        </select>
      </SettingsRow>
    </SettingsSection>
  )
}
