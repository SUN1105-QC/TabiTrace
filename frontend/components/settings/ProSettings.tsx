'use client'

/**
 * Trip Pro 按“单段旅行一次性购买”生效，也可以买断终身 Pro（账号级，所有旅行都是 Pro）：没有订阅、没有到期日、没有 AI 额度。
 * 这里列出每段旅行的真实方案；PRO 旅行显示最近一次成功支付，FREE 旅行的升级复用现有 /pricing 支付流程。
 */

import Link from 'next/link'
import { ArrowRight, Crown, Plus } from 'lucide-react'
import type { AccountOverview } from '@/services/tabitrace-api'
import { dotDate, formatMoney } from '@/utils/settings'
import { useT } from '@/components/common/PreferencesProvider'
import type { MessageKey } from '@/i18n'
import { SettingsSection } from './SettingsParts'

const STATUS: Record<string, MessageKey> = {
  PLANNING: 'settings.pro.status.PLANNING', ONGOING: 'settings.pro.status.ONGOING', COMPLETED: 'settings.pro.status.COMPLETED', ARCHIVED: 'settings.pro.status.ARCHIVED'
}

export function ProSettings({ overview }: { overview: AccountOverview }) {
  const t = useT()
  const pro = overview.proTrips > 0 || overview.lifetimePro
  // 金额是最小货币单位（分）：¥4 = 400
  const price = formatMoney(overview.tripProAmount, overview.tripProCurrency)
  const lifetime = formatMoney(overview.lifetimeAmount, overview.tripProCurrency)
  return (
    <SettingsSection
      title="Trip Pro"
      description={t('settings.pro.description', { price })}
      action={<Link href="/pricing" className="st-btn is-quiet">{t('settings.pro.compare')} <ArrowRight size={13} /></Link>}
    >
      <div className={`st-pro-status${pro ? ' is-pro' : ''}`}>
        <span className="st-plan-badge">{pro ? <><Crown size={13} /> TRIP PRO</> : 'FREE'}</span>
        <p>
          {overview.lifetimePro ? t('settings.pro.lifetimeOwned') : pro ? t('settings.pro.hasPro', { count: overview.proTrips }) : t('settings.pro.allFree')}
          {!overview.lifetimePro && <span>{t('settings.pro.activeFree', { active: overview.activeFreeTrips, limit: overview.freeTripLimit })}</span>}
        </p>
      </div>
      {!overview.lifetimePro && (
        <p className="st-lifetime-offer">{t('settings.pro.lifetimeOffer', { price: lifetime })} <Link href="/pricing#pr-price-title" className="st-btn is-quiet">{t('settings.pro.lifetimeBuy')} <ArrowRight size={13} /></Link></p>
      )}

      {overview.plans.length === 0 ? (
        <div className="st-empty">
          <p>{t('settings.pro.empty')}</p>
          <Link href="/trips/new" className="st-btn is-primary"><Plus size={14} /> {t('nav.createTrip')}</Link>
        </div>
      ) : (
        <ul className="st-plans">
          {overview.plans.map(p => (
            <li key={p.tripId}>
              <div className="st-plan-text">
                <b>{p.title}</b>
                <small>{p.destinationName} · {dotDate(p.startDate)} – {dotDate(p.endDate)} · {STATUS[p.status] ? t(STATUS[p.status]) : p.status}</small>
                {p.planType === 'PRO' && (
                  <small className="st-plan-paid">
                    {p.paidAt ? t('settings.pro.paid', { date: dotDate(p.paidAt), amount: formatMoney(p.amount, p.currency) }) : t('settings.pro.upgraded')}
                    {p.provider === 'MOCK' && <em>{t('settings.pro.mock')}</em>}
                  </small>
                )}
              </div>
              {p.planType === 'PRO'
                ? <span className="st-plan-badge is-pro"><Crown size={12} /> PRO</span>
                : <Link href={`/pricing?trip=${p.tripId}`} className="st-btn" aria-label={t('settings.pro.upgradeLabel', { title: p.title })}>{t('settings.pro.upgradeTrip')}</Link>}
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  )
}
