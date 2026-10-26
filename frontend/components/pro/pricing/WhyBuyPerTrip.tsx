/** 为什么按旅行购买：三点说明（只有后端确认是单次、一次性、不续费时才显示） */

import { isOneTimePerTrip, planPrice, type TripProPlan } from '@/utils/plan'

export function WhyBuyPerTrip({ plan }: { plan: TripProPlan }) {
  if (!isOneTimePerTrip(plan)) return null
  return (
    <section className="pr-why" aria-labelledby="pr-why-title">
      <h3 id="pr-why-title">为什么按旅行购买</h3>
      <ul>
        <li><b>不需要长期订阅</b><span>只在某一趟旅行值得好好留下时付费，平时不会产生任何费用。</span></li>
        <li><b>新旅行仍然免费开始</b><span>每段新旅行都从免费版开始，先记录，再决定要不要升级。</span></li>
        <li><b>只有升级的旅行收费</b><span>{planPrice(plan)} 只解锁你选择的那一段旅行，其他旅行不受影响。</span></li>
      </ul>
    </section>
  )
}
