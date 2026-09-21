'use client'

export function HomeSkeleton() {
  return (
    <div className="home-grid" aria-busy="true" aria-label="首页加载中">
      <div className="space-y-5">
        <div className="skeleton skeleton-hero" />
        <div className="stat-row">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton skeleton-stat" />)}</div>
        <div className="home-columns">
          <div className="skeleton skeleton-block" />
          <div className="skeleton skeleton-block" />
        </div>
      </div>
      <aside className="home-side">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-banner" />
      </aside>
    </div>
  )
}
