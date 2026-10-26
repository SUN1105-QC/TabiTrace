'use client'

/** 常见问题（6 个以内，原生 details 折叠），答案里的价格与权益来自方案配置 */

import { planFaq, type TripProPlan } from '@/utils/plan'

export function TripProFaq({ plan }: { plan: TripProPlan }) {
  return (
    <section className="pr-section" aria-labelledby="pr-faq-title">
      <header className="pr-section-head">
        <p className="pr-eyebrow">FAQ</p>
        <h2 id="pr-faq-title">常见问题</h2>
      </header>
      <div className="pr-faq">
        {planFaq(plan).map((f, i) => (
          <details key={f.q} open={i === 0}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
