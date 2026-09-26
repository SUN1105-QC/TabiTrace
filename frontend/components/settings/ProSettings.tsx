'use client'

/**
 * Trip Pro 按“单段旅行一次性购买”生效：没有订阅、没有到期日、没有 AI 额度。
 * 这里列出每段旅行的真实方案；PRO 旅行显示最近一次成功支付，FREE 旅行的升级复用现有 /pricing 支付流程。
 */

import Link from 'next/link'
import { ArrowRight, Crown, Plus } from 'lucide-react'
import type { AccountOverview } from '@/services/tabitrace-api'
import { dotDate, formatMoney } from '@/utils/settings'
import { SettingsSection } from './SettingsParts'

const STATUS: Record<string, string> = { PLANNING: '计划中', ONGOING: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档' }

export function ProSettings({ overview }: { overview: AccountOverview }) {
  const pro = overview.proTrips > 0
  const price = formatMoney(overview.tripProPrice * 100, overview.tripProCurrency)
  return (
    <SettingsSection
      title="Trip Pro"
      description={`按单段旅行一次性购买（${price} / 段），升级后这段旅行永久保持 Pro，没有订阅和自动续费。`}
      action={<Link href="/pricing" className="st-btn is-quiet">查看方案对比 <ArrowRight size={13} /></Link>}
    >
      <div className={`st-pro-status${pro ? ' is-pro' : ''}`}>
        <span className="st-plan-badge">{pro ? <><Crown size={13} /> TRIP PRO</> : 'FREE'}</span>
        <p>
          {pro ? `已有 ${overview.proTrips} 段旅行升级为 Pro。` : '目前所有旅行都是免费版。'}
          <span>进行中的免费旅行 {overview.activeFreeTrips} / {overview.freeTripLimit}（归档后不计入）</span>
        </p>
      </div>

      {overview.plans.length === 0 ? (
        <div className="st-empty">
          <p>还没有旅行。创建第一段旅行后，可以在这里为它升级 Trip Pro。</p>
          <Link href="/trips/new" className="st-btn is-primary"><Plus size={14} /> 创建旅行</Link>
        </div>
      ) : (
        <ul className="st-plans">
          {overview.plans.map(p => (
            <li key={p.tripId}>
              <div className="st-plan-text">
                <b>{p.title}</b>
                <small>{p.destinationName} · {dotDate(p.startDate)} – {dotDate(p.endDate)} · {STATUS[p.status] ?? p.status}</small>
                {p.planType === 'PRO' && (
                  <small className="st-plan-paid">
                    {p.paidAt ? `${dotDate(p.paidAt)} 升级 · 实付 ${formatMoney(p.amount, p.currency)}` : '已升级'}
                    {p.provider === 'MOCK' && <em>模拟支付</em>}
                  </small>
                )}
              </div>
              {p.planType === 'PRO'
                ? <span className="st-plan-badge is-pro"><Crown size={12} /> PRO</span>
                : <Link href={`/pricing?trip=${p.tripId}`} className="st-btn" aria-label={`升级「${p.title}」为 Trip Pro`}>升级这段旅行</Link>}
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  )
}
