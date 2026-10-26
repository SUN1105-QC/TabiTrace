'use client'

/** 左侧账户概览：头像、昵称、邮箱、方案状态与真实旅行统计 */

import { ArrowRight, Crown } from 'lucide-react'
import type { AccountOverview, UserView } from '@/services/tabitrace-api'
import { joinedLabel } from '@/utils/settings'
import { useT } from '@/components/common/PreferencesProvider'
import { Avatar } from './SettingsParts'

export function AccountSummaryCard({ user, overview, onOpenProfile, onOpenPro }: { user: UserView; overview: AccountOverview; onOpenProfile: () => void; onOpenPro: () => void }) {
  const t = useT()
  const name = user.nickname?.trim() || t('common.meFallback')
  const pro = overview.proTrips > 0
  return (
    <aside className="st-summary" aria-label={t('settings.summary.label')}>
      <div className="st-summary-id">
        <Avatar name={name} user={user} size={64} />
        <div className="min-w-0">
          <h2 title={name}>{name}</h2>
          <p className="st-summary-email" title={user.email}>{user.email}</p>
        </div>
      </div>
      {user.bio && <p className="st-summary-bio">{user.bio}</p>}
      <p className={`st-plan${pro ? ' is-pro' : ''}`}>
        {pro ? <><Crown size={13} /> {t('settings.summary.proTrips', { count: overview.proTrips })}</> : 'FREE'}
      </p>
      <dl className="st-stats">
        <div><dt>{t('settings.summary.trips')}</dt><dd>{overview.trips}</dd></div>
        <div><dt>{t('settings.summary.places')}</dt><dd>{overview.places}</dd></div>
        <div><dt>{t('settings.summary.photos')}</dt><dd>{overview.photos}</dd></div>
      </dl>
      {user.createdAt && <p className="st-summary-joined">{joinedLabel(user.createdAt, t)}</p>}
      <div className="st-summary-links">
        <button type="button" onClick={onOpenProfile}>{t('settings.summary.openProfile')} <ArrowRight size={13} /></button>
        <button type="button" onClick={onOpenPro}>{t('settings.summary.openPro')} <ArrowRight size={13} /></button>
      </div>
    </aside>
  )
}

export function AccountSummarySkeleton() {
  return (
    <aside className="st-summary" aria-hidden="true">
      <div className="st-summary-id">
        <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 999 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: '70%', height: 18, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: '90%', height: 12, borderRadius: 6, marginTop: 10 }} />
        </div>
      </div>
      <div className="skeleton" style={{ width: 90, height: 22, borderRadius: 999, marginTop: 18 }} />
      <div className="skeleton" style={{ height: 64, borderRadius: 14, marginTop: 18 }} />
    </aside>
  )
}
