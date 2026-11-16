/** FREE：¥0，限制全部来自方案配置 */

import { Check } from 'lucide-react'
import { formatCurrency } from '@/utils/currency'
import type { TripProPlan } from '@/utils/plan'

export function PricingCardFree({ plan }: { plan: TripProPlan }) {
  const f = plan.freeLimits
  return (
    <article className="pr-plan is-free" aria-labelledby="pr-plan-free">
      <p className="pr-plan-tag" id="pr-plan-free">FREE</p>
      <p className="pr-plan-price">{formatCurrency(0, plan.price.currency)}</p>
      <ul>
        <li><Check size={14} aria-hidden="true" />每段旅行 {f.checkinsPerTrip} 次打卡、{f.photosPerTrip} 张照片</li>
        <li><Check size={14} aria-hidden="true" />旅行海报 · 九宫格 · 每日长图</li>
        <li><Check size={14} aria-hidden="true" />Travel Story {plan.storyFree.quality.toUpperCase()}{plan.storyFree.watermark ? '（带水印）' : ''}</li>
        <li><Check size={14} aria-hidden="true" />基础账号最多保留 {f.activeFreeTrips} 条旅程，每条从创建起保存 1 个月</li>
      </ul>
    </article>
  )
}
