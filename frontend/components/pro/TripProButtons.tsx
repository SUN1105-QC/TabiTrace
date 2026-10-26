'use client'

/** Trip Pro 的购买按钮与支付结果提示：支付不可用时如实显示，不提供点了必然失败的按钮 */

import { CheckCircle2, CircleAlert, Crown, CreditCard, Info, Loader2 } from 'lucide-react'
import type { TripView } from '@/services/tabitrace-api'
import { lifetimePrice, planPrice, type TripProPlan } from '@/utils/plan'
import type { PayState } from './useTripPro'

/** named：按钮上写明为哪一段旅行升级（离旅行状态卡较远的位置用） */
export function UpgradeButton({ trip, plan, state, onClick, named = false, compact = false }: {
  trip: TripView; plan: TripProPlan; state: PayState; onClick: () => void; named?: boolean; compact?: boolean
}) {
  const busy = state === 'loading' || state === 'confirming'
  if (plan.paymentsAvailable === false) {
    // 单次价格低于支付渠道的最低收款额（BELOW_MINIMUM）或支付没有开通
    return (
      <button type="button" className={`pr-cta${compact ? ' is-compact' : ''}`} disabled aria-disabled="true">
        <CreditCard size={17} aria-hidden="true" /> {plan.unavailableReason === 'BELOW_MINIMUM' ? `单次升级 ${planPrice(plan)} 暂未开放付款` : 'Trip Pro 支付暂未开放'}
      </button>
    )
  }
  return (
    <button type="button" className={`pr-cta${compact ? ' is-compact' : ''}`} onClick={onClick} disabled={busy} aria-busy={busy}>
      {busy
        ? <><Loader2 size={17} className="pr-spin" aria-hidden="true" /> {state === 'confirming' ? '正在确认支付…' : '正在创建订单…'}</>
        : <><CreditCard size={17} aria-hidden="true" /> {named ? `为「${trip.title}」升级 · ${planPrice(plan)}` : `升级 Trip Pro · ${planPrice(plan)}`}</>}
    </button>
  )
}

/** 买断 · 终身 Pro：已拥有时显示状态，支付不可用时如实说明，否则是购买按钮 */
export function LifetimeButton({ plan, owned, state, onClick }: { plan: TripProPlan; owned: boolean; state: PayState; onClick: () => void }) {
  if (!plan.lifetime) return null
  if (owned) return <p className="pr-unlocked"><Crown size={16} aria-hidden="true" /> 已买断终身 Pro：账号下所有旅行都已解锁</p>
  if (!plan.lifetime.paymentsAvailable) return <button type="button" className="pr-cta is-lifetime" disabled aria-disabled="true"><Crown size={17} aria-hidden="true" /> 买断终身 Pro · 支付暂未开放</button>
  const busy = state === 'loading' || state === 'confirming'
  return (
    <button type="button" className="pr-cta is-lifetime" onClick={onClick} disabled={busy} aria-busy={busy}>
      {busy ? <><Loader2 size={17} className="pr-spin" aria-hidden="true" /> {state === 'confirming' ? '正在确认支付…' : '正在创建订单…'}</> : <><Crown size={17} aria-hidden="true" /> 买断终身 Pro · {lifetimePrice(plan)}</>}
    </button>
  )
}

export function PayNotice({ state, message, trip, mock, lifetime = false }: { state: PayState; message: string; trip: TripView | null; mock: boolean; lifetime?: boolean }) {
  if (state === 'idle' || state === 'loading') return null
  const map: Record<Exclude<PayState, 'idle' | 'loading'>, { icon: typeof Info; tone: string; text: string }> = {
    confirming: { icon: Loader2, tone: 'is-info', text: '支付已提交，正在确认结果…' },
    success: { icon: CheckCircle2, tone: 'is-ok', text: `${lifetime ? '买断成功，终身 Pro 已生效，账号下所有旅行都已解锁。' : `支付成功，「${trip?.title ?? '这段旅行'}」已解锁 Trip Pro。`}${mock ? '（本地开发环境为模拟支付，没有产生真实扣款）' : ''}` },
    already: { icon: CheckCircle2, tone: 'is-ok', text: lifetime ? '你已经拥有终身 Pro，无需重复购买。' : `「${trip?.title ?? '这段旅行'}」已经是 Trip Pro，无需重复购买。` },
    cancelled: { icon: Info, tone: 'is-info', text: '你已取消支付，没有产生扣款。可以随时再次升级。' },
    failed: { icon: CircleAlert, tone: 'is-bad', text: `支付未完成：${message || '请稍后再试'}` }
  }
  const m = map[state]
  const Icon = m.icon
  return <p className={`pr-notice ${m.tone}`} role={state === 'failed' ? 'alert' : 'status'}><Icon size={16} className={state === 'confirming' ? 'pr-spin' : ''} aria-hidden="true" /> {message && state === 'confirming' ? message : m.text}</p>
}

/** 本地开发环境 / 金额低于最低收款额时的说明 */
export function PayNotes({ plan, lifetime = false }: { plan: TripProPlan; lifetime?: boolean }) {
  return (
    <>
      {!plan.realPayments && <p className="pr-mock"><Info size={13} aria-hidden="true" /> 当前是本地开发环境：会模拟支付成功，不会产生真实扣款。</p>}
      {!lifetime && plan.unavailableReason === 'BELOW_MINIMUM' && <p className="pr-mock"><Info size={13} aria-hidden="true" /> 单次升级 {planPrice(plan)} 需要接入微信支付 / 支付宝后才能付款；现在可以选择「买断 · 终身 Pro」。</p>}
    </>
  )
}
