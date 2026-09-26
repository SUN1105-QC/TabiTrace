'use client'

import { Lock } from 'lucide-react'
import { SHARE_EXPIRY_OPTIONS, type SettingsDraft } from '@/utils/settings'
import { SettingsRow, SettingsSection, Switch } from './SettingsParts'

/**
 * 旅行可见性由分享链接决定：新旅行都是 PRIVATE，创建分享链接后变为 UNLISTED，撤销全部链接后恢复 PRIVATE。
 * 旅迹没有公开主页，所以不提供 PUBLIC，也不提供一个改了也不会生效的“默认可见性”选择器。
 */
export function PrivacySettings({ draft, onChange }: { draft: SettingsDraft; onChange: (patch: Partial<SettingsDraft>) => void }) {
  return (
    <SettingsSection title="隐私与分享" description="决定别人通过分享链接能看到什么。">
      <SettingsRow
        label="新旅行默认可见性"
        description="新建的旅行只有你能看到。在“分享成果”里创建链接后变为“通过链接访问（UNLISTED）”；撤销全部链接后恢复为仅自己。旅迹暂不提供公开主页。"
      >
        <span className="st-status"><Lock size={13} /> 仅自己 · PRIVATE</span>
      </SettingsRow>
      <SettingsRow
        label="分享页显示精确位置"
        description="关闭时，分享页里的打卡坐标只保留约 1 公里精度：路线轮廓仍然可见，但不会暴露住处等具体位置。"
        htmlFor="st-exact"
      >
        <Switch id="st-exact" checked={draft.shareExactLocation} onChange={v => onChange({ shareExactLocation: v })} label="分享页显示精确位置" describedBy="st-exact-desc" />
      </SettingsRow>
      <SettingsRow label="分享链接默认有效期" htmlFor="st-expiry" description="新建分享链接时自动设置到期时间，已经创建的链接不受影响。">
        <select id="st-expiry" className="st-input st-select" value={draft.shareLinkExpiryDays} onChange={e => onChange({ shareLinkExpiryDays: Number(e.target.value) })} aria-describedby="st-expiry-desc">
          {SHARE_EXPIRY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </SettingsRow>
    </SettingsSection>
  )
}
