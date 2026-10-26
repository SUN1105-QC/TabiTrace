'use client'

/** 升级后这趟旅行多了什么：4 项核心权益，数字全部来自方案配置 */

import { Camera, CheckCircle2, Film, MapPinned, Music } from 'lucide-react'
import { planBenefits, type Benefit, type TripProPlan } from '@/utils/plan'

const ICON: Record<Benefit['key'], typeof Camera> = { record: MapPinned, share: Camera, story: Film, style: Music }

export function TripProBenefits({ plan, member }: { plan: TripProPlan; member: boolean }) {
  return (
    <section className="pr-section" aria-labelledby="pr-benefits-title">
      <header className="pr-section-head">
        <p className="pr-eyebrow">WHAT YOU GET</p>
        <h2 id="pr-benefits-title">升级后，这趟旅行多了什么？</h2>
        <p>不只是更多功能，更是更完整、更生动的旅行记录。</p>
      </header>
      <div className="pr-benefits">
        {planBenefits(plan).map(b => {
          const Icon = ICON[b.key]
          return (
            <article key={b.key} className="pr-benefit">
              <span className="pr-benefit-icon"><Icon size={20} aria-hidden="true" /></span>
              <h3>{b.title}</h3>
              <p>{b.desc}</p>
              <p className="pr-benefit-fact">{b.fact}</p>
              {/* 上传自己的音乐是账号会员权益（买断 · 终身 Pro 开通），按当前账号状态如实显示 */}
              {b.key === 'style' && plan.lifetime && (
                member
                  ? <p className="pr-benefit-note is-on"><CheckCircle2 size={13} aria-hidden="true" /> 你的账号已开通上传自己的音乐</p>
                  : <p className="pr-benefit-note">上传自己的音乐：买断 · 终身 Pro 的账号会员权益</p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
