'use client'

import type { UserView } from '@/services/tabitrace-api'
import { BIO_MAX, NICKNAME_MAX, type FieldErrors, type SettingsDraft } from '@/utils/settings'
import { SettingsRow, SettingsSection } from './SettingsParts'
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
  return (
    <SettingsSection title="个人资料" description="别人在你的分享页上看到的名字，以及你在旅迹里的样子。">
      <SettingsRow label="头像" description="显示在顶部导航和账户概览中。">
        <AvatarUploader user={user} onChange={onUserChange} onToast={onToast} />
      </SettingsRow>
      <SettingsRow label="昵称" htmlFor="st-nickname" description="分享页会显示为“来自 你的昵称 的旅迹分享”。" error={errors.nickname} errorId="st-nickname-error">
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
      <SettingsRow label="个人简介" htmlFor="st-bio" description="一句话介绍你的旅行方式，可以留空。" error={errors.bio} errorId="st-bio-error" stack>
        <div className="st-input-wrap">
          <textarea
            id="st-bio"
            className="st-input st-textarea"
            rows={3}
            value={draft.bio}
            placeholder="例如：喜欢慢慢走，在城市里找一家好喝的咖啡店。"
            onChange={e => onChange({ bio: e.target.value })}
            aria-invalid={Boolean(errors.bio)}
            aria-describedby={`st-bio-desc${errors.bio ? ' st-bio-error' : ''}`}
          />
          <span className={`st-counter${count(draft.bio) > BIO_MAX ? ' is-over' : ''}`}>{count(draft.bio)} / {BIO_MAX}</span>
        </div>
      </SettingsRow>
      <SettingsRow label="登录邮箱" htmlFor="st-email" description="修改登录邮箱需要通过账户安全验证，目前暂不支持在线修改。">
        <input id="st-email" className="st-input is-readonly" value={user.email} readOnly aria-readonly="true" aria-describedby="st-email-desc" />
      </SettingsRow>
    </SettingsSection>
  )
}
