'use client'

/** 旅行灵感：官方专题路线收成一排小卡（最多 4 张，当季在前）；专题接口失败时整块隐藏。 */

import type { OfficialRouteView } from '@/services/tabitrace-api'
import { InspirationCard } from './InspirationCard'

export function TravelInspiration({ routes, loading, season, onOpen }: { routes: OfficialRouteView[]; loading: boolean; season: string; onOpen: (r: OfficialRouteView) => void }) {
  if (!loading && !routes.length) return null
  return (
    <section className="xp-section" id="xp-inspire" aria-labelledby="xp-inspire-title">
      <header className="xp-section-head">
        <div>
          <h2 id="xp-inspire-title">旅行灵感</h2>
          <p>顺路的地点串成一条线，照着走就是一段完整的半天或一天。</p>
        </div>
      </header>
      <div className="xp-inspires">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <span key={i} className="xp-inspire is-skeleton skeleton" aria-hidden="true" />)
          : routes.map(r => <InspirationCard key={r.id} route={r} season={season} onOpen={onOpen} />)}
      </div>
    </section>
  )
}
