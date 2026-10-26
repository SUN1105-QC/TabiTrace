'use client'

import type { UserView } from '@/services/tabitrace-api'
import { BIO_MAX, NICKNAME_MAX, type FieldErrors, type SettingsDraft } from '@/utils/settings'
import { SettingsRow, SettingsSection } from './SettingsParts'
import { useT } from '@/components/common/PreferencesProvider'
import { AvatarUploader } from './AvatarUploader'

const count = (s: string) => Array.from(s.trim()).length

export function ProfileSettings({ user, draft, errors, onChange, onUserChange, onToast }: {
  user: UserView
  draft: SettingsDraft
  errors: FieldErrors
  onChange: (patch: Partial<SettingsDraft>) => void
  onUserChange: (u: UserView) => void
  onToast: (msg: string) => void
}) {
  const t = useT()
  return (
    <SettingsSection title={t('settings.profile.title')} description={t('settings.profile.description')}>
      <SettingsRow label={t('settings.profile.avatar')} description={t('settings.profile.avatarDesc')}>
        <AvatarUploader user={user} onChange={onUserChange} onToast={onToast} />
      </SettingsRow>
      <SettingsRow label={t('settings.profile.nickname')} htmlFor="st-nickname" description={t('settings.profile.nicknameDesc')} error={errors.nickname} errorId="st-nickname-error">
        <div className="st-input-wrap">
          <input
            id="st-nickname"
            className="st-input"
            value={draft.nickname}
            onChange={e => onChange({ nickname: e.target.value })}
            aria-invalid={Boolean(errors.nickname)}
            aria-describedby={`st-nickname-desc${errors.nickname ? ' st-nickname-error' : ''}`}
            autoComplete="nickname"
          />
          <span className={`st-counter${count(draft.nickname) > NICKNAME_MAX ? ' is-over' : ''}`}>{count(draft.nickname)} / {NICKNAME_MAX}</span>
        </div>
      </SettingsRow>
      <SettingsRow label={t('settings.profile.bio')} htmlFor="st-bio" description={t('settings.profile.bioDesc')} error={errors.bio} errorId="st-bio-error" stack>
        <div className="st-input-wrap">
          <textarea
            id="st-bio"
            className="st-input st-textarea"
            rows={3}
            value={draft.bio}
            placeholder={t('settings.profile.bioPlaceholder')}
            onChange={e => onChange({ bio: e.target.value })}
            aria-invalid={Boolean(errors.bio)}
            aria-describedby={`st-bio-desc${errors.bio ? ' st-bio-error' : ''}`}
          />
          <span className={`st-counter${count(draft.bio) > BIO_MAX ? ' is-over' : ''}`}>{count(draft.bio)} / {BIO_MAX}</span>
        </div>
      </SettingsRow>
      <SettingsRow label={t('settings.profile.email')} htmlFor="st-email" description={t('settings.profile.emailDesc')}>
        <input id="st-email" className="st-input is-readonly" value={user.email} readOnly aria-readonly="true" aria-describedby="st-email-desc" />
      </SettingsRow>
    </SettingsSection>
  )
}
