/** 买断 · 终身 PRO：账号级一次付款；id="pr-lifetime" 供设置页、会员提示直接跳转 */

import { Check } from 'lucide-react'
import { lifetimePrice, type TripProPlan } from '@/utils/plan'

export function PricingCardLifetimePro({ plan, cta }: { plan: TripProPlan; cta: React.ReactNode }) {
  if (!plan.lifetime) return null
  return (
    <article className="pr-plan is-lifetime" id="pr-lifetime" aria-labelledby="pr-plan-lifetime">
      <p className="pr-plan-tag" id="pr-plan-lifetime">买断 · 终身 PRO</p>
      <p className="pr-plan-price">{lifetimePrice(plan)}<small> / 账号 · 一次性</small></p>
      <dl className="pr-plan-terms">
        <div><dt>生效范围</dt><dd>账号下现有和以后新建的所有旅行</dd></div>
        <div><dt>续费</dt><dd>一次付款，不续费、不过期</dd></div>
      </dl>
      <ul>
        <li><Check size={14} aria-hidden="true" />每段旅行都是 Trip Pro，无需单独升级</li>
        <li><Check size={14} aria-hidden="true" />不再受免费旅行数量的限制</li>
        <li><Check size={14} aria-hidden="true" />包含 Trip Pro 的全部功能</li>
        <li><Check size={14} aria-hidden="true" />账号会员：上传自己的音乐，保存个人音乐库、跨旅行复用</li>
      </ul>
      <div className="pr-plan-cta">{cta}</div>
    </article>
  )
}
