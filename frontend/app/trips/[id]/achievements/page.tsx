'use client'

/**
 * 旅行成就：首屏总览 → 概览数据 → 下一项成就 → 最近解锁 → 城市收藏 → 全部成就（筛选）→ 收尾。
 * 成就按旅行计算（后端 user_achievements 以 trip 为单位），数据来自 /trips/{id}/achievements；
 * 状态、进度文案、行动入口统一由 utils/achievements 决定。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { MapPin, RefreshCcw, TriangleAlert } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { LiveTripSubnav } from '@/components/trip/LiveTripSubnav'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'
import { AchievementHero } from '@/components/achievements/AchievementHero'
import { AchievementOverview, NextAchievements, RecentlyUnlocked } from '@/components/achievements/AchievementPanels'
import { AchievementFilters, type ScopeFilter } from '@/components/achievements/AchievementFilters'
import { AchievementCard } from '@/components/achievements/AchievementCard'
import { AchievementDetail } from '@/components/achievements/AchievementDetail'
import { CityAchievementCollection } from '@/components/achievements/CityAchievementCollection'
import { AchievementClosing } from '@/components/achievements/AchievementClosing'
import { tripApi, type AchievementView, type TripView } from '@/services/tabitrace-api'
import { categoryOf, cityCollections, getAchievementStatus, nextAchievements, recentlyUnlocked, sortAchievements, type AchievementStatus } from '@/utils/achievements'

export default function AchievementsPage() {
  const params = useParams<{ id: string }>()
  const tripId = Number(params.id)
  const { openQuickCheckIn, checkinVersion } = useQuickCheckIn()
  const [trip, setTrip] = useState<TripView | null>(null)
  const [items, setItems] = useState<AchievementView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scope, setScope] = useState('ALL')
  const [status, setStatus] = useState<AchievementStatus | 'ALL'>('ALL')
  const [detail, setDetail] = useState<AchievementView | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const [t, a] = await Promise.all([tripApi.get(tripId), tripApi.achievements(tripId)])
      setTrip(t)
      setItems(a)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : '请稍后再试')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => { void load() }, [load])
  // 快速打卡之后成就可能变化，静默刷新一次
  useEffect(() => { if (checkinVersion) void load(true) }, [checkinVersion, load])

  const sorted = useMemo(() => sortAchievements(items), [items])
  const cities = useMemo(() => cityCollections(items), [items])
  const counts = useMemo(() => ({
    unlocked: items.filter(a => getAchievementStatus(a) === 'unlocked').length,
    inProgress: items.filter(a => getAchievementStatus(a) === 'inProgress').length,
    notStarted: items.filter(a => getAchievementStatus(a) === 'notStarted').length,
    city: items.filter(a => a.type === 'CITY').length
  }), [items])

  // 分类只列出数据里真实存在的
  const scopes = useMemo<ScopeFilter[]>(() => {
    const list: ScopeFilter[] = [{ key: 'ALL', label: '全部', count: items.length }]
    const global = items.filter(a => a.type !== 'CITY').length
    if (global) list.push({ key: 'GLOBAL', label: '全球', count: global })
    if (counts.city) list.push({ key: 'CITY', label: '城市', count: counts.city })
    const cats = new Map<string, { label: string; count: number }>()
    items.forEach(a => { const c = categoryOf(a); cats.set(c.key, { label: c.label, count: (cats.get(c.key)?.count ?? 0) + 1 }) })
    cats.forEach((v, k) => list.push({ key: `cat:${k}`, label: v.label, count: v.count }))
    return list
  }, [items, counts.city])

  const inScope = useCallback((a: AchievementView) =>
    scope === 'ALL' || (scope === 'GLOBAL' && a.type !== 'CITY') || (scope === 'CITY' && a.type === 'CITY') || scope === `cat:${categoryOf(a).key}`, [scope])
  const scoped = sorted.filter(inScope)
  const visible = status === 'ALL' ? scoped : scoped.filter(a => getAchievementStatus(a) === status)
  const statusCounts = {
    ALL: scoped.length,
    unlocked: scoped.filter(a => getAchievementStatus(a) === 'unlocked').length,
    inProgress: scoped.filter(a => getAchievementStatus(a) === 'inProgress').length,
    notStarted: scoped.filter(a => getAchievementStatus(a) === 'notStarted').length
  }

  const checkin = () => openQuickCheckIn(tripId)
  const next = nextAchievements(items, 3)
  const recent = recentlyUnlocked(items, 3)
  const tripTitle = trip?.title ?? '这段旅行'

  if (loading) return <main><SiteHeader /><AchievementsSkeleton /></main>

  if (error || !trip) {
    return (
      <main>
        <SiteHeader />
        <div className="ac-page">
          <div className="ac-error" role="alert">
            <TriangleAlert size={22} />
            <p>旅行成就加载失败</p>
            <small>{error || '旅行不存在或无权访问'}</small>
            <button type="button" className="ac-action is-primary" onClick={() => void load()}><RefreshCcw size={14} /> 重新加载</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main>
      <SiteHeader />
      <div className="ac-page">
        <LiveTripSubnav tripId={tripId} />
        {items.length === 0 ? (
          <section className="ac-empty">
            <p className="ac-eyebrow">ACHIEVEMENTS</p>
            <h1>旅行成就</h1>
            <p>第一枚旅行徽章，正在等待你的第一次记录。</p>
            <button type="button" className="ac-action is-primary" onClick={checkin}><MapPin size={14} /> 快速打卡</button>
          </section>
        ) : (
          <>
            <AchievementHero
              tripTitle={tripTitle}
              total={items.length}
              unlocked={counts.unlocked}
              cityTotal={counts.city}
              cityUnlocked={items.filter(a => a.type === 'CITY' && a.earned).length}
              spotlight={recent[0] ?? next[0] ?? null}
              onOpen={setDetail}
            />
            <AchievementOverview counts={counts} />
            <NextAchievements items={next} tripId={tripId} onOpen={setDetail} onCheckin={checkin} />
            <RecentlyUnlocked items={recent} tripTitle={tripTitle} onOpen={setDetail} />
            <CityAchievementCollection cities={cities} onOpen={setDetail} />

            <section className="ac-section" id="ac-all">
              <header className="ac-section-head">
                <div>
                  <p className="ac-eyebrow">BADGE COLLECTION</p>
                  <h2>全部成就</h2>
                  <p>已解锁的在前，其次是最接近完成的。</p>
                </div>
              </header>
              <AchievementFilters scopes={scopes} scope={scope} status={status} statusCounts={statusCounts} onScope={setScope} onStatus={setStatus} />
              {visible.length === 0 ? (
                <p className="ac-none">这个分类下暂时没有{status === 'ALL' ? '' : status === 'unlocked' ? '已解锁的' : status === 'inProgress' ? '进行中的' : '未开始的'}成就。</p>
              ) : (
                <div className="ac-grid">
                  {visible.map(a => <AchievementCard key={a.id} achievement={a} tripId={tripId} tripTitle={tripTitle} onOpen={setDetail} onCheckin={checkin} />)}
                </div>
              )}
            </section>

            <AchievementClosing remaining={items.length - counts.unlocked} exploreHref={cities[0]?.explore ?? `/trips/${tripId}/map`} city={cities[0]} />
          </>
        )}
      </div>
      {detail && <AchievementDetail achievement={detail} tripId={tripId} tripTitle={tripTitle} onClose={() => setDetail(null)} onCheckin={checkin} />}
    </main>
  )
}

function AchievementsSkeleton() {
  return (
    <div className="ac-page" aria-busy="true" aria-label="正在加载旅行成就">
      <div className="ac-hero">
        <div className="ac-hero-text">
          <div className="skeleton" style={{ width: 160, height: 12, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 200, height: 40, borderRadius: 10, marginTop: 16 }} />
          <div className="skeleton" style={{ width: '70%', height: 14, borderRadius: 6, marginTop: 18 }} />
          <div className="skeleton" style={{ width: '90%', height: 64, borderRadius: 14, marginTop: 26 }} />
        </div>
        <div className="skeleton" style={{ height: 300, borderRadius: 20 }} />
      </div>
      <div className="skeleton" style={{ height: 64, borderRadius: 16, marginTop: 24 }} />
      <div className="ac-next" style={{ marginTop: 40 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 190, borderRadius: 16 }} />)}</div>
      <div className="ac-grid" style={{ marginTop: 40 }}>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 260, borderRadius: 18 }} />)}</div>
    </div>
  )
}
