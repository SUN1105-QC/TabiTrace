'use client'

/**
 * 旅行详情 · 移动端布局（< 768px）：Hero → 单行 Tabs → 概览 → 关于 → 成果准备度 → 最近记录 → 下一步。
 * 数据由页面层 useTripDetailData 提供，与桌面布局共用同一份请求。
 */

import type { RecentRecord, TripSummary, TripView } from '@/services/tabitrace-api'
import { LiveTripSubnav } from '@/components/trip/LiveTripSubnav'
import { TripHero } from './TripHero'
import { TripOverviewCard } from './TripOverviewCard'
import { NextActions, RecentRecords, TravelReadinessCard, TripAbout } from './TripSections'

export function MobileTripDetail({ trip, summary, recent, onTripChanged, onToast }: {
  trip: TripView
  summary: TripSummary
  recent: RecentRecord[]
  onTripChanged: (t: TripView) => void
  onToast: (msg: string) => void
}) {
  return (
    <div className="td-mobile">
      <TripHero key={trip.coverImage ?? 'default'} trip={trip} onChanged={onTripChanged} onToast={onToast} />
      <LiveTripSubnav tripId={trip.id} sticky />
      <TripOverviewCard trip={trip} summary={summary} />
      <TripAbout trip={trip} summary={summary} />
      <TravelReadinessCard trip={trip} summary={summary} />
      <RecentRecords tripId={trip.id} records={recent} />
      <NextActions trip={trip} />
    </div>
  )
}

export function MobileTripDetailSkeleton() {
  return (
    <div className="td-mobile" aria-busy="true" aria-label="正在加载旅行">
      <div className="skeleton td-sk-hero" />
      <div className="td-sk-tabs">{[56, 44, 44, 44, 44, 44, 44].map((w, i) => <div key={i} className="skeleton" style={{ width: w, height: 34, borderRadius: 999 }} />)}</div>
      <div className="skeleton" style={{ height: 196, borderRadius: 18 }} />
      <div className="skeleton" style={{ height: 210, borderRadius: 18 }} />
      <div className="skeleton" style={{ height: 150, borderRadius: 18 }} />
    </div>
  )
}
