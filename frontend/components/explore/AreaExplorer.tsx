'use client'

/**
 * 按区域探索：区域来自真实地点数据（不补不存在的区域）。点区域卡直接把「全部地点」筛选到该区域，
 * 没有为此新建区域详情页。
 */

import type { AreaView } from '@/utils/explore'
import { AreaCard } from './AreaCard'

export function AreaExplorer({ areas, loading, active, onPick }: { areas: AreaView[]; loading: boolean; active: string; onPick: (name: string) => void }) {
  if (!loading && !areas.length) return null
  return (
    <section className="xp-section" id="xp-areas" aria-labelledby="xp-areas-title">
      <header className="xp-section-head">
        <div>
          <h2 id="xp-areas-title">按区域探索</h2>
          <p>用街区的方式认识东京。</p>
        </div>
      </header>
      <div className="xp-areas">
        {loading
          ? Array.from({ length: 8 }, (_, i) => <span key={i} className="xp-area is-skeleton skeleton" aria-hidden="true" />)
          : areas.map(a => <AreaCard key={a.name} area={a} active={active === a.name} onPick={onPick} />)}
      </div>
    </section>
  )
}
