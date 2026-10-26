/** TRIP PRO：按单段旅行一次性购买；底部是当前旅行的真实状态（已解锁 / 升级按钮 / 登录 / 创建旅行） */

import { Check } from 'lucide-react'
import { isOneTimePerTrip, planPrice, type TripProPlan } from '@/utils/plan'

export function PricingCardTripPro({ plan, cta }: { plan: TripProPlan; cta: React.ReactNode }) {
  const oneTime = isOneTimePerTrip(plan)
  return (
    <article className="pr-plan is-pro" aria-labelledby="pr-plan-pro">
      <p className="pr-plan-tag" id="pr-plan-pro">TRIP PRO</p>
      <p className="pr-plan-price">{planPrice(plan)}<small>{oneTime ? ' / 每段旅行 · 一次性' : ''}</small></p>
      <dl className="pr-plan-terms">
        <div><dt>生效范围</dt><dd>只对你选择升级的这一段旅行{oneTime ? '，永久有效' : ''}</dd></div>
        {oneTime && <div><dt>续费</dt><dd>不是订阅，不会自动续费</dd></div>}
      </dl>
      <ul>
        <li><Check size={14} aria-hidden="true" />打卡与照片不限数量</li>
        <li><Check size={14} aria-hidden="true" />Travel Story {plan.storyPro.quality.toUpperCase()}{plan.storyPro.watermark ? '' : ' 无水印'} · 最长 {Math.max(...plan.storyPro.durations)} 秒</li>
        <li><Check size={14} aria-hidden="true" />全部视频模板与背景音乐</li>
        <li><Check size={14} aria-hidden="true" />每个视频最多 {plan.storyPro.maxPhotos} 张照片</li>
      </ul>
      <div className="pr-plan-cta">{cta}</div>
    </article>
  )
}
