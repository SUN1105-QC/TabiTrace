'use client'

/**
 * Free 与 Trip Pro 的核心差异（10 项，来自方案配置）。
 * 桌面是三列表格（分组之间用稍粗的分隔线）；手机改为按分组折叠的卡片，不硬塞宽表格。上方一句话说明当前旅行在哪一列。
 */

import { CheckCircle2 } from 'lucide-react'
import type { TripView } from '@/services/tabitrace-api'
import { planComparison, type TripProPlan } from '@/utils/plan'

export function TripProComparisonTable({ plan, trip }: { plan: TripProPlan; trip: TripView | null }) {
  const rows = planComparison(plan)
  const groups = [...new Set(rows.map(r => r.group))]
  const pro = trip?.planType === 'PRO'
  return (
    <section className="pr-section" id="pr-compare" aria-labelledby="pr-compare-title">
      <header className="pr-section-head">
        <p className="pr-eyebrow">COMPARE</p>
        <h2 id="pr-compare-title">Free 与 Trip Pro 对比</h2>
        <p>清晰了解两种方案的区别，选择适合你的方式。</p>
      </header>
      {trip && (
        <p className={`pr-compare-hint${pro ? ' is-pro' : ''}`}>
          {pro ? <><CheckCircle2 size={15} aria-hidden="true" />「{trip.title}」已经拥有 Trip Pro 一列的全部权益</> : <>「{trip.title}」当前是 Free；升级后获得 Trip Pro 一列的权益</>}
        </p>
      )}
      <table className="pr-table">
        <thead><tr><th scope="col">功能</th><th scope="col">FREE</th><th scope="col" className="is-pro">TRIP PRO</th></tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={r.label} className={i > 0 && rows[i - 1].group !== r.group ? 'is-group-start' : undefined}><th scope="row">{r.label}</th><td>{r.free}</td><td className="is-pro">{r.pro}</td></tr>)}
        </tbody>
      </table>
      <div className="pr-compare-cards">
        {groups.map((g, i) => (
          <details key={g} className="pr-compare-card" open={i === 0}>
            <summary>{g}</summary>
            {rows.filter(r => r.group === g).map(r => (
              <dl key={r.label}>
                <dt>{r.label}</dt>
                <dd><span>FREE</span>{r.free}</dd>
                <dd className="is-pro"><span>PRO</span>{r.pro}</dd>
              </dl>
            ))}
          </details>
        ))}
      </div>
    </section>
  )
}
