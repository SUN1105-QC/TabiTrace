'use client'

/**
 * Travel Memories · 旅行回忆中心。
 * 首屏（最近一段旅行）→ 回忆概览 → 往年今日 → 已归档旅行 → 回忆作品 → 按时间回看 → 精选照片 → 收尾。
 * 所有数据来自 /me/memories 的真实聚合；没有数据的模块整块隐藏，不用 0 或假数据占位。
 */

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, RefreshCcw, TriangleAlert } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { MemoriesHero } from '@/components/memories/MemoriesHero'
import { MemoriesOverview } from '@/components/memories/MemoriesOverview'
import { MemoryFlashback } from '@/components/memories/MemoryFlashback'
import { MemoryTripCard } from '@/components/memories/MemoryTripCard'
import { MemoryCreations } from '@/components/memories/MemoryCreations'
import { MemoryTimeline } from '@/components/memories/MemoryTimeline'
import { MemoryPhotos } from '@/components/memories/MemoryPhotos'
import { MemoryClosing } from '@/components/memories/MemoryClosing'
import { memoryApi, type MemoriesView, type MemoryTrip } from '@/services/memories'

const PAGE = 6

export default function MemoriesPage() {
  const [data, setData] = useState<MemoriesView | null>(null)
  const [trips, setTrips] = useState<MemoryTrip[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [moreError, setMoreError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await memoryApi.memories(PAGE)
      setData(d)
      setTrips(d.trips)
      setHasMore(d.hasMore)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : '请稍后再试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function loadMore() {
    setLoadingMore(true)
    setMoreError('')
    try {
      const page = await memoryApi.trips(trips.length, PAGE)
      setTrips(t => [...t, ...page.trips.filter(x => !t.some(y => y.id === x.id))])
      setHasMore(page.hasMore)
    } catch (e) {
      setMoreError(e instanceof Error && e.message ? e.message : '加载失败，请重试')
    } finally {
      setLoadingMore(false)
    }
  }

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (loading) return <main><SiteHeader /><MemoriesSkeleton /></main>

  if (error || !data) {
    return (
      <main>
        <SiteHeader />
        <div className="mm-page">
          <div className="mm-card mm-error" role="alert">
            <TriangleAlert size={22} />
            <p>旅行回忆加载失败</p>
            <small>{error}</small>
            <button type="button" className="mm-btn is-primary" onClick={() => void load()}><RefreshCcw size={14} /> 重新加载</button>
          </div>
        </div>
      </main>
    )
  }

  const featured = trips[0] ?? null
  const empty = !featured
  const chips = empty ? [] : [
    { label: '已归档旅行', target: 'mm-archived' },
    ...(data.creations.some(c => c.type === 'SHARE_LINK') ? [{ label: '分享成果', target: 'mm-creations' }] : []),
    ...(data.creations.some(c => c.type === 'STORY') ? [{ label: 'Travel Story', target: 'mm-creations' }] : []),
    ...(data.flashback ? [{ label: '往年今日', target: 'mm-flashback' }] : [])
  ]
  const achievementsHref = `/trips/${data.achievements[0]?.tripId ?? featured?.id ?? ''}/achievements`

  return (
    <main>
      <SiteHeader />
      <div className="mm-page">
        <MemoriesHero featured={featured} chips={chips} onJump={jump} />

        {!empty && (
          <div className="mm-flow">
            <div className="mm-o-overview"><MemoriesOverview overview={data.overview} /></div>
            {data.flashback && <div className="mm-o-flashback"><MemoryFlashback flashback={data.flashback} /></div>}

            <section className="mm-section mm-o-archived" id="mm-archived">
              <header className="mm-section-head">
                <div>
                  <p className="mm-eyebrow">ARCHIVED JOURNEYS</p>
                  <h2>已归档旅行</h2>
                  <p>每一次结束的旅行，都会在这里成为值得反复回看的记忆。</p>
                </div>
              </header>
              <div className="mm-trips">
                {trips.map(t => <MemoryTripCard key={t.id} trip={t} />)}
              </div>
              {hasMore && (
                <div className="mm-more-row">
                  <button type="button" className="mm-btn" onClick={() => void loadMore()} disabled={loadingMore}>
                    <ChevronDown size={15} /> {loadingMore ? '正在加载…' : '查看更多旅行'}
                  </button>
                  {moreError && <p className="mm-hint is-warn">{moreError}</p>}
                </div>
              )}
            </section>

            <div className="mm-o-creations"><MemoryCreations creations={data.creations} latestTripId={featured?.id} /></div>
            <div className="mm-o-timeline"><MemoryTimeline entries={data.timeline} /></div>
            <div className="mm-o-photos"><MemoryPhotos photos={data.photos} year={data.photoYear} /></div>
          </div>
        )}

        <MemoryClosing achievements={data.achievements} total={data.achievementCount} achievementsHref={empty ? '/trips' : achievementsHref} />
      </div>
    </main>
  )
}

function MemoriesSkeleton() {
  return (
    <div className="mm-page" aria-busy="true" aria-label="正在加载旅行回忆">
      <div className="mm-hero">
        <div className="mm-hero-text">
          <div className="skeleton" style={{ width: 140, height: 12, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 220, height: 40, borderRadius: 10, marginTop: 16 }} />
          <div className="skeleton" style={{ width: '90%', height: 14, borderRadius: 6, marginTop: 18 }} />
          <div className="skeleton" style={{ width: '70%', height: 14, borderRadius: 6, marginTop: 10 }} />
          <div className="skeleton" style={{ width: 240, height: 42, borderRadius: 12, marginTop: 26 }} />
        </div>
        <div className="skeleton" style={{ height: 340, borderRadius: 18 }} />
      </div>
      <div className="mm-overview">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 86, borderRadius: 16 }} />)}</div>
      <div className="mm-trips" style={{ marginTop: 40 }}>{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 460, borderRadius: 18 }} />)}</div>
      <div className="mm-photos" style={{ marginTop: 40 }}>{Array.from({ length: 5 }, (_, i) => <div key={i} className={`skeleton mm-photo${i === 0 ? ' is-lead' : ''}`} />)}</div>
    </div>
  )
}
